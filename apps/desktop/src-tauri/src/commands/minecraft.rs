use crate::{AppError, minecraft::MinecraftLauncher};
use tauri::Emitter;

#[tauri::command]
pub async fn get_minecraft_versions() -> Result<Vec<String>, AppError> {
    let launcher = MinecraftLauncher::new()?;
    launcher.get_versions().await
}

#[tauri::command]
pub async fn download_minecraft_version(version: String, app: tauri::AppHandle) -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    launcher.prepare_version(&version, Some(app)).await
}

#[tauri::command]
pub async fn launch_minecraft(
    version: String,
    username: String,
    uuid: String,
    access_token: String,
    app: tauri::AppHandle,
) -> Result<String, AppError> {
    let _ = app.emit("launch-progress", serde_json::json!({
        "stage": "java",
        "message": "Detecting Java version..."
    }));
    
    let memory_mb = crate::commands::settings::get_java_memory().unwrap_or(4096);
    let launcher = MinecraftLauncher::new()?;
    
    let _ = app.emit("launch-progress", serde_json::json!({
        "stage": "launching",
        "message": "Starting Minecraft..."
    }));
    
    let result = launcher.launch_with_account(&version, &username, &uuid, &access_token, memory_mb).await?;
    
    let _ = app.emit("launch-progress", serde_json::json!({
        "stage": "complete",
        "message": "Minecraft launched successfully!"
    }));
    
    Ok(result)
}

#[tauri::command]
pub async fn launch_with_loader(
    game_version: String,
    loader: String,
    loader_version: String,
    username: String,
    uuid: String,
    access_token: String,
    profile_id: Option<String>,
    profile_name: Option<String>,
    tracker: tauri::State<'_, crate::minecraft::ProcessTracker>,
    app: tauri::AppHandle,
) -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    
    // Prepare vanilla version if not downloaded (needed for all loaders)
    if !launcher.is_version_downloaded(&game_version) {
        let _ = app.emit("launch-progress", serde_json::json!({
            "stage": "prepare",
            "message": "Preparing Minecraft version..."
        }));
        launcher.prepare_version(&game_version, Some(app.clone())).await?;
    }
    
    let _ = app.emit("launch-progress", serde_json::json!({
        "stage": "loader",
        "message": format!("Checking {} loader...", loader)
    }));
    
    let version_to_launch = match loader.as_str() {
        "fabric" => {
            let config = launcher.get_config();
            let installer = crate::minecraft::FabricInstaller::new(config.limen_dir.clone());
            
            let version_name = format!("fabric-loader-{}-{}", loader_version, game_version);
            if installer.is_installed(&game_version, &loader_version) && launcher.is_version_downloaded(&version_name) {
                version_name
            } else {
                let _ = app.emit("launch-progress", serde_json::json!({
                    "stage": "loader",
                    "message": "Installing Fabric loader..."
                }));
                installer.install_fabric(&game_version, &loader_version).await?
            }
        }
        "quilt" => {
            let config = launcher.get_config();
            let installer = crate::minecraft::QuiltInstaller::new(config.limen_dir.clone());
            
            let version_name = format!("quilt-loader-{}-{}", loader_version, game_version);
            if installer.is_installed(&game_version, &loader_version) && launcher.is_version_downloaded(&version_name) {
                version_name
            } else {
                let _ = app.emit("launch-progress", serde_json::json!({
                    "stage": "loader",
                    "message": "Installing Quilt loader..."
                }));
                installer.install_quilt(&game_version, &loader_version).await?
            }
        }
        "forge" => {
            let config = launcher.get_config();
            let installer = crate::minecraft::ForgeInstaller::new(config.limen_dir.clone());
            
            let full_version = if loader_version.contains('-') {
                loader_version.to_string()
            } else {
                format!("{}-{}", game_version, loader_version)
            };
            let version_name = format!("forge-{}", full_version);
            
            if installer.is_installed(&loader_version) && launcher.is_version_downloaded(&version_name) {
                version_name
            } else {
                let _ = app.emit("launch-progress", serde_json::json!({
                    "stage": "loader",
                    "message": "Installing Forge loader..."
                }));
                installer.install_forge(&game_version, &loader_version).await?
            }
        }
        "neoforge" => {
            let config = launcher.get_config();
            let installer = crate::minecraft::NeoForgeInstaller::new(config.limen_dir.clone());
            
            // Always reinstall NeoForge to ensure processors run correctly
            let _ = app.emit("launch-progress", serde_json::json!({
                "stage": "loader",
                "message": "Installing NeoForge loader..."
            }));
            installer.install_neoforge(&game_version, &loader_version).await?
        }
        "vanilla" => {
            game_version.clone()
        }
        _ => {
            return Err(AppError::InvalidParam(format!("Unsupported loader: {}", loader)));
        }
    };
    
    let _ = app.emit("launch-progress", serde_json::json!({
        "stage": "java",
        "message": "Detecting Java version..."
    }));
    
    let instance_name = profile_id.clone().unwrap_or_else(|| "default".to_string());
    let config = launcher.get_config();
    let game_dir = config.get_instance_dir(&instance_name);
    
    tracker.start_session(
        profile_id.clone().unwrap_or_else(|| "default".to_string()),
        profile_name.unwrap_or_else(|| "Unknown".to_string()),
        None,
        Some(game_dir),
    );
    
    let _ = app.emit("launch-progress", serde_json::json!({
        "stage": "launching",
        "message": "Starting Minecraft..."
    }));
    
    let memory_mb = crate::commands::settings::get_java_memory().unwrap_or(4096);
    let result = launcher.launch(&version_to_launch, &username, &uuid, &access_token, &instance_name, memory_mb).await?;
    
    if let Some(pid_str) = result.split('|').nth(1) {
        if let Ok(pid) = pid_str.parse::<u32>() {
            tracker.set_pid(pid);
        }
    }
    
    let _ = app.emit("launch-progress", serde_json::json!({
        "stage": "complete",
        "message": "Minecraft launched successfully!"
    }));
    
    Ok(format!("Minecraft {} launched successfully", version_to_launch))
}

#[tauri::command]
pub async fn get_limen_config() -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    Ok(config.limen_dir.to_string_lossy().to_string())
}
