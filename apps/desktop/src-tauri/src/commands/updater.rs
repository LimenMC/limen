use crate::AppError;
use serde::{Deserialize, Serialize};
use once_cell::sync::Lazy;
use std::time::{SystemTime, Duration, UNIX_EPOCH};
use std::path::PathBuf;
use std::fs;

static UPDATER_HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Limen-Launcher")
        .timeout(Duration::from_secs(30))
        .https_only(true)
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .build()
        .expect("Failed to build updater HTTP client")
});

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: Option<String>,
    pub release_notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct UpdateCache {
    last_check: u64, // Unix timestamp
    cached_info: UpdateInfo,
}

fn get_cache_path() -> PathBuf {
    let mut path = dirs::cache_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("limen");
    path.push("update_cache.json");
    path
}

fn load_update_cache() -> Option<UpdateCache> {
    let path = get_cache_path();
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn save_update_cache(info: &UpdateInfo) -> Result<(), AppError> {
    let cache = UpdateCache {
        last_check: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        cached_info: info.clone(),
    };
    
    let path = get_cache_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    
    let content = serde_json::to_string(&cache)?;
    fs::write(path, content)?;
    Ok(())
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, AppError> {
    let current_version = env!("CARGO_PKG_VERSION");
    
    if let Some(cached) = load_update_cache() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        if now - cached.last_check < 6 * 3600 {
            return Ok(cached.cached_info);
        }
    }
    
    let url = "https://api.github.com/repos/LimenMC/limen/releases/latest";
    
    match UPDATER_HTTP_CLIENT
        .get(url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await {
        Ok(response) => {
            if response.status().is_success() {
                let release: serde_json::Value = response.json().await?;
                
                let latest_version = release["tag_name"]
                    .as_str()
                    .unwrap_or("")
                    .trim_start_matches('v');
                
                // Platform-specific asset selection
                let platform_suffix = if cfg!(target_os = "windows") {
                    ".msi"
                } else if cfg!(target_os = "macos") {
                    ".dmg"
                } else {
                    ".AppImage"
                };
                
                let download_url = release["assets"]
                    .as_array()
                    .and_then(|assets| {
                        // Try to find platform-specific asset first
                        assets.iter()
                            .find(|asset| {
                                asset["name"]
                                    .as_str()
                                    .map(|name| name.ends_with(platform_suffix))
                                    .unwrap_or(false)
                            })
                            .or_else(|| assets.first())
                    })
                    .and_then(|asset| asset["browser_download_url"].as_str())
                    .map(String::from);
                
                let release_notes = release["body"]
                    .as_str()
                    .map(String::from);
                
                let available = is_newer_version(current_version, latest_version);
                
                let info = UpdateInfo {
                    available,
                    current_version: current_version.to_string(),
                    latest_version: latest_version.to_string(),
                    download_url,
                    release_notes,
                };
                
                let _ = save_update_cache(&info);
                
                Ok(info)
            } else {
                // No update available or API error
                Ok(UpdateInfo {
                    available: false,
                    current_version: current_version.to_string(),
                    latest_version: current_version.to_string(),
                    download_url: None,
                    release_notes: None,
                })
            }
        }
        Err(e) => {
            eprintln!("Failed to check for updates: {}", e);
            Ok(UpdateInfo {
                available: false,
                current_version: current_version.to_string(),
                latest_version: current_version.to_string(),
                download_url: None,
                release_notes: Some("Unable to check for updates. Please check your internet connection.".to_string()),
            })
        }
    }
}

fn is_newer_version(current: &str, latest: &str) -> bool {
    let current_parts: Vec<u32> = current
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    
    let latest_parts: Vec<u32> = latest
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    
    for i in 0..3 {
        let current_part = current_parts.get(i).unwrap_or(&0);
        let latest_part = latest_parts.get(i).unwrap_or(&0);
        
        if latest_part > current_part {
            return true;
        } else if latest_part < current_part {
            return false;
        }
    }
    
    false
}

#[tauri::command]
pub async fn download_update(download_url: String) -> Result<String, AppError> {
    let url = url::Url::parse(&download_url)
        .map_err(|_| AppError::InvalidParam("Invalid URL".to_string()))?;
    
    if url.scheme() != "https" {
        return Err(AppError::InvalidParam("Only HTTPS URLs allowed for security".to_string()));
    }
    
    let allowed_domains = ["github.com", "api.github.com", "objects.githubusercontent.com"];
    let host = url.host_str().ok_or_else(|| AppError::InvalidParam("Invalid URL host".to_string()))?;
    
    if !allowed_domains.iter().any(|d| host == *d || host.ends_with(&format!(".{}", d))) {
        return Err(AppError::InvalidParam("Updates can only be downloaded from GitHub".to_string()));
    }
    
    let validated_url = url.to_string();
    
    let _ = tauri::async_runtime::spawn(async move {
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("cmd")
                .args(&["/C", "start", &validated_url])
                .spawn();
        }
        
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open")
                .arg(&validated_url)
                .spawn();
        }
        
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open")
                .arg(&validated_url)
                .spawn();
        }
    });
    
    Ok("Download started in browser".to_string())
}
