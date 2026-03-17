use crate::AppError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Deserialize, Serialize)]
struct FabricLoaderInfo {
    loader: FabricVersion,
    intermediary: FabricVersion,
    #[serde(rename = "launcherMeta")]
    launcher_meta: LauncherMeta,
}

#[derive(Debug, Deserialize, Serialize)]
struct FabricVersion {
    version: String,
    maven: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct LauncherMeta {
    version: i32,
    libraries: Libraries,
    #[serde(rename = "mainClass")]
    main_class: MainClass,
}

#[derive(Debug, Deserialize, Serialize)]
struct Libraries {
    client: Vec<Library>,
    common: Vec<Library>,
    server: Vec<Library>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct Library {
    name: String,
    url: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct MainClass {
    client: String,
    server: String,
}

pub struct FabricInstaller {
    client: Client,
    limen_dir: PathBuf,
}

impl FabricInstaller {
    pub fn new(limen_dir: PathBuf) -> Self {
        Self {
            client: Client::builder()
                .user_agent("Limen/0.1.0")
                .build()
                .expect("Failed to build HTTP client"),
            limen_dir,
        }
    }

    pub fn is_installed(&self, game_version: &str, loader_version: &str) -> bool {
        let version_name = format!("fabric-loader-{}-{}", loader_version, game_version);
        let version_json = self.limen_dir
            .join("minecraft")
            .join("versions")
            .join(&version_name)
            .join(format!("{}.json", version_name));
        
        version_json.exists()
    }

    pub async fn install_fabric(
        &self,
        game_version: &str,
        loader_version: &str,
    ) -> Result<String, AppError> {
        let actual_loader_version = if loader_version.is_empty() {
            self.get_latest_loader_version(game_version).await?
        } else {
            loader_version.to_string()
        };

        let url = format!(
            "https://meta.fabricmc.net/v2/versions/loader/{}/{}",
            game_version, actual_loader_version
        );

        let response = self.client.get(&url).send().await
            .map_err(|e| AppError::NetworkError(format!("Failed to connect to Fabric API: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Fabric API returned status {}: {}",
                response.status(),
                url
            )));
        }

        let text = response.text().await
            .map_err(|e| AppError::NetworkError(format!("Failed to read Fabric API response: {}", e)))?;

        let loader_info: FabricLoaderInfo = serde_json::from_str(&text)
            .map_err(|e| AppError::NetworkError(format!(
                "Failed to parse Fabric API response: {}. URL: {}. Response: {}",
                e, url, &text[..text.len().min(200)]
            )))?;

        let fabric_version_name = format!("fabric-loader-{}-{}", actual_loader_version, game_version);
        let version_dir = self.limen_dir
            .join("minecraft")
            .join("versions")
            .join(&fabric_version_name);

        fs::create_dir_all(&version_dir)?;

        self.download_libraries(&loader_info, &version_dir).await?;
        self.create_version_json(
            &loader_info,
            game_version,
            &fabric_version_name,
            &version_dir,
        )?;

        Ok(fabric_version_name)
    }

    async fn get_latest_loader_version(&self, game_version: &str) -> Result<String, AppError> {
        let url = format!(
            "https://meta.fabricmc.net/v2/versions/loader/{}",
            game_version
        );

        let response = self.client.get(&url).send().await
            .map_err(|e| AppError::NetworkError(format!("Failed to connect to Fabric API: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Fabric API returned status {}: {}",
                response.status(),
                url
            )));
        }

        let text = response.text().await
            .map_err(|e| AppError::NetworkError(format!("Failed to read Fabric API response: {}", e)))?;

        let json: Vec<serde_json::Value> = serde_json::from_str(&text)
            .map_err(|e| AppError::NetworkError(format!(
                "Failed to parse Fabric loader versions: {}. Response: {}",
                e, &text[..text.len().min(200)]
            )))?;

        if let Some(first) = json.first() {
            if let Some(loader) = first.get("loader") {
                if let Some(version) = loader.get("version").and_then(|v| v.as_str()) {
                    return Ok(version.to_string());
                }
            }
        }

        Err(AppError::ApiError("No Fabric loader versions found".to_string()))
    }

    async fn download_libraries(
        &self,
        loader_info: &FabricLoaderInfo,
        _version_dir: &PathBuf,
    ) -> Result<(), AppError> {
        use futures::stream::{self, StreamExt};
        
        let libraries_dir = self.limen_dir.join("minecraft").join("libraries");
        fs::create_dir_all(&libraries_dir)?;

        let mut all_libraries = Vec::new();
        
        all_libraries.push(Library {
            name: loader_info.loader.maven.clone(),
            url: "https://maven.fabricmc.net/".to_string(),
        });
        all_libraries.push(Library {
            name: loader_info.intermediary.maven.clone(),
            url: "https://maven.fabricmc.net/".to_string(),
        });
        
        all_libraries.extend(loader_info.launcher_meta.libraries.common.clone());
        all_libraries.extend(loader_info.launcher_meta.libraries.client.clone());

        let mut to_download = Vec::new();
        
        for library in all_libraries {
            let lib_path = self.maven_to_path(&library.name);
            let lib_file = libraries_dir.join(&lib_path);

            if lib_file.exists() {
                continue;
            }

            let base_url = if library.url.ends_with('/') {
                library.url.clone()
            } else {
                format!("{}/", library.url)
            };
            let lib_url = format!("{}{}", base_url, lib_path);
            
            to_download.push((lib_url, lib_file, library.name));
        }
        
        let results: Vec<_> = stream::iter(to_download.into_iter())
            .map(|(lib_url, lib_file, lib_name)| {
                let client = self.client.clone();
                async move {
                    if let Some(parent) = lib_file.parent() {
                        fs::create_dir_all(parent)?;
                    }

                    let response = client.get(&lib_url).send().await?;

                    if response.status().is_success() {
                        let bytes = response.bytes().await?;
                        fs::write(&lib_file, bytes)?;
                        Ok(())
                    } else {
                        Err(AppError::NetworkError(format!(
                            "Failed to download Fabric library {}: HTTP {}",
                            lib_name,
                            response.status()
                        )))
                    }
                }
            })
            .buffer_unordered(8)
            .collect()
            .await;
        
        for result in results {
            result?;
        }

        Ok(())
    }

    fn create_version_json(
        &self,
        loader_info: &FabricLoaderInfo,
        game_version: &str,
        fabric_version_name: &str,
        version_dir: &PathBuf,
    ) -> Result<(), AppError> {
        let mut libraries = Vec::new();
        
        libraries.push(serde_json::json!({
            "name": loader_info.loader.maven,
            "url": "https://maven.fabricmc.net/",
        }));
        libraries.push(serde_json::json!({
            "name": loader_info.intermediary.maven,
            "url": "https://maven.fabricmc.net/",
        }));
        
        libraries.extend(self.convert_libraries(&loader_info.launcher_meta.libraries));
        
        let version_json = serde_json::json!({
            "id": fabric_version_name,
            "inheritsFrom": game_version,
            "type": "release",
            "mainClass": loader_info.launcher_meta.main_class.client,
            "libraries": libraries,
        });

        let json_path = version_dir.join(format!("{}.json", fabric_version_name));
        fs::write(json_path, serde_json::to_string_pretty(&version_json)?)?;

        Ok(())
    }

    fn convert_libraries(&self, libraries: &Libraries) -> Vec<serde_json::Value> {
        let mut result = Vec::new();
        
        for lib in &libraries.common {
            result.push(serde_json::json!({
                "name": lib.name,
                "url": lib.url,
            }));
        }
        
        for lib in &libraries.client {
            result.push(serde_json::json!({
                "name": lib.name,
                "url": lib.url,
            }));
        }

        result
    }

    fn maven_to_path(&self, maven: &str) -> String {
        let parts: Vec<&str> = maven.split(':').collect();
        if parts.len() < 3 {
            return maven.to_string();
        }

        let group = parts[0].replace('.', "/");
        let artifact = parts[1];
        let version = parts[2];

        format!("{}/{}/{}/{}-{}.jar", group, artifact, version, artifact, version)
    }
}
