use crate::{api::LoadersApi, AppError};
use crate::minecraft::MinecraftLauncher;

#[tauri::command]
pub async fn get_fabric_versions() -> Result<Vec<crate::api::loaders::LoaderVersion>, AppError> {
    let api = LoadersApi::new();
    api.get_fabric_versions().await
}

#[tauri::command]
pub async fn get_fabric_versions_for_game(game_version: String) -> Result<Vec<crate::api::loaders::LoaderInfo>, AppError> {
    let api = LoadersApi::new();
    api.get_fabric_versions_for_game(&game_version).await
}

#[tauri::command]
pub async fn get_quilt_versions() -> Result<Vec<crate::api::loaders::LoaderVersion>, AppError> {
    let api = LoadersApi::new();
    api.get_quilt_versions().await
}

#[tauri::command]
pub async fn get_quilt_versions_for_game(game_version: String) -> Result<Vec<crate::api::loaders::LoaderInfo>, AppError> {
    let api = LoadersApi::new();
    api.get_quilt_versions_for_game(&game_version).await
}

#[tauri::command]
pub async fn get_forge_versions(game_version: String) -> Result<Vec<String>, AppError> {
    let api = LoadersApi::new();
    api.get_forge_versions_for_game(&game_version).await
}

#[tauri::command]
pub async fn get_neoforge_versions() -> Result<Vec<String>, AppError> {
    let api = LoadersApi::new();
    api.get_neoforge_versions().await
}

#[tauri::command]
pub async fn install_fabric_loader(
    game_version: String,
    loader_version: String,
) -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let installer = crate::minecraft::FabricInstaller::new(config.limen_dir.clone());
    let fabric_version = installer.install_fabric(&game_version, &loader_version).await?;
    
    Ok(fabric_version)
}

#[tauri::command]
pub async fn install_quilt_loader(
    game_version: String,
    loader_version: String,
) -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let installer = crate::minecraft::QuiltInstaller::new(config.limen_dir.clone());
    let quilt_version = installer.install_quilt(&game_version, &loader_version).await?;
    
    Ok(quilt_version)
}

#[tauri::command]
pub async fn install_forge_loader(
    game_version: String,
    forge_version: String,
) -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let installer = crate::minecraft::ForgeInstaller::new(config.limen_dir.clone());
    let forge_version_name = installer.install_forge(&game_version, &forge_version).await?;
    
    Ok(forge_version_name)
}

#[tauri::command]
pub async fn install_neoforge_loader(
    game_version: String,
    neoforge_version: String,
) -> Result<String, AppError> {
    let launcher = MinecraftLauncher::new()?;
    let config = launcher.get_config();
    
    let installer = crate::minecraft::NeoForgeInstaller::new(config.limen_dir.clone());
    let neoforge_version_name = installer.install_neoforge(&game_version, &neoforge_version).await?;
    
    Ok(neoforge_version_name)
}
