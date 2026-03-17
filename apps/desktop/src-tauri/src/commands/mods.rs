use crate::{api::ModrinthApi, AppError, UnifiedMod};

#[tauri::command]
pub async fn search_mods(
    query: String,
    source: Option<String>,
    project_type: Option<String>,
    facets: Option<String>,
    index: Option<String>,
    game_version: Option<String>,
    loader: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<UnifiedMod>, AppError> {
    let source = source.unwrap_or_else(|| "modrinth".to_string());
    
    match source.as_str() {
        "modrinth" => {
            let api = ModrinthApi::new();
            
            let facets_array: Option<Vec<Vec<String>>> = if let Some(facets_str) = facets {
                serde_json::from_str(&facets_str).ok()
            } else {
                let mut facets_vec: Vec<Vec<String>> = Vec::new();
                
                if let Some(ptype) = project_type {
                    if ptype != "all" {
                        facets_vec.push(vec![format!("project_type:{}", ptype)]);
                    }
                }
                
                if let Some(version) = game_version {
                    facets_vec.push(vec![format!("versions:{}", version)]);
                }
                
                if let Some(ldr) = loader {
                    if !ldr.is_empty() && ldr != "vanilla" {
                        facets_vec.push(vec![format!("categories:{}", ldr)]);
                    }
                }
                
                if facets_vec.is_empty() {
                    None
                } else {
                    Some(facets_vec)
                }
            };
            
            let result = api.search_mods(&query, facets_array, index, limit, offset).await?;
            
            let is_server_search = result.hits.iter().any(|hit| hit.project_type == "minecraft_java_server");
            
            let mut mods: Vec<UnifiedMod> = result.hits.iter().map(|hit| {
                UnifiedMod {
                    id: hit.project_id.clone(),
                    name: hit.title.clone(),
                    description: hit.description.clone(),
                    body: None,
                    author: hit.author.clone(),
                    downloads: hit.downloads,
                    followers: Some(hit.follows),
                    icon_url: hit.icon_url.clone(),
                    source: "modrinth".to_string(),
                    categories: hit.categories.clone(),
                    versions: hit.versions.clone(),
                    date_created: hit.date_created.clone(),
                    date_modified: hit.date_modified.clone(),
                    gallery: hit.gallery.iter().map(|url| crate::GalleryImage {
                        url: url.clone(),
                        raw_url: Some(url.clone()),
                        featured: false,
                        title: None,
                        description: None,
                        created: String::new(),
                        ordering: 0,
                    }).collect(),
                    game_versions: vec![],
                    loaders: vec![],
                    issues_url: None,
                    source_url: None,
                    wiki_url: None,
                    discord_url: None,
                    project_type: Some(hit.project_type.clone()),
                    players_online: None,
                    supported_versions: None,
                    recommended_version: None,
                }
            }).collect();
            
            if is_server_search {
                use futures::future::join_all;
                use tokio::time::{timeout, Duration};
                
                let server_ids: Vec<_> = mods.iter()
                    .enumerate()
                    .filter(|(_, m)| m.project_type.as_deref() == Some("minecraft_java_server"))
                    .map(|(idx, m)| (idx, m.id.clone()))
                    .collect();
                
                let fetch_tasks = server_ids.iter().map(|(idx, id)| {
                    let api = api.clone();
                    let id = id.clone();
                    let idx = *idx;
                    async move {
                        match timeout(Duration::from_millis(500), api.get_server_details(&id)).await {
                            Ok(Ok(data)) => Some((idx, data)),
                            _ => None,
                        }
                    }
                });
                
                let results = join_all(fetch_tasks).await;
                
                for result in results.into_iter().flatten() {
                    let (idx, server_data) = result;
                    if let Some(mod_entry) = mods.get_mut(idx) {
                        if let Some(java_server) = server_data.get("minecraft_java_server") {
                            if let Some(ping) = java_server.get("ping") {
                                if let Some(data) = ping.get("data") {
                                    if let Some(online) = data.get("players_online") {
                                        mod_entry.players_online = online.as_i64();
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            Ok(mods)
        }
        _ => Err(AppError::InvalidParam("Invalid source".to_string())),
    }
}

#[tauri::command]
pub async fn get_mod_details(
    mod_id: String,
    source: String,
) -> Result<UnifiedMod, AppError> {
    match source.as_str() {
        "modrinth" => {
            let api = ModrinthApi::new();
            let project = api.get_project(&mod_id).await?;
            
            let mut players_online = None;
            let mut supported_versions = None;
            let mut recommended_version = None;
            let project_type_str = project.project_type.clone().unwrap_or_default();
            
            if project_type_str == "minecraft_java_server" {
                if let Ok(server_data) = api.get_server_details(&mod_id).await {
                    if let Some(java_server) = server_data.get("minecraft_java_server") {
                        if let Some(ping) = java_server.get("ping") {
                            if let Some(data) = ping.get("data") {
                                if let Some(online) = data.get("players_online") {
                                    players_online = online.as_i64();
                                }
                            }
                        }
                        
                        if let Some(content) = java_server.get("content") {
                            if let Some(versions) = content.get("supported_game_versions") {
                                if let Some(versions_array) = versions.as_array() {
                                    supported_versions = Some(
                                        versions_array
                                            .iter()
                                            .filter_map(|v| v.as_str().map(String::from))
                                            .collect()
                                    );
                                }
                            }
                            if let Some(recommended) = content.get("recommended_game_version") {
                                recommended_version = recommended.as_str().map(String::from);
                            }
                        }
                    }
                }
            }
            
            Ok(UnifiedMod {
                id: project.project_id,
                name: project.title,
                description: project.description,
                body: project.body,
                author: project.team.unwrap_or_else(|| "Unknown".to_string()),
                downloads: project.downloads,
                followers: Some(project.followers),
                icon_url: project.icon_url,
                source: "modrinth".to_string(),
                categories: project.categories,
                versions: project.versions,
                date_created: project.date_created.unwrap_or_default(),
                date_modified: project.updated.unwrap_or_else(|| project.date_modified.unwrap_or_default()),
                gallery: project.gallery,
                game_versions: project.game_versions,
                loaders: project.loaders,
                issues_url: project.issues_url,
                source_url: project.source_url,
                wiki_url: project.wiki_url,
                discord_url: project.discord_url,
                project_type: project.project_type,
                players_online,
                supported_versions,
                recommended_version,
            })
        }
        _ => Err(AppError::InvalidParam("Invalid source".to_string())),
    }
}

#[tauri::command]
pub async fn get_mod_versions(
    mod_id: String,
    source: String,
    loaders: Option<Vec<String>>,
    game_versions: Option<Vec<String>>,
) -> Result<Vec<crate::ModrinthVersion>, AppError> {
    match source.as_str() {
        "modrinth" => {
            let api = ModrinthApi::new();
            let versions = api.get_project_versions(&mod_id, loaders, game_versions).await?;
            Ok(versions)
        }
        _ => Err(AppError::InvalidParam("Invalid source".to_string())),
    }
}

#[tauri::command]
pub async fn download_mod(
    download_url: String,
    filename: String,
    destination: String,
) -> Result<String, AppError> {
    let dest_path = std::path::Path::new(&destination);
    std::fs::create_dir_all(dest_path)?;
    
    let client = reqwest::Client::builder()
        .user_agent("Limen/1.0")
        .timeout(std::time::Duration::from_secs(300))
        .build()?;
    
    let response = client.get(&download_url).send().await?;
    
    if !response.status().is_success() {
        return Err(AppError::NetworkError(format!("Download failed: {}", response.status())));
    }
    
    let bytes = response.bytes().await?;
    let file_path = dest_path.join(&filename);
    
    std::fs::write(&file_path, bytes)?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn remove_mod(
    profile_id: String,
    mod_id: String,
    filename: String,
) -> Result<(), AppError> {
    use crate::minecraft::config::LimenConfig;
    
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let profile_dir = config.get_profile_dir(&profile_id);
    let mod_file = profile_dir.join("mods").join(&filename);
    
    if mod_file.exists() {
        std::fs::remove_file(&mod_file)
            .map_err(|e| AppError::FileError(format!("Failed to delete mod file: {}", e)))?;
    }
    
    let mods_file = profile_dir.join("installed_mods.json");
    if mods_file.exists() {
        let content = std::fs::read_to_string(&mods_file)
            .map_err(|e| AppError::FileError(format!("Failed to read mods file: {}", e)))?;
        
        let mut mods: Vec<serde_json::Value> = serde_json::from_str(&content)
            .map_err(|e| AppError::FileError(format!("Failed to parse mods file: {}", e)))?;
        
        mods.retain(|mod_obj| {
            mod_obj.get("id").and_then(|id| id.as_str()) != Some(&mod_id)
        });
        
        let json = serde_json::to_string_pretty(&mods)
            .map_err(|e| AppError::FileError(format!("Failed to serialize mods: {}", e)))?;
        
        std::fs::write(&mods_file, json)
            .map_err(|e| AppError::FileError(format!("Failed to save mods file: {}", e)))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn scan_installed_mods(
    profile_id: String,
) -> Result<Vec<serde_json::Value>, AppError> {
    use crate::minecraft::config::LimenConfig;
    
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let profile_dir = config.get_profile_dir(&profile_id);
    let mods_dir = profile_dir.join("mods");
    
    if !mods_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut installed_mods = Vec::new();
    let api = ModrinthApi::new();
    
    let entries = std::fs::read_dir(&mods_dir)
        .map_err(|e| AppError::FileError(format!("Failed to read mods directory: {}", e)))?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("jar") {
                let filename = path.file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();
                
                let mod_name = filename.trim_end_matches(".jar").to_string();
                
                let mut mod_id = String::new();
                let mut mod_display_name = mod_name.clone();
                let mut icon_url: Option<String> = None;
                
                // Get mod info from Modrinth using SHA1 hash
                if let Ok(file_bytes) = std::fs::read(&path) {
                    use sha1::{Sha1, Digest};
                    let mut hasher = Sha1::new();
                    hasher.update(&file_bytes);
                    let hash = format!("{:x}", hasher.finalize());
                    
                    if let Ok(version_info) = api.get_version_from_hash(&hash).await {
                        mod_id = version_info.project_id.clone();
                        
                        if let Ok(project) = api.get_project(&version_info.project_id).await {
                            mod_display_name = project.title;
                            icon_url = project.icon_url;
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
            }
        }
    }
    
    let mods_file = profile_dir.join("installed_mods.json");
    let json = serde_json::to_string_pretty(&installed_mods)
        .map_err(|e| AppError::FileError(format!("Failed to serialize mods: {}", e)))?;
    
    std::fs::write(&mods_file, json)
        .map_err(|e| AppError::FileError(format!("Failed to save mods file: {}", e)))?;
    
    Ok(installed_mods)
}
