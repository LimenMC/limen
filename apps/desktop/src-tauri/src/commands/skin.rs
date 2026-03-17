use crate::AppError;
use base64::Engine;

#[tauri::command]
pub async fn fetch_skin_texture(uuid: String) -> Result<String, AppError> {
    let clean_uuid = uuid.replace("-", "");
    
    let session_url = format!("https://sessionserver.mojang.com/session/minecraft/profile/{}", clean_uuid);
    
    let client = reqwest::Client::builder()
        .user_agent("Limen/0.1.0")
        .build()?;
    
    let response = client.get(&session_url).send().await?;
    
    if !response.status().is_success() {
        return Err(AppError::NetworkError("Failed to fetch profile from Mojang".to_string()));
    }
    
    let json: serde_json::Value = response.json().await?;
    
    if let Some(properties) = json.get("properties").and_then(|p| p.as_array()) {
        for prop in properties {
            if let Some(name) = prop.get("name").and_then(|n| n.as_str()) {
                if name == "textures" {
                    if let Some(value) = prop.get("value").and_then(|v| v.as_str()) {
                        if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(value) {
                            if let Ok(texture_data) = serde_json::from_slice::<serde_json::Value>(&decoded) {
                                if let Some(skin_url) = texture_data
                                    .get("textures")
                                    .and_then(|t| t.get("SKIN"))
                                    .and_then(|s| s.get("url"))
                                    .and_then(|u| u.as_str())
                                {
                                    let skin_response = client.get(skin_url).send().await?;
                                    
                                    if !skin_response.status().is_success() {
                                        return Err(AppError::NetworkError("Failed to download skin texture".to_string()));
                                    }
                                    
                                    let bytes = skin_response.bytes().await?;
                                    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                                    return Ok(format!("data:image/png;base64,{}", base64));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Default Steve skin
    let default_skin_url = "https://textures.minecraft.net/texture/31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb";
    
    let default_response = client.get(default_skin_url).send().await?;
    
    if default_response.status().is_success() {
        let bytes = default_response.bytes().await?;
        let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        return Ok(format!("data:image/png;base64,{}", base64));
    }
    
    Err(AppError::NetworkError("No skin texture found in profile and failed to load default skin".to_string()))
}

#[tauri::command]
pub async fn detect_skin_model(uuid: String) -> Result<String, AppError> {
    let clean_uuid = uuid.replace("-", "");
    let url = format!("https://sessionserver.mojang.com/session/minecraft/profile/{}", clean_uuid);
    
    let client = reqwest::Client::builder()
        .user_agent("Limen/0.1.0")
        .build()?;
    
    let response = client.get(&url).send().await?;
    
    if !response.status().is_success() {
        return Ok("steve".to_string());
    }
    
    let json: serde_json::Value = response.json().await?;
    
    if let Some(properties) = json.get("properties").and_then(|p| p.as_array()) {
        for prop in properties {
            if let Some(name) = prop.get("name").and_then(|n| n.as_str()) {
                if name == "textures" {
                    if let Some(value) = prop.get("value").and_then(|v| v.as_str()) {
                        if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(value) {
                            if let Ok(texture_data) = serde_json::from_slice::<serde_json::Value>(&decoded) {
                                if let Some(model) = texture_data
                                    .get("textures")
                                    .and_then(|t| t.get("SKIN"))
                                    .and_then(|s| s.get("metadata"))
                                    .and_then(|m| m.get("model"))
                                    .and_then(|m| m.as_str())
                                {
                                    if model == "slim" {
                                        return Ok("alex".to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok("steve".to_string())
}

#[tauri::command]
pub async fn upload_skin_from_file(
    access_token: String,
    _user_uuid: String,
    file_path: String,
    model: String,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .user_agent("Limen/0.1.0")
        .build()?;
    
    let skin_bytes = std::fs::read(&file_path)
        .map_err(|e| AppError::FileError(format!("Failed to read skin file: {}", e)))?;
    
    if skin_bytes.len() < 8 || &skin_bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
        return Err(AppError::InvalidParam("File is not a valid PNG image".to_string()));
    }
    
    let url = "https://api.minecraftservices.com/minecraft/profile/skins";
    
    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(skin_bytes)
                .file_name("skin.png")
                .mime_str("image/png")?
        )
        .text("variant", model);
    
    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", access_token))
        .multipart(form)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(AppError::NetworkError(format!("Failed to upload skin: {}", error_text)));
    }
    
    Ok("Skin uploaded successfully".to_string())
}

#[tauri::command]
pub async fn upload_skin(
    access_token: String,
    _user_uuid: String,
    source_uuid: String,
    model: String,
) -> Result<String, AppError> {
    let client = reqwest::Client::builder()
        .user_agent("Limen/0.1.0")
        .build()?;
    
    let clean_uuid = source_uuid.replace("-", "");
    let session_url = format!("https://sessionserver.mojang.com/session/minecraft/profile/{}", clean_uuid);
    
    let session_response = client.get(&session_url).send().await?;
    
    if !session_response.status().is_success() {
        return Err(AppError::NetworkError("Failed to fetch source profile from Mojang".to_string()));
    }
    
    let json: serde_json::Value = session_response.json().await?;
    
    let mut skin_url: Option<String> = None;
    
    if let Some(properties) = json.get("properties").and_then(|p| p.as_array()) {
        for prop in properties {
            if let Some(name) = prop.get("name").and_then(|n| n.as_str()) {
                if name == "textures" {
                    if let Some(value) = prop.get("value").and_then(|v| v.as_str()) {
                        if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(value) {
                            if let Ok(texture_data) = serde_json::from_slice::<serde_json::Value>(&decoded) {
                                if let Some(url) = texture_data
                                    .get("textures")
                                    .and_then(|t| t.get("SKIN"))
                                    .and_then(|s| s.get("url"))
                                    .and_then(|u| u.as_str())
                                {
                                    skin_url = Some(url.to_string());
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    let skin_url = skin_url.ok_or_else(|| AppError::NetworkError("No skin texture found in source profile".to_string()))?;
    
    let skin_response = client.get(&skin_url).send().await?;
    
    if !skin_response.status().is_success() {
        return Err(AppError::NetworkError("Failed to download skin texture".to_string()));
    }
    
    let skin_bytes = skin_response.bytes().await?;
    
    let url = "https://api.minecraftservices.com/minecraft/profile/skins";
    
    let form = reqwest::multipart::Form::new()
        .part(
            "file",
            reqwest::multipart::Part::bytes(skin_bytes.to_vec())
                .file_name("skin.png")
                .mime_str("image/png")?
        )
        .text("variant", model);
    
    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", access_token))
        .multipart(form)
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(AppError::NetworkError(format!("Failed to upload skin: {}", error_text)));
    }
    
    Ok("Skin uploaded successfully".to_string())
}

#[tauri::command]
pub async fn get_current_skin_url(uuid: String) -> Result<Option<String>, AppError> {
    let clean_uuid = uuid.replace("-", "");
    let url = format!("https://sessionserver.mojang.com/session/minecraft/profile/{}", clean_uuid);
    
    let client = reqwest::Client::builder()
        .user_agent("Limen/0.1.0")
        .build()?;
    
    let response = client.get(&url).send().await?;
    
    if !response.status().is_success() {
        return Ok(None);
    }
    
    let json: serde_json::Value = response.json().await?;
    
    if let Some(properties) = json.get("properties").and_then(|p| p.as_array()) {
        for prop in properties {
            if let Some(name) = prop.get("name").and_then(|n| n.as_str()) {
                if name == "textures" {
                    if let Some(value) = prop.get("value").and_then(|v| v.as_str()) {
                        if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(value) {
                            if let Ok(texture_data) = serde_json::from_slice::<serde_json::Value>(&decoded) {
                                if let Some(skin_url) = texture_data
                                    .get("textures")
                                    .and_then(|t| t.get("SKIN"))
                                    .and_then(|s| s.get("url"))
                                    .and_then(|u| u.as_str())
                                {
                                    return Ok(Some(skin_url.to_string()));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(None)
}

#[tauri::command]
pub async fn read_local_skin_file(file_path: String) -> Result<String, AppError> {
    let skin_bytes = std::fs::read(&file_path)
        .map_err(|e| AppError::FileError(format!("Failed to read skin file: {}", e)))?;
    
    if skin_bytes.len() < 8 || &skin_bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
        return Err(AppError::InvalidParam("File is not a valid PNG image".to_string()));
    }
    
    let base64 = base64::engine::general_purpose::STANDARD.encode(&skin_bytes);
    Ok(format!("data:image/png;base64,{}", base64))
}
