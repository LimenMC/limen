use crate::AppError;
use super::config::{VersionManifest, VersionDetails, LimenConfig};
use tauri::Emitter;

const VERSION_MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
const MINECRAFT_RESOURCES_URL: &str = "https://resources.download.minecraft.net";

pub struct MinecraftDownloader {
    client: reqwest::Client,
    config: LimenConfig,
}

impl MinecraftDownloader {
    pub fn new(config: LimenConfig) -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("Limen/0.1.0")
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .expect("Failed to build HTTP client"),
            config,
        }
    }

    pub async fn fetch_version_manifest(&self) -> Result<VersionManifest, AppError> {
        let response = self.client
            .get(VERSION_MANIFEST_URL)
            .send()
            .await
            .map_err(|e| AppError::NetworkError(format!("Failed to fetch version manifest: {}", e)))?;

        self.validate_response(&response, "Version manifest")?;

        let text = response.text().await
            .map_err(|e| AppError::NetworkError(format!("Failed to read response body: {}", e)))?;

        serde_json::from_str(&text)
            .map_err(|e| AppError::NetworkError(format!(
                "Failed to parse version manifest JSON: {}. Response: {}", 
                e, 
                &text[..text.len().min(200)]
            )))
    }

    pub async fn fetch_version_details(&self, version_url: &str) -> Result<VersionDetails, AppError> {
        let response = self.client
            .get(version_url)
            .send()
            .await
            .map_err(|e| AppError::NetworkError(format!("Failed to fetch version details: {}", e)))?;

        self.validate_response(&response, "Version details")?;

        let text = response.text().await
            .map_err(|e| AppError::NetworkError(format!("Failed to read response body: {}", e)))?;

        serde_json::from_str(&text)
            .map_err(|e| AppError::NetworkError(format!("Failed to parse version details JSON: {}", e)))
    }

    pub async fn download_client_jar(&self, version: &str, download_url: &str) -> Result<String, AppError> {
        let version_dir = self.config.versions_dir.join(version);
        std::fs::create_dir_all(&version_dir)?;

        let jar_path = version_dir.join(format!("{}.jar", version));
        
        if jar_path.exists() {
            return Ok(jar_path.to_string_lossy().to_string());
        }

        let bytes = self.download_file(download_url).await?;
        std::fs::write(&jar_path, bytes)?;
        
        Ok(jar_path.to_string_lossy().to_string())
    }

    pub async fn download_library(&self, url: &str, path: &str) -> Result<(), AppError> {
        let lib_path = self.config.libraries_dir.join(path);
        
        if lib_path.exists() {
            return Ok(());
        }

        self.ensure_parent_dir(&lib_path)?;

        println!("Downloading library from: {}", url);
        
        match self.try_download_file(url).await {
            Ok(bytes) => {
                std::fs::write(&lib_path, bytes)?;
                Ok(())
            }
            Err(e) => {
                eprintln!("Warning: Failed to download {}: {}", path, e);
                Err(AppError::NetworkError(format!("Failed to download library {}: {}", path, e)))
            }
        }
    }

    pub async fn download_modded_library(
        &self,
        name: &str,
        download_url: &str,
        target_path: &std::path::Path,
    ) -> Result<(), AppError> {
        if target_path.exists() {
            return Ok(());
        }

        self.ensure_parent_dir(target_path)?;

        println!("Downloading modded library: {} from {}", name, download_url);

        match self.try_download_file(download_url).await {
            Ok(bytes) => {
                std::fs::write(target_path, bytes)?;
                Ok(())
            }
            Err(e) => {
                eprintln!("Warning: Failed to download modded library {} ({}), may be bundled", name, e);
                Ok(())
            }
        }
    }

    pub async fn download_libraries(&self, details: &VersionDetails) -> Result<Vec<String>, AppError> {
        use futures::stream::{self, StreamExt};
        
        let mut to_download = Vec::new();
        
        for library in &details.libraries {
            if !self.should_download_library(library) {
                continue;
            }

            if let Some(downloads) = &library.downloads {
                if let Some(artifact) = &downloads.artifact {
                    to_download.push((artifact.url.clone(), artifact.path.clone()));
                }

                if let Some(native_path) = self.get_native_library_path(library, downloads) {
                    to_download.push((native_path.0, native_path.1));
                }
            }
        }
        
        let results: Vec<_> = stream::iter(to_download.into_iter())
            .map(|(url, path): (String, String)| {
                let url = url.clone();
                let path = path.clone();
                async move {
                    self.download_library(&url, &path).await?;
                    Ok::<String, AppError>(path)
                }
            })
            .buffer_unordered(8)
            .collect()
            .await;
        
        let mut downloaded = Vec::new();
        for result in results {
            match result {
                Ok(path) => downloaded.push(path),
                Err(e) => eprintln!("Warning: Library download failed: {}", e),
            }
        }

        Ok(downloaded)
    }

    fn should_download_library(&self, library: &super::config::Library) -> bool {
        if let Some(rules) = &library.rules {
            for rule in rules {
                if rule.action == "allow" {
                    if let Some(os) = &rule.os {
                        if let Some(os_name) = &os.name {
                            return self.is_current_os(os_name);
                        }
                    } else {
                        return true;
                    }
                }
            }
            return false;
        }
        true
    }

    fn is_current_os(&self, os_name: &str) -> bool {
        #[cfg(target_os = "windows")]
        return os_name == "windows";
        
        #[cfg(target_os = "macos")]
        return os_name == "osx";
        
        #[cfg(target_os = "linux")]
        return os_name == "linux";
    }

    fn get_native_library_path(
        &self,
        library: &super::config::Library,
        downloads: &super::config::LibraryDownloads,
    ) -> Option<(String, String)> {
        let natives = library.natives.as_ref()?;
        
        #[cfg(target_os = "windows")]
        let native_key = natives.get("windows")?;
        
        #[cfg(target_os = "macos")]
        let native_key = natives.get("osx")?;
        
        #[cfg(target_os = "linux")]
        let native_key = natives.get("linux")?;

        let classifiers = downloads.classifiers.as_ref()?;
        let native_artifact = classifiers.get(native_key)?;
        
        Some((native_artifact.url.clone(), native_artifact.path.clone()))
    }

    pub async fn download_asset_index(
        &self,
        details: &VersionDetails,
        app: Option<tauri::AppHandle>,
    ) -> Result<(), AppError> {
        let asset_index_path = self.config.assets_dir
            .join("indexes")
            .join(format!("{}.json", details.asset_index.id));

        if !asset_index_path.exists() {
            std::fs::create_dir_all(asset_index_path.parent().unwrap())?;
            let bytes = self.download_file(&details.asset_index.url).await?;
            std::fs::write(&asset_index_path, &bytes)?;
        }

        let asset_index_content = std::fs::read_to_string(&asset_index_path)?;
        let asset_index: serde_json::Value = serde_json::from_str(&asset_index_content)?;

        if let Some(objects) = asset_index.get("objects").and_then(|o| o.as_object()) {
            self.download_assets(objects, app).await?;
        }
        
        Ok(())
    }

    async fn download_assets(
        &self,
        objects: &serde_json::Map<String, serde_json::Value>,
        app: Option<tauri::AppHandle>,
    ) -> Result<(), AppError> {
        let total = objects.len();
        let mut downloaded = 0;

        for (_name, asset_data) in objects {
            if let Some(hash) = asset_data.get("hash").and_then(|h| h.as_str()) {
                if self.download_single_asset(hash).await.is_ok() {
                    downloaded += 1;
                    
                    if downloaded % 10 == 0 {
                        self.emit_asset_progress(downloaded, total, &app);
                    }
                }
            }
        }
        
        println!("Asset download complete! Downloaded {} new assets.", downloaded);
        Ok(())
    }

    async fn download_single_asset(&self, hash: &str) -> Result<(), AppError> {
        let hash_prefix = &hash[0..2];
        let asset_path = self.config.assets_dir
            .join("objects")
            .join(hash_prefix)
            .join(hash);

        if asset_path.exists() {
            return Ok(());
        }

        std::fs::create_dir_all(asset_path.parent().unwrap())?;

        let asset_url = format!("{}/{}/{}", MINECRAFT_RESOURCES_URL, hash_prefix, hash);
        
        match self.try_download_file(&asset_url).await {
            Ok(bytes) => {
                std::fs::write(&asset_path, bytes)?;
                Ok(())
            }
            Err(_) => Ok(())
        }
    }

    fn emit_asset_progress(&self, downloaded: usize, total: usize, app: &Option<tauri::AppHandle>) {
        println!("Downloaded {}/{} assets...", downloaded, total);
        
        if let Some(app_handle) = app {
            let _ = app_handle.emit("download-progress", serde_json::json!({
                "stage": "assets",
                "message": format!("Downloading assets... {}/{}", downloaded, total),
                "progress": (downloaded as f32 / total as f32 * 100.0) as u32
            }));
        }
    }

    pub fn is_version_downloaded(&self, version: &str) -> bool {
        let version_json_path = self.config.versions_dir.join(version).join(format!("{}.json", version));

        if !version_json_path.exists() {
            return false;
        }

        if let Ok(json_content) = std::fs::read_to_string(&version_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&json_content) {
                if let Some(parent) = json.get("inheritsFrom").and_then(|v| v.as_str()) {
                    return self.is_modded_version_complete(parent);
                }
            }
        }

        let jar_path = self.config.versions_dir.join(version).join(format!("{}.jar", version));
        jar_path.exists()
    }

    fn is_modded_version_complete(&self, parent_version: &str) -> bool {
        let parent_jar = self.config.versions_dir.join(parent_version).join(format!("{}.jar", parent_version));
        let parent_json = self.config.versions_dir.join(parent_version).join(format!("{}.json", parent_version));
        parent_jar.exists() && parent_json.exists()
    }
}

// Helper methods
impl MinecraftDownloader {
    async fn download_file(&self, url: &str) -> Result<Vec<u8>, AppError> {
        let response = self.client.get(url).send().await?;
        self.validate_response(&response, "File download")?;
        Ok(response.bytes().await?.to_vec())
    }

    async fn try_download_file(&self, url: &str) -> Result<Vec<u8>, AppError> {
        let response = self.client.get(url).send().await
            .map_err(|e| AppError::NetworkError(format!("Request failed: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(AppError::NetworkError(format!("HTTP {}", response.status())));
        }
        
        response.bytes().await
            .map(|b| b.to_vec())
            .map_err(|e| AppError::NetworkError(format!("Failed to read bytes: {}", e)))
    }

    fn validate_response(&self, response: &reqwest::Response, context: &str) -> Result<(), AppError> {
        if !response.status().is_success() {
            return Err(AppError::NetworkError(format!(
                "{} request failed with status: {}",
                context,
                response.status()
            )));
        }
        Ok(())
    }

    fn ensure_parent_dir(&self, path: &std::path::Path) -> Result<(), AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        Ok(())
    }
}
