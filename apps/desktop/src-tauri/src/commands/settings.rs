use crate::AppError;
use crate::minecraft::config::LimenConfig;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub language: String,
    pub discord_rpc_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: "en".to_string(),
            discord_rpc_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftProfile {
    pub id: String,
    pub name: String,
    pub version: String,
    pub loader: String,
    pub loader_version: String,
    pub icon: Option<String>,
    pub last_played: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomSkin {
    pub uuid: String,
    pub name: String,
    pub texture_data: String,
}

#[tauri::command]
pub fn get_app_settings() -> Result<AppSettings, AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let settings_file = config.get_app_settings_file();
    
    if settings_file.exists() {
        let content = fs::read_to_string(&settings_file)
            .map_err(|e| AppError::FileError(format!("Failed to read settings: {}", e)))?;
        
        let settings: AppSettings = serde_json::from_str(&content)
            .map_err(|e| AppError::FileError(format!("Failed to parse settings: {}", e)))?;
        
        Ok(settings)
    } else {
        Ok(AppSettings::default())
    }
}

#[tauri::command]
pub fn save_app_settings(settings: AppSettings) -> Result<(), AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let settings_file = config.get_app_settings_file();
    
    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| AppError::FileError(format!("Failed to serialize settings: {}", e)))?;
    
    fs::write(&settings_file, json)
        .map_err(|e| AppError::FileError(format!("Failed to save settings: {}", e)))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_minecraft_profiles() -> Result<Vec<MinecraftProfile>, AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let profiles_file = config.get_profiles_file();
    
    if profiles_file.exists() {
        let content = fs::read_to_string(&profiles_file)
            .map_err(|e| AppError::FileError(format!("Failed to read profiles: {}", e)))?;
        
        let profiles: Vec<MinecraftProfile> = serde_json::from_str(&content)
            .map_err(|e| AppError::FileError(format!("Failed to parse profiles: {}", e)))?;
        
        Ok(profiles)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn save_minecraft_profiles(profiles: Vec<MinecraftProfile>) -> Result<(), AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let profiles_file = config.get_profiles_file();
    
    let json = serde_json::to_string_pretty(&profiles)
        .map_err(|e| AppError::FileError(format!("Failed to serialize profiles: {}", e)))?;
    
    fs::write(&profiles_file, json)
        .map_err(|e| AppError::FileError(format!("Failed to save profiles: {}", e)))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_custom_skins() -> Result<Vec<CustomSkin>, AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let skins_file = config.get_custom_skins_file();
    
    if skins_file.exists() {
        let content = fs::read_to_string(&skins_file)
            .map_err(|e| AppError::FileError(format!("Failed to read custom skins: {}", e)))?;
        
        let skins: Vec<CustomSkin> = serde_json::from_str(&content)
            .map_err(|e| AppError::FileError(format!("Failed to parse custom skins: {}", e)))?;
        
        Ok(skins)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn save_custom_skins(skins: Vec<CustomSkin>) -> Result<(), AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let skins_file = config.get_custom_skins_file();
    
    let json = serde_json::to_string_pretty(&skins)
        .map_err(|e| AppError::FileError(format!("Failed to serialize custom skins: {}", e)))?;
    
    fs::write(&skins_file, json)
        .map_err(|e| AppError::FileError(format!("Failed to save custom skins: {}", e)))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_profile_mods(profile_id: String) -> Result<Vec<serde_json::Value>, AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let profile_dir = config.get_profile_dir(&profile_id);
    let mods_file = profile_dir.join("installed_mods.json");
    
    if mods_file.exists() {
        let content = fs::read_to_string(&mods_file)
            .map_err(|e| AppError::FileError(format!("Failed to read profile mods: {}", e)))?;
        
        let mods: Vec<serde_json::Value> = serde_json::from_str(&content)
            .map_err(|e| AppError::FileError(format!("Failed to parse profile mods: {}", e)))?;
        
        Ok(mods)
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn save_profile_mods(profile_id: String, mods: Vec<serde_json::Value>) -> Result<(), AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let profile_dir = config.get_profile_dir(&profile_id);
    fs::create_dir_all(&profile_dir)
        .map_err(|e| AppError::FileError(format!("Failed to create profile directory: {}", e)))?;
    
    let mods_file = profile_dir.join("installed_mods.json");
    
    let json = serde_json::to_string_pretty(&mods)
        .map_err(|e| AppError::FileError(format!("Failed to serialize profile mods: {}", e)))?;
    
    fs::write(&mods_file, json)
        .map_err(|e| AppError::FileError(format!("Failed to save profile mods: {}", e)))?;
    
    Ok(())
}

#[tauri::command]
pub fn get_java_memory() -> Result<u32, AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let settings_file = config.get_app_settings_file();
    let settings_dir = settings_file.parent().unwrap();
    let memory_file = settings_dir.join("java_memory.txt");
    
    if memory_file.exists() {
        let content = fs::read_to_string(&memory_file)
            .map_err(|e| AppError::FileError(format!("Failed to read memory setting: {}", e)))?;
        
        let memory: u32 = content.trim().parse()
            .unwrap_or(4096);
        
        Ok(memory)
    } else {
        Ok(4096)
    }
}

#[tauri::command]
pub fn save_java_memory(memory_mb: u32) -> Result<(), AppError> {
    let config = LimenConfig::new()
        .map_err(|e| AppError::FileError(format!("Failed to get config: {}", e)))?;
    
    let settings_file = config.get_app_settings_file();
    let settings_dir = settings_file.parent().unwrap();
    let memory_file = settings_dir.join("java_memory.txt");
    
    fs::write(&memory_file, memory_mb.to_string())
        .map_err(|e| AppError::FileError(format!("Failed to save memory setting: {}", e)))?;
    
    Ok(())
}
