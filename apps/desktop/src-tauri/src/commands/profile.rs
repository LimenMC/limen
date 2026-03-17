use crate::{api::ModrinthApi, AppError, ArchivedProfile};
use crate::minecraft::MinecraftLauncher;
use tauri::Emitter;
use std::io::{Write, Read};
use sha1::{Sha1, Digest};

fn extract_mod_metadata(jar_path: &std::path::Path) -> Option<(String, String)> {
    use std::io::Read;
    
    let file = std::fs::File::open(jar_path).ok()?;
    let mut archive = zip::ZipArchive::new(file).ok()?;
    
    if let Ok(mut fabric_file) = archive.by_name("fabric.mod.json") {
        let mut contents = String::new();
        if fabric_file.read_to_string(&mut contents).is_ok() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
                if let (Some(mod_id), Some(mod_version)) = (
                    json.get("id").and_then(|v| v.as_str()),
                    json.get("version").and_then(|v| v.as_str())
                ) {
                    return Some((mod_id.to_string(), mod_version.to_string()));
                }
            }
        }
    }
    
    if let Ok(mut quilt_file) = archive.by_name("quilt.mod.json") {
        let mut contents = String::new();
        if quilt_file.read_to_string(&mut contents).is_ok() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
                if let Some(quilt_loader) = json.get("quilt_loader") {
                    if let (Some(mod_id), Some(mod_version)) = (
                        quilt_loader.get("id").and_then(|v| v.as_str()),
                        quilt_loader.get("version").and_then(|v| v.as_str())
                    ) {
                        return Some((mod_id.to_string(), mod_version.to_string()));
                    }
                }
            }
        }
    }
    
    None
}

#[tauri::command]
pub async fn export_profile_mrpack(
    profile_id: String,
    profile_name: String,
    version: String,
    loader: String,
    loader_version: String,
    _icon: Option<String>,
    export_path: String,
) -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    let api = ModrinthApi::new();
    
    let instance_dir = config.get_instance_dir(&profile_id);
    let mods_dir = instance_dir.join("mods");
    
    let mut mod_files = Vec::new();
    
    if mods_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("jar") {
                    if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                        let file_bytes = std::fs::read(&path)?;
                        let mut hasher = Sha1::new();
                        hasher.update(&file_bytes);
                        let hash = format!("{:x}", hasher.finalize());
                        
                        if let Ok(version_info) = api.get_version_from_hash(&hash).await {
                            if let Some(file) = version_info.files.iter().find(|f| f.primary) {
                                mod_files.push(serde_json::json!({
                                    "path": format!("mods/{}", filename),
                                    "hashes": {
                                        "sha1": hash,
                                        "sha512": ""
                                    },
                                    "env": {
                                        "client": "required",
                                        "server": "required"
                                    },
                                    "downloads": [file.url.clone()],
                                    "fileSize": file_bytes.len()
                                }));
                            }
                        }
                    }
                }
            }
        }
    }
    
    let index = serde_json::json!({
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": format!("{}-1.0.0", profile_id),
        "name": profile_name,
        "summary": format!("Exported from Limen - {} {}", version, loader),
        "files": mod_files,
        "dependencies": {
            "minecraft": version,
            loader: loader_version
        }
    });
    
    let mrpack_path = std::path::Path::new(&export_path);
    let file = std::fs::File::create(mrpack_path)?;
    let mut zip = zip::ZipWriter::new(file);
    
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    
    zip.start_file("modrinth.index.json", options)?;
    zip.write_all(serde_json::to_string_pretty(&index)?.as_bytes())?;
    
    let folders_to_include = ["config", "saves", "resourcepacks", "shaderpacks", "options.txt"];
    
    for folder_name in folders_to_include {
        if folder_name.contains("..") || folder_name.contains('/') || folder_name.contains('\\') {
            continue;
        }
        
        let folder_path = instance_dir.join(folder_name);
        
        if !folder_path.starts_with(&instance_dir) {
            continue;
        }
        
        if folder_path.exists() {
            if folder_path.is_file() {
                let file_bytes = std::fs::read(&folder_path)?;
                zip.start_file(format!("overrides/{}", folder_name), options)?;
                zip.write_all(&file_bytes)?;
            } else {
                add_directory_to_zip(&mut zip, &folder_path, &format!("overrides/{}", folder_name), options)?;
            }
        }
    }
    
    zip.finish()?;
    
    Ok(mrpack_path.to_string_lossy().to_string())
}

fn add_directory_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    dir_path: &std::path::Path,
    prefix: &str,
    options: zip::write::SimpleFileOptions,
) -> Result<(), AppError> {
    use std::io::Write;
    
    if let Ok(entries) = std::fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap().to_string_lossy();
            let zip_path = format!("{}/{}", prefix, name);
            
            if path.is_file() {
                zip.start_file(&zip_path, options)?;
                let file_bytes = std::fs::read(&path)?;
                zip.write_all(&file_bytes)?;
            } else if path.is_dir() {
                add_directory_to_zip(zip, &path, &zip_path, options)?;
            }
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn archive_profile(
    profile_id: String,
    profile_name: String,
    version: String,
    loader: String,
    loader_version: String,
    icon: Option<String>,
) -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let safe_name = profile_name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let mrpack_filename = format!("{}.mrpack", safe_name);
    let mrpack_path = config.archive_dir.join(&mrpack_filename);
    
    export_profile_mrpack(
        profile_id.clone(),
        profile_name,
        version,
        loader,
        loader_version,
        icon,
        mrpack_path.to_string_lossy().to_string(),
    ).await?;
    
    let instance_dir = config.get_instance_dir(&profile_id);
    if instance_dir.exists() {
        std::fs::remove_dir_all(&instance_dir)?;
    }
    
    Ok(mrpack_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_archived_profiles() -> Result<Vec<ArchivedProfile>, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let mut profiles = Vec::new();
    
    if config.archive_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&config.archive_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("mrpack") {
                    if let Ok(file) = std::fs::File::open(&path) {
                        if let Ok(mut archive) = zip::ZipArchive::new(file) {
                            if let Ok(mut index_file) = archive.by_name("modrinth.index.json") {
                                let mut contents = String::new();
                                if index_file.read_to_string(&mut contents).is_ok() {
                                    if let Ok(index) = serde_json::from_str::<serde_json::Value>(&contents) {
                                        let name = index.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                                        let version_id = index.get("versionId").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                        
                                        let profile_id = version_id.split('-').next().unwrap_or(&version_id).to_string();
                                        
                                        let dependencies = index.get("dependencies").and_then(|v| v.as_object());
                                        let mc_version = dependencies.and_then(|d| d.get("minecraft")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                                        
                                        let (loader, loader_version) = if let Some(deps) = dependencies {
                                            if let Some(fabric) = deps.get("fabric-loader").and_then(|v| v.as_str()) {
                                                ("fabric".to_string(), fabric.to_string())
                                            } else if let Some(forge) = deps.get("forge").and_then(|v| v.as_str()) {
                                                ("forge".to_string(), forge.to_string())
                                            } else if let Some(quilt) = deps.get("quilt-loader").and_then(|v| v.as_str()) {
                                                ("quilt".to_string(), quilt.to_string())
                                            } else if let Some(neoforge) = deps.get("neoforge").and_then(|v| v.as_str()) {
                                                ("neoforge".to_string(), neoforge.to_string())
                                            } else {
                                                ("vanilla".to_string(), String::new())
                                            }
                                        } else {
                                            ("vanilla".to_string(), String::new())
                                        };
                                        
                                        let archived_at = if let Ok(metadata) = std::fs::metadata(&path) {
                                            if let Ok(modified) = metadata.modified() {
                                                chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339()
                                            } else {
                                                chrono::Utc::now().to_rfc3339()
                                            }
                                        } else {
                                            chrono::Utc::now().to_rfc3339()
                                        };
                                        
                                        profiles.push(ArchivedProfile {
                                            id: profile_id,
                                            name,
                                            version: mc_version,
                                            loader,
                                            loader_version,
                                            icon: None,
                                            archived_at,
                                            mods: Vec::new(),
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(profiles)
}

#[tauri::command]
pub async fn restore_profile(profile_id: String, app: tauri::AppHandle) -> Result<ArchivedProfile, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let mut mrpack_info: Option<(std::path::PathBuf, String, String, String, String)> = None;
    
    if config.archive_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&config.archive_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("mrpack") {
                    // Check if this mrpack contains our profile
                    if let Ok(file) = std::fs::File::open(&path) {
                        if let Ok(mut archive) = zip::ZipArchive::new(file) {
                            if let Ok(mut index_file) = archive.by_name("modrinth.index.json") {
                                let mut contents = String::new();
                                if index_file.read_to_string(&mut contents).is_ok() {
                                    if let Ok(index) = serde_json::from_str::<serde_json::Value>(&contents) {
                                        let version_id = index.get("versionId").and_then(|v| v.as_str()).unwrap_or("");
                                        let id = version_id.split('-').next().unwrap_or("");
                                        if id == profile_id {
                                            let name = index.get("name").and_then(|v| v.as_str()).unwrap_or("Restored Profile").to_string();
                                            let dependencies = index.get("dependencies").and_then(|v| v.as_object());
                                            let mc_version = dependencies.and_then(|d| d.get("minecraft")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                                            
                                            let (loader, loader_version) = if let Some(deps) = dependencies {
                                                if let Some(fabric) = deps.get("fabric-loader").and_then(|v| v.as_str()) {
                                                    ("fabric".to_string(), fabric.to_string())
                                                } else if let Some(forge) = deps.get("forge").and_then(|v| v.as_str()) {
                                                    ("forge".to_string(), forge.to_string())
                                                } else if let Some(quilt) = deps.get("quilt-loader").and_then(|v| v.as_str()) {
                                                    ("quilt".to_string(), quilt.to_string())
                                                } else if let Some(neoforge) = deps.get("neoforge").and_then(|v| v.as_str()) {
                                                    ("neoforge".to_string(), neoforge.to_string())
                                                } else {
                                                    ("vanilla".to_string(), String::new())
                                                }
                                            } else {
                                                ("vanilla".to_string(), String::new())
                                            };
                                            
                                            mrpack_info = Some((path.clone(), name, mc_version, loader, loader_version));
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    let (mrpack_path, name, mc_version, loader, loader_version) = mrpack_info.ok_or_else(|| AppError::InvalidParam("Archived profile not found".to_string()))?;
    
    let instance_dir = config.get_instance_dir(&profile_id);
    std::fs::create_dir_all(&instance_dir)?;
    
    let file = std::fs::File::open(&mrpack_path)?;
    let mut archive = zip::ZipArchive::new(file)?;
    
    let index_contents = {
        let mut index_file = archive.by_name("modrinth.index.json")?;
        let mut contents = String::new();
        index_file.read_to_string(&mut contents)?;
        contents
    };
    
    let index: serde_json::Value = serde_json::from_str(&index_contents)?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = if let Some(enclosed_name) = file.enclosed_name() {
            if enclosed_name.starts_with("overrides/") {
                let relative = enclosed_name.strip_prefix("overrides/").unwrap();
                
                if relative.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
                    return Err(AppError::InvalidParam("Path traversal detected in archive".to_string()));
                }
                
                let outpath = instance_dir.join(relative);
                
                if !outpath.starts_with(&instance_dir) {
                    return Err(AppError::InvalidParam("Path traversal detected in archive".to_string()));
                }
                
                outpath
            } else {
                continue;
            }
        } else {
            continue;
        };
        
        if file.is_dir() {
            std::fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                std::fs::create_dir_all(p)?;
            }
            let mut outfile = std::fs::File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
        }
    }
    
    let mods_dir = instance_dir.join("mods");
    std::fs::create_dir_all(&mods_dir)?;
    
    if let Some(files) = index.get("files").and_then(|f| f.as_array()) {
        let total = files.len();
        for (idx, file_entry) in files.iter().enumerate() {
            if let Some(downloads) = file_entry.get("downloads").and_then(|d| d.as_array()) {
                if let Some(url) = downloads.first().and_then(|u| u.as_str()) {
                    let path = file_entry.get("path").and_then(|p| p.as_str()).unwrap_or("");
                    let filename = std::path::Path::new(path).file_name().and_then(|n| n.to_str()).unwrap_or("mod.jar");
                    
                    let _ = app.emit("download-progress", serde_json::json!({
                        "message": format!("Downloading mod {}/{}", idx + 1, total),
                        "progress": ((idx + 1) as f32 / total as f32 * 100.0) as u32,
                    }));
                    
                    let client = reqwest::Client::builder()
                        .user_agent("Limen/1.0")
                        .timeout(std::time::Duration::from_secs(300))
                        .build()?;
                    
                    if let Ok(response) = client.get(url).send().await {
                        if response.status().is_success() {
                            if let Ok(bytes) = response.bytes().await {
                                let file_path = mods_dir.join(filename);
                                std::fs::write(&file_path, bytes)?;
                            }
                        }
                    }
                }
            }
        }
    }
    
    let profile = ArchivedProfile {
        id: profile_id.clone(),
        name,
        version: mc_version,
        loader,
        loader_version,
        icon: None,
        archived_at: String::new(),
        mods: Vec::new(),
    };
    
    std::fs::remove_file(&mrpack_path)?;
    
    Ok(profile)
}

#[tauri::command]
pub async fn delete_archived_profile(profile_id: String) -> Result<(), AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let mut file_to_delete: Option<std::path::PathBuf> = None;
    
    if config.archive_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&config.archive_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("mrpack") {
                    // Check if this mrpack contains our profile
                    if let Ok(file) = std::fs::File::open(&path) {
                        if let Ok(mut archive) = zip::ZipArchive::new(file) {
                            if let Ok(mut index_file) = archive.by_name("modrinth.index.json") {
                                let mut contents = String::new();
                                if index_file.read_to_string(&mut contents).is_ok() {
                                    if let Ok(index) = serde_json::from_str::<serde_json::Value>(&contents) {
                                        let version_id = index.get("versionId").and_then(|v| v.as_str()).unwrap_or("");
                                        let id = version_id.split('-').next().unwrap_or("");
                                        if id == profile_id {
                                            file_to_delete = Some(path.clone());
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    if let Some(path) = file_to_delete {
        std::fs::remove_file(&path)?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn scan_profile_mods(profile_id: String) -> Result<Vec<serde_json::Value>, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let instance_dir = config.get_instance_dir(&profile_id);
    let mods_dir = instance_dir.join("mods");
    
    let mut mods = Vec::new();
    
    if mods_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("jar") {
                    if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                        let (mod_id, mod_version) = extract_mod_metadata(&path).unwrap_or_default();
                        
                        let mod_name = if !mod_id.is_empty() {
                            mod_id.clone()
                        } else {
                            filename.trim_end_matches(".jar").to_string()
                        };
                        
                        mods.push(serde_json::json!({
                            "id": mod_id,
                            "name": mod_name,
                            "version": mod_version,
                            "icon_url": null,
                            "type": "mod"
                        }));
                    }
                }
            }
        }
    }
    
    Ok(mods)
}
