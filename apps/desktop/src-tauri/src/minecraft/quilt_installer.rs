use crate::AppError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Deserialize, Serialize)]
struct QuiltLoaderInfo {
    loader: QuiltVersion,
    #[serde(default)]
    intermediary: Option<QuiltVersion>,
    #[serde(default, rename = "hashed")]
    hashed: Option<QuiltVersion>,
    #[serde(rename = "launcherMeta")]
    launcher_meta: LauncherMeta,
}

#[derive(Debug, Deserialize, Serialize)]
struct QuiltVersion {
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

pub struct QuiltInstaller {
    client: Client,
    limen_dir: PathBuf,
}

impl QuiltInstaller {
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
        let version_name = format!("quilt-loader-{}-{}", loader_version, game_version);
        let version_json = self.limen_dir
            .join("minecraft")
            .join("versions")
            .join(&version_name)
            .join(format!("{}.json", version_name));
        
        version_json.exists()
    }

    pub async fn install_quilt(
        &self,
        game_version: &str,
        loader_version: &str,
    ) -> Result<String, AppError> {
        let url = format!(
            "https://meta.quiltmc.org/v3/versions/loader/{}/{}",
            game_version, loader_version
        );

        let response = self.client.get(&url).send().await
            .map_err(|e| AppError::NetworkError(format!("Failed to connect to Quilt API: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Quilt API returned status {}: {}",
                response.status(),
                url
            )));
        }

        let text = response.text().await
            .map_err(|e| AppError::NetworkError(format!("Failed to read Quilt API response: {}", e)))?;

        let loader_info: QuiltLoaderInfo = serde_json::from_str(&text)
            .map_err(|e| AppError::NetworkError(format!(
                "Failed to parse Quilt API response: {}. URL: {}",
                e, url
            )))?;

        let quilt_version_name = format!("quilt-loader-{}-{}", loader_version, game_version);
        let version_dir = self.limen_dir
            .join("minecraft")
            .join("versions")
            .join(&quilt_version_name);

        fs::create_dir_all(&version_dir)?;

        self.download_libraries(&loader_info, &version_dir).await?;
        self.create_version_json(&loader_info, game_version, &quilt_version_name, &version_dir)?;

        Ok(quilt_version_name)
    }

    async fn download_libraries(
        &self,
        loader_info: &QuiltLoaderInfo,
        _version_dir: &PathBuf,
    ) -> Result<(), AppError> {
        use futures::stream::{self, StreamExt};
        
        let libraries_dir = self.limen_dir.join("minecraft").join("libraries");
        fs::create_dir_all(&libraries_dir)?;

        let mut all_libraries = Vec::new();
        
        all_libraries.push(Library {
            name: loader_info.loader.maven.clone(),
            url: "https://maven.quiltmc.org/repository/release/".to_string(),
        });
        
        if let Some(ref intermediary) = loader_info.intermediary {
            all_libraries.push(Library {
                name: intermediary.maven.clone(),
                url: "https://maven.quiltmc.org/repository/release/".to_string(),
            });
        } else if let Some(ref hashed) = loader_info.hashed {
            all_libraries.push(Library {
                name: hashed.maven.clone(),
                url: "https://maven.quiltmc.org/repository/release/".to_string(),
            });
        }
        
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
                            "Failed to download Quilt library {}: HTTP {}",
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
        loader_info: &QuiltLoaderInfo,
        game_version: &str,
        quilt_version_name: &str,
        version_dir: &PathBuf,
    ) -> Result<(), AppError> {
        let mut libraries = Vec::new();
        
        libraries.push(serde_json::json!({
            "name": loader_info.loader.maven,
            "url": "https://maven.quiltmc.org/repository/release/",
        }));
        
        if let Some(ref intermediary) = loader_info.intermediary {
            libraries.push(serde_json::json!({
                "name": intermediary.maven,
                "url": "https://maven.quiltmc.org/repository/release/",
            }));
        } else if let Some(ref hashed) = loader_info.hashed {
            libraries.push(serde_json::json!({
                "name": hashed.maven,
                "url": "https://maven.quiltmc.org/repository/release/",
            }));
        }
        
        for lib in &loader_info.launcher_meta.libraries.common {
            libraries.push(serde_json::json!({
                "name": lib.name,
                "url": lib.url,
            }));
        }
        
        for lib in &loader_info.launcher_meta.libraries.client {
            libraries.push(serde_json::json!({
                "name": lib.name,
                "url": lib.url,
            }));
        }
        
        let version_json = serde_json::json!({
            "id": quilt_version_name,
            "inheritsFrom": game_version,
            "type": "release",
            "mainClass": loader_info.launcher_meta.main_class.client,
            "libraries": libraries,
        });

        let json_path = version_dir.join(format!("{}.json", quilt_version_name));
        fs::write(json_path, serde_json::to_string_pretty(&version_json)?)?;

        Ok(())
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
