use crate::AppError;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderVersion {
    pub version: String,
    pub stable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderInfo {
    pub loader: LoaderVersion,
}

pub struct LoadersApi {
    client: Client,
}

impl LoadersApi {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("Limen/0.1.0")
                .build()
                .unwrap(),
        }
    }

    pub async fn get_fabric_versions(&self) -> Result<Vec<LoaderVersion>, AppError> {
        let url = "https://meta.fabricmc.net/v2/versions/loader";
        
        let response = self.client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Fabric API error: {}",
                response.status()
            )));
        }

        let versions = response.json::<Vec<LoaderVersion>>().await?;
        Ok(versions)
    }

    pub async fn get_fabric_versions_for_game(&self, game_version: &str) -> Result<Vec<LoaderInfo>, AppError> {
        let url = format!("https://meta.fabricmc.net/v2/versions/loader/{}", game_version);
        
        let response = self.client.get(&url).send().await?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Fabric API error: {}",
                response.status()
            )));
        }

        let versions = response.json::<Vec<LoaderInfo>>().await?;
        Ok(versions)
    }

    pub async fn get_quilt_versions(&self) -> Result<Vec<LoaderVersion>, AppError> {
        let url = "https://meta.quiltmc.org/v3/versions/loader";
        
        let response = self.client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Quilt API error: {}",
                response.status()
            )));
        }

        #[derive(Deserialize)]
        struct QuiltLoaderVersion {
            version: String,
        }

        let quilt_versions = response.json::<Vec<QuiltLoaderVersion>>().await?;
        let versions = quilt_versions
            .into_iter()
            .map(|v| LoaderVersion {
                version: v.version,
                stable: true,
            })
            .collect();
        
        Ok(versions)
    }

    pub async fn get_quilt_versions_for_game(&self, game_version: &str) -> Result<Vec<LoaderInfo>, AppError> {
        let url = format!("https://meta.quiltmc.org/v3/versions/loader/{}", game_version);
        
        let response = self.client.get(&url).send().await?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Quilt API error: {}",
                response.status()
            )));
        }

        #[derive(Deserialize)]
        struct QuiltLoaderInfo {
            loader: QuiltLoaderVersion,
        }
        
        #[derive(Deserialize)]
        struct QuiltLoaderVersion {
            version: String,
        }

        let quilt_versions = response.json::<Vec<QuiltLoaderInfo>>().await?;
        let versions = quilt_versions
            .into_iter()
            .map(|v| LoaderInfo {
                loader: LoaderVersion {
                    version: v.loader.version,
                    stable: true,
                },
            })
            .collect();
        
        Ok(versions)
    }

    pub async fn get_forge_versions_for_game(&self, game_version: &str) -> Result<Vec<String>, AppError> {
        let url = "https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json";
        
        let response = self.client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Forge API error: {}",
                response.status()
            )));
        }

        let manifest = response.json::<std::collections::HashMap<String, Vec<String>>>().await?;
        
        if let Some(versions) = manifest.get(game_version) {
            // Extract forge version from "1.21.1-52.0.29" format
            let parsed_versions: Vec<String> = versions
                .iter()
                .filter_map(|full_version| {
                    let parts: Vec<&str> = full_version.splitn(2, '-').collect();
                    if parts.len() == 2 {
                        Some(parts[1].to_string())
                    } else {
                        None
                    }
                })
                .collect();
            
            if parsed_versions.is_empty() {
                return Err(AppError::ApiError(format!(
                    "No valid Forge versions found for Minecraft {}",
                    game_version
                )));
            }
            
            Ok(parsed_versions)
        } else {
            Err(AppError::ApiError(format!(
                "No Forge versions found for Minecraft {}",
                game_version
            )))
        }
    }

    pub async fn get_neoforge_versions(&self) -> Result<Vec<String>, AppError> {
        let url = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";
        
        let response = self.client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Ok(vec![
                "21.1.77".to_string(),
                "21.1.72".to_string(),
                "21.0.167".to_string(),
                "21.0.162".to_string(),
                "20.6.119".to_string(),
                "20.6.117".to_string(),
                "20.4.237".to_string(),
                "20.4.234".to_string(),
                "20.2.88".to_string(),
                "20.2.86".to_string(),
            ]);
        }

        #[derive(Deserialize)]
        struct NeoForgeResponse {
            versions: Vec<String>,
        }

        match response.json::<NeoForgeResponse>().await {
            Ok(data) => Ok(data.versions),
            Err(_) => {
                Ok(vec![
                    "21.1.77".to_string(),
                    "21.1.72".to_string(),
                    "21.0.167".to_string(),
                    "21.0.162".to_string(),
                    "20.6.119".to_string(),
                    "20.6.117".to_string(),
                    "20.4.237".to_string(),
                    "20.4.234".to_string(),
                    "20.2.88".to_string(),
                    "20.2.86".to_string(),
                ])
            }
        }
    }
}
