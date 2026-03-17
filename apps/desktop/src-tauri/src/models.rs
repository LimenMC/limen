use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JavaInstallation {
    pub version: u8,
    pub path: String,
    pub is_custom: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthProject {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub categories: Vec<String>,
    pub client_side: Option<String>,
    pub server_side: Option<String>,
    pub body: Option<String>,
    pub downloads: i64,
    pub followers: i64,
    pub icon_url: Option<String>,
    #[serde(rename = "id")]
    pub project_id: String,
    pub project_type: Option<String>,
    pub team: Option<String>,
    pub versions: Vec<String>,
    pub date_created: Option<String>,
    pub date_modified: Option<String>,
    pub published: Option<String>,
    pub updated: Option<String>,
    pub gallery: Vec<GalleryImage>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub license: Option<License>,
    pub issues_url: Option<String>,
    pub source_url: Option<String>,
    pub wiki_url: Option<String>,
    pub discord_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArchivedProfile {
    pub id: String,
    pub name: String,
    pub version: String,
    pub loader: String,
    pub loader_version: String,
    pub icon: Option<String>,
    pub archived_at: String,
    pub mods: Vec<ArchivedMod>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArchivedMod {
    pub name: String,
    pub version_id: String,
    pub download_url: String,
    pub filename: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GalleryImage {
    pub url: String,
    pub raw_url: Option<String>,
    pub featured: bool,
    pub title: Option<String>,
    pub description: Option<String>,
    pub created: String,
    pub ordering: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct License {
    pub id: String,
    pub name: String,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthVersion {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub version_number: String,
    pub changelog: Option<String>,
    pub date_published: String,
    pub downloads: i64,
    pub version_type: String,
    pub files: Vec<ModrinthFile>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub featured: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthFile {
    pub url: String,
    pub filename: String,
    pub primary: bool,
    pub size: i64,
    pub file_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthSearchResult {
    pub hits: Vec<ModrinthSearchHit>,
    pub offset: i32,
    pub limit: i32,
    pub total_hits: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModrinthSearchHit {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub categories: Vec<String>,
    pub client_side: String,
    pub server_side: String,
    pub project_type: String,
    pub downloads: i64,
    pub follows: i64,
    pub icon_url: Option<String>,
    pub project_id: String,
    pub author: String,
    pub versions: Vec<String>,
    pub date_created: String,
    pub date_modified: String,
    pub latest_version: Option<String>,
    pub license: String,
    pub gallery: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedMod {
    pub id: String,
    pub name: String,
    pub description: String,
    pub body: Option<String>,
    pub author: String,
    pub downloads: i64,
    pub followers: Option<i64>,
    pub icon_url: Option<String>,
    pub source: String,
    pub categories: Vec<String>,
    pub versions: Vec<String>,
    pub date_created: String,
    pub date_modified: String,
    pub gallery: Vec<GalleryImage>,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub issues_url: Option<String>,
    pub source_url: Option<String>,
    pub wiki_url: Option<String>,
    pub discord_url: Option<String>,
    // Server-specific fields
    pub project_type: Option<String>,
    pub players_online: Option<i64>,
    pub supported_versions: Option<Vec<String>>,
    pub recommended_version: Option<String>,
}
