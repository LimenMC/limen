use crate::{AppError, JavaInstallation};
use std::path::Path;

#[tauri::command]
pub fn get_java_installations() -> Result<Vec<JavaInstallation>, AppError> {
    let mut installations = Vec::new();
    
    for version in [25u8, 21, 17, 11, 8] {
        let paths = vec![
            format!("C:\\Program Files\\Java\\jdk-{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Java\\jdk{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Eclipse Adoptium\\jdk-{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Eclipse Adoptium\\jdk-{}-hotspot\\bin\\java.exe", version),
            format!("C:\\Program Files\\Microsoft\\jdk-{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Zulu\\zulu-{}\\bin\\java.exe", version),
            format!("C:\\Program Files (x86)\\Java\\jdk-{}\\bin\\java.exe", version),
        ];
        
        for path in paths {
            if Path::new(&path).exists() {
                installations.push(JavaInstallation {
                    version,
                    path,
                    is_custom: false,
                });
                break;
            }
        }
    }
    
    let config_dir = dirs::config_dir()
        .ok_or_else(|| AppError::InvalidParam("Could not find config directory".to_string()))?;
    let java_config_path = config_dir.join("limen").join("java_paths.json");
    
    if java_config_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&java_config_path) {
            if let Ok(custom_paths) = serde_json::from_str::<Vec<JavaInstallation>>(&content) {
                installations.extend(custom_paths);
            }
        }
    }
    
    Ok(installations)
}

#[tauri::command]
pub fn set_custom_java_path(version: u8, path: String) -> Result<(), AppError> {
    let path_obj = Path::new(&path);
    
    if !path_obj.exists() || !path_obj.is_file() {
        return Err(AppError::InvalidParam("Java executable not found at specified path".to_string()));
    }
    
    let filename = path_obj.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| AppError::InvalidParam("Invalid filename".to_string()))?;
    
    if filename != "java.exe" && filename != "javaw.exe" && filename != "java" {
        return Err(AppError::InvalidParam("Path must point to java executable (java.exe, javaw.exe, or java)".to_string()));
    }
    
    let output = std::process::Command::new(&path)
        .arg("--version")
        .output()
        .map_err(|_| AppError::InvalidParam("Not a valid Java executable".to_string()))?;
    
    if !output.status.success() {
        return Err(AppError::InvalidParam("Java version check failed - not a valid Java installation".to_string()));
    }
    
    let output_str = String::from_utf8_lossy(&output.stdout).to_lowercase();
    if !output_str.contains("java") && !output_str.contains("openjdk") {
        return Err(AppError::InvalidParam("Executable does not appear to be Java".to_string()));
    }
    
    let config_dir = dirs::config_dir()
        .ok_or_else(|| AppError::InvalidParam("Could not find config directory".to_string()))?;
    let limen_dir = config_dir.join("limen");
    std::fs::create_dir_all(&limen_dir)?;
    
    let java_config_path = limen_dir.join("java_paths.json");
    
    let mut custom_paths: Vec<JavaInstallation> = if java_config_path.exists() {
        let content = std::fs::read_to_string(&java_config_path)?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };
    
    custom_paths.retain(|j| j.version != version);
    
    custom_paths.push(JavaInstallation {
        version,
        path,
        is_custom: true,
    });
    
    let json = serde_json::to_string_pretty(&custom_paths)?;
    std::fs::write(&java_config_path, json)?;
    
    Ok(())
}

#[tauri::command]
pub fn reset_java_path(version: u8) -> Result<(), AppError> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| AppError::InvalidParam("Could not find config directory".to_string()))?;
    let java_config_path = config_dir.join("limen").join("java_paths.json");
    
    if !java_config_path.exists() {
        return Ok(());
    }
    
    let content = std::fs::read_to_string(&java_config_path)?;
    let mut custom_paths: Vec<JavaInstallation> = serde_json::from_str(&content).unwrap_or_default();
    
    custom_paths.retain(|j| j.version != version);
    
    if custom_paths.is_empty() {
        std::fs::remove_file(&java_config_path)?;
    } else {
        let json = serde_json::to_string_pretty(&custom_paths)?;
        std::fs::write(&java_config_path, json)?;
    }
    
    Ok(())
}
