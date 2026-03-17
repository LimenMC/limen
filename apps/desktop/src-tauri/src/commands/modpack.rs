use crate::{api::ModrinthApi, AppError};
use crate::minecraft::MinecraftLauncher;
use tauri::Emitter;
use std::fs;

#[derive(serde::Serialize)]
pub struct ModpackInstallResult {
    pub message: String,
    pub installed_mods: Vec<serde_json::Value>,
}

#[tauri::command]
pub async fn install_modpack(
    modpack_id: String,
    modpack_name: String,
    profile_id: String,
    app: tauri::AppHandle,
) -> Result<ModpackInstallResult, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let api = ModrinthApi::new();
    let versions = api.get_project_versions(&modpack_id, None, None).await?;
    
    if versions.is_empty() {
        return Err(AppError::InvalidParam("No versions found for modpack".to_string()));
    }
    
    let latest_version = &versions[0];
    
    let mrpack_file = latest_version.files.iter()
        .find(|f| f.filename.ends_with(".mrpack"))
        .ok_or_else(|| AppError::InvalidParam("No .mrpack file found".to_string()))?;
    
    let _ = app.emit("download-progress", serde_json::json!({
        "message": format!("Downloading modpack: {}", modpack_name),
        "progress": 10,
    }));
    
    let client = reqwest::Client::builder()
        .user_agent("Limen/1.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()?;
    
    let response = client.get(&mrpack_file.url).send().await?;
    if !response.status().is_success() {
        return Err(AppError::NetworkError(format!("Failed to download modpack: {}", response.status())));
    }
    
    let mrpack_bytes = response.bytes().await?;
    
    let _ = app.emit("download-progress", serde_json::json!({
        "message": "Extracting modpack...",
        "progress": 30,
    }));
    
    let profile_dir = config.get_instance_dir(&profile_id);
    
    let files_to_download = {
        use std::io::Read;
        
        let cursor = std::io::Cursor::new(mrpack_bytes);
        let mut archive = zip::ZipArchive::new(cursor)?;
        
        let mut index_file = archive.by_name("modrinth.index.json")
            .map_err(|_| AppError::InvalidParam("Invalid modpack format".to_string()))?;
        
        let mut index_content = String::new();
        index_file.read_to_string(&mut index_content)?;
        drop(index_file);
        
        let index: serde_json::Value = serde_json::from_str(&index_content)?;
        
        let files = index.get("files")
            .and_then(|f| f.as_array())
            .ok_or_else(|| AppError::InvalidParam("No files in modpack".to_string()))?
            .clone();
        
        std::fs::create_dir_all(&profile_dir)?;
        
        let _ = app.emit("download-progress", serde_json::json!({
            "message": "Extracting overrides...",
            "progress": 40,
        }));
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let file_path = file.name().to_string();
            let is_dir = file.is_dir();
            
            if file_path.starts_with("overrides/") {
                if let Some(relative_path) = file_path.strip_prefix("overrides/") {
                    if !relative_path.is_empty() && !is_dir {
                        let relative = std::path::Path::new(relative_path);
                        if relative.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
                            continue;
                        }
                        
                        let dest_path = profile_dir.join(relative_path);
                        
                        if !dest_path.starts_with(&profile_dir) {
                            continue;
                        }
                        
                        if let Some(parent) = dest_path.parent() {
                            std::fs::create_dir_all(parent)?;
                        }
                        let mut dest_file = std::fs::File::create(&dest_path)?;
                        std::io::copy(&mut file, &mut dest_file)?;
                    }
                }
            }
            
            if file_path.starts_with("client-overrides/") {
                if let Some(relative_path) = file_path.strip_prefix("client-overrides/") {
                    if !relative_path.is_empty() && !is_dir {
                        let relative = std::path::Path::new(relative_path);
                        if relative.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
                            continue;
                        }
                        
                        let dest_path = profile_dir.join(relative_path);
                        
                        if !dest_path.starts_with(&profile_dir) {
                            continue;
                        }
                        
                        if let Some(parent) = dest_path.parent() {
                            std::fs::create_dir_all(parent)?;
                        }
                        let mut dest_file = std::fs::File::create(&dest_path)?;
                        std::io::copy(&mut file, &mut dest_file)?;
                    }
                }
            }
        }
        
        files
    };
    
    let total_files = files_to_download.len();
    let mut installed_mods = Vec::new();
    
    let profile_mods_dir = config.get_profile_dir(&profile_id);
    fs::create_dir_all(&profile_mods_dir)?;
    let mods_file = profile_mods_dir.join("installed_mods.json");
    
    for (index, file_obj) in files_to_download.iter().enumerate() {
        let path = file_obj.get("path")
            .and_then(|p| p.as_str())
            .unwrap_or("");
        
        let downloads = file_obj.get("downloads")
            .and_then(|d| d.as_array())
            .and_then(|arr| arr.first())
            .and_then(|url| url.as_str());
        
        if let Some(download_url) = downloads {
            let _ = app.emit("download-progress", serde_json::json!({
                "message": format!("Downloading file {}/{}: {}", index + 1, total_files, path),
                "progress": 40 + ((index + 1) as f32 / total_files as f32 * 50.0) as u32,
            }));
            
            match client.get(download_url).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        if let Ok(bytes) = response.bytes().await {
                            let dest_path = profile_dir.join(path);
                            if let Some(parent) = dest_path.parent() {
                                std::fs::create_dir_all(parent)?;
                            }
                            std::fs::write(&dest_path, bytes)?;
                            
                            if path.starts_with("mods/") && path.ends_with(".jar") {
                                let filename = path.strip_prefix("mods/").unwrap_or(path);
                                let mod_name = filename.trim_end_matches(".jar").to_string();
                                
                                let mut mod_id = String::new();
                                let mut mod_display_name = mod_name.clone();
                                let mut icon_url: Option<String> = None;
                                
                                if let Some(hashes) = file_obj.get("hashes").and_then(|h| h.as_object()) {
                                    if let Some(sha1) = hashes.get("sha1").and_then(|s| s.as_str()) {
                                        if let Ok(version_info) = api.get_version_from_hash(sha1).await {
                                            mod_id = version_info.project_id.clone();
                                            
                                            if let Ok(project) = api.get_project(&version_info.project_id).await {
                                                mod_display_name = project.title;
                                                icon_url = project.icon_url;
                                            }
                                        }
                                    }
                                }
                                
                                installed_mods.push(serde_json::json!({
                                    "id": if mod_id.is_empty() { mod_name.clone() } else { mod_id },
                                    "name": mod_display_name,
                                    "version": filename,
                                    "icon_url": icon_url,
                                    "type": "mod"
                                }));
                                
                                let json = serde_json::to_string_pretty(&installed_mods)?;
                                fs::write(&mods_file, json)?;
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to download file {}: {}", path, e);
                }
            }
        }
    }
    
    let _ = app.emit("download-progress", serde_json::json!({
        "message": "Modpack installed successfully!",
        "progress": 100,
    }));
    
    Ok(ModpackInstallResult {
        message: format!("Modpack {} installed successfully", modpack_name),
        installed_mods,
    })
}
