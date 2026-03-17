use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LimenConfig {
    pub limen_dir: PathBuf,
    pub minecraft_dir: PathBuf,
    pub profiles_dir: PathBuf,
    pub archive_dir: PathBuf,
    pub app_dir: PathBuf,
    pub versions_dir: PathBuf,
    pub libraries_dir: PathBuf,
    pub assets_dir: PathBuf,
}

impl LimenConfig {
    pub fn new() -> Result<Self, std::io::Error> {
        let home_dir = dirs::home_dir().ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::NotFound, "Home directory not found")
        })?;

        let limen_dir = home_dir.join(".limen");
        let minecraft_dir = limen_dir.join("minecraft");
        let profiles_dir = limen_dir.join("profiles");
        let archive_dir = limen_dir.join("archive");
        let app_dir = limen_dir.join("app");
        let versions_dir = minecraft_dir.join("versions");
        let libraries_dir = minecraft_dir.join("libraries");
        let assets_dir = minecraft_dir.join("assets");

        std::fs::create_dir_all(&minecraft_dir)?;
        std::fs::create_dir_all(&profiles_dir)?;
        std::fs::create_dir_all(&archive_dir)?;
        std::fs::create_dir_all(&app_dir)?;
        std::fs::create_dir_all(&versions_dir)?;
        std::fs::create_dir_all(&libraries_dir)?;
        std::fs::create_dir_all(&assets_dir)?;

        Ok(Self {
            limen_dir,
            minecraft_dir,
            profiles_dir,
            archive_dir,
            app_dir,
            versions_dir,
            libraries_dir,
            assets_dir,
        })
    }

    pub fn get_profile_dir(&self, profile_id: &str) -> PathBuf {
        self.profiles_dir.join(profile_id)
    }

    pub fn get_app_settings_file(&self) -> PathBuf {
        self.app_dir.join("settings.json")
    }

    pub fn get_profiles_file(&self) -> PathBuf {
        self.app_dir.join("profiles.json")
    }

    pub fn get_custom_skins_file(&self) -> PathBuf {
        self.app_dir.join("custom_skins.json")
    }

    #[allow(dead_code)]
    pub fn get_skin_cache_dir(&self) -> PathBuf {
        let dir = self.app_dir.join("skin_cache");
        std::fs::create_dir_all(&dir).ok();
        dir
    }

    #[allow(dead_code)]
    pub fn get_profile_mods_dir(&self, profile_id: &str) -> PathBuf {
        let dir = self.get_profile_dir(profile_id).join("mods");
        std::fs::create_dir_all(&dir).ok();
        dir
    }

    #[allow(dead_code)]
    pub fn get_profile_versions_dir(&self, profile_id: &str) -> PathBuf {
        let dir = self.get_profile_dir(profile_id).join("versions");
        std::fs::create_dir_all(&dir).ok();
        dir
    }

    #[allow(dead_code)]
    pub fn get_profile_libraries_dir(&self, profile_id: &str) -> PathBuf {
        let dir = self.get_profile_dir(profile_id).join("libraries");
        std::fs::create_dir_all(&dir).ok();
        dir
    }

    pub fn get_instance_dir(&self, instance_name: &str) -> PathBuf {
        self.get_profile_dir(instance_name)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionDetails {
    pub id: String,
    #[serde(rename = "type")]
    pub version_type: String,
    #[serde(rename = "mainClass")]
    pub main_class: String,
    #[serde(rename = "minecraftArguments", default)]
    pub minecraft_arguments: Option<String>,
    pub arguments: Option<Arguments>,
    pub libraries: Vec<Library>,
    pub downloads: Downloads,
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndex,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Arguments {
    pub game: Vec<serde_json::Value>,
    pub jvm: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    pub rules: Option<Vec<Rule>>,
    pub natives: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryDownloads {
    pub artifact: Option<Artifact>,
    pub classifiers: Option<std::collections::HashMap<String, Artifact>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Artifact {
    pub path: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Rule {
    pub action: String,
    pub os: Option<OsRule>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OsRule {
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Downloads {
    pub client: DownloadInfo,
    pub server: Option<DownloadInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadInfo {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssetIndex {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
}
