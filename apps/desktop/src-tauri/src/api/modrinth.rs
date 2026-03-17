use crate::{AppError, ModrinthSearchResult, ModrinthProject, ModrinthVersion};
use reqwest::Client;
use once_cell::sync::Lazy;
use std::time::Duration;

const MODRINTH_API_BASE: &str = "https://api.modrinth.com/v2";

static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .user_agent("Limen/0.1.0")
        .pool_max_idle_per_host(10)
        .timeout(Duration::from_secs(30))
        .https_only(true)
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .build()
        .expect("Failed to build HTTP client")
});

#[derive(Clone)]
pub struct ModrinthApi {
    client: Client,
}

impl ModrinthApi {
    pub fn new() -> Self {
        Self {
            client: HTTP_CLIENT.clone(),
        }
    }

    pub async fn search_mods(
        &self,
        query: &str,
        facets: Option<Vec<Vec<String>>>,
        index: Option<String>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<ModrinthSearchResult, AppError> {
        let url = format!("{}/search", MODRINTH_API_BASE);
        let mut params = vec![("query", query.to_string())];
        
        if let Some(limit) = limit {
            params.push(("limit", limit.to_string()));
        }
        if let Some(offset) = offset {
            params.push(("offset", offset.to_string()));
        }
        if let Some(index) = index {
            params.push(("index", index));
        }
        if let Some(facets) = facets {
            let facets_json = serde_json::to_string(&facets)
                .map_err(|e| AppError::InvalidParam(e.to_string()))?;
            params.push(("facets", facets_json));
        }

        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Modrinth API error: {}",
                response.status()
            )));
        }

        let result = response.json::<ModrinthSearchResult>().await?;
        Ok(result)
    }

    pub async fn get_project(&self, id_or_slug: &str) -> Result<ModrinthProject, AppError> {
        let url = format!("{}/project/{}", MODRINTH_API_BASE, id_or_slug);
        
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Modrinth API error: {}",
                response.status()
            )));
        }

        let project = response.json::<ModrinthProject>().await?;
        Ok(project)
    }

    pub async fn get_project_versions(
        &self,
        id_or_slug: &str,
        loaders: Option<Vec<String>>,
        game_versions: Option<Vec<String>>,
    ) -> Result<Vec<ModrinthVersion>, AppError> {
        let url = format!("{}/project/{}/version", MODRINTH_API_BASE, id_or_slug);
        
        let mut params = vec![("include_changelog", "false".to_string())];
        if let Some(loaders) = loaders {
            params.push(("loaders", serde_json::to_string(&loaders).unwrap()));
        }
        if let Some(game_versions) = game_versions {
            params.push(("game_versions", serde_json::to_string(&game_versions).unwrap()));
        }

        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Modrinth API error: {}",
                response.status()
            )));
        }

        let versions = response.json::<Vec<ModrinthVersion>>().await?;
        Ok(versions)
    }
    
    // Get version info from file hash (SHA1 or SHA512)
    pub async fn get_version_from_hash(&self, hash: &str) -> Result<ModrinthVersion, AppError> {
        let url = format!("{}/version_file/{}", MODRINTH_API_BASE, hash);
        
        let response = self.client
            .get(&url)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Modrinth API error: {}",
                response.status()
            )));
        }

        let version = response.json::<ModrinthVersion>().await?;
        Ok(version)
    }
    
    // v3 API for server details with player count
    pub async fn get_server_details(&self, id_or_slug: &str) -> Result<serde_json::Value, AppError> {
        let url = format!("https://api.modrinth.com/v3/project/{}", id_or_slug);
        
        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Modrinth API error: {}",
                response.status()
            )));
        }

        let data = response.json::<serde_json::Value>().await?;
        Ok(data)
    }
}
