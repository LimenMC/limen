use crate::AppError;
use crate::auth::{MicrosoftAuth, MinecraftProfile};
use crate::minecraft::config::LimenConfig;
use tauri::{State, Manager, Emitter};
use std::sync::Mutex;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use keyring::Entry;

pub struct AuthState {
    pub profile: Mutex<Option<MinecraftProfile>>,
    pub config_path: PathBuf,
    pub refresh_lock: Mutex<()>,
}

impl AuthState {
    pub fn new() -> Self {
        let config = LimenConfig::new().expect("Failed to create config");
        let config_path = config.app_dir.clone();
        let profile = Self::load_profile();
        
        Self {
            profile: Mutex::new(profile),
            config_path,
            refresh_lock: Mutex::new(()),
        }
    }

    fn load_profile() -> Option<MinecraftProfile> {
        // Use platform-specific secure credential storage
        let entry = Entry::new("limen", "minecraft_profile").ok()?;
        let json = entry.get_password().ok()?;
        serde_json::from_str::<MinecraftProfile>(&json).ok()
    }

    fn save_profile(&self, profile: &MinecraftProfile) -> Result<(), AppError> {
        let json = serde_json::to_string(profile)
            .map_err(|e| AppError::FileError(format!("Failed to serialize profile: {}", e)))?;
        
        let entry = Entry::new("limen", "minecraft_profile")
            .map_err(|e| AppError::FileError(format!("Failed to access keyring: {}", e)))?;
        
        entry.set_password(&json)
            .map_err(|e| AppError::FileError(format!("Failed to save profile: {}", e)))?;
        
        Ok(())
    }

    fn delete_profile(&self) -> Result<(), AppError> {
        let entry = Entry::new("limen", "minecraft_profile")
            .map_err(|e| AppError::FileError(format!("Failed to access keyring: {}", e)))?;
        
        let _ = entry.delete_credential();
        Ok(())
    }
}

#[tauri::command]
pub fn get_microsoft_login_url() -> Result<String, AppError> {
    let auth = MicrosoftAuth::new();
    Ok(auth.get_login_url())
}

#[tauri::command]
pub async fn open_microsoft_login(app: tauri::AppHandle) -> Result<(), AppError> {
    let auth = MicrosoftAuth::new();
    let login_url = auth.get_login_url();

    let _window = tauri::WebviewWindowBuilder::new(
        &app,
        "microsoft-login",
        tauri::WebviewUrl::External(login_url.parse().unwrap())
    )
    .title("Login with Microsoft")
    .inner_size(600.0, 700.0)
    .resizable(false)
    .center()
    .build()
    .map_err(|e| AppError::AuthError(format!("Failed to open login window: {}", e)))?;

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            
            if let Some(win) = app_clone.get_webview_window("microsoft-login") {
                if let Ok(url) = win.url() {
                    let url_str = url.to_string();
                    
                    if url_str.contains("login.live.com/oauth20_desktop.srf") && url_str.contains("code=") {
                        if let Ok(parsed_url) = url::Url::parse(&url_str) {
                            if let Some(code) = parsed_url.query_pairs()
                                .find(|(key, _)| key == "code")
                                .map(|(_, value)| value.to_string()) 
                            {
                                let _ = app_clone.emit("auth-code-received", code);
                                let _ = win.close();
                                break;
                            }
                        }
                    }
                }
            } else {
                break;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn authenticate_microsoft(
    auth_code: String,
    state: State<'_, AuthState>,
) -> Result<MinecraftProfile, AppError> {
    let auth = MicrosoftAuth::new();
    let profile = auth.authenticate(&auth_code).await?;
    
    {
        let mut profile_state = state.profile.lock().unwrap();
        *profile_state = Some(profile.clone());
    }
    
    state.save_profile(&profile)?;
    
    Ok(profile)
}

#[tauri::command]
pub async fn refresh_microsoft_token(
    state: State<'_, AuthState>,
) -> Result<MinecraftProfile, AppError> {
    let refresh_token = {
        let profile_state = state.profile.lock().unwrap();
        profile_state
            .as_ref()
            .ok_or_else(|| AppError::AuthError("No profile found".to_string()))?
            .refresh_token
            .clone()
    };

    let auth = MicrosoftAuth::new();
    let profile = auth.refresh_token(&refresh_token).await?;
    
    {
        let mut profile_state = state.profile.lock().unwrap();
        *profile_state = Some(profile.clone());
    }
    
    state.save_profile(&profile)?;
    
    Ok(profile)
}

#[tauri::command]
pub fn get_current_profile(state: State<'_, AuthState>) -> Result<Option<MinecraftProfile>, AppError> {
    let profile_state = state.profile.lock().unwrap();
    Ok(profile_state.clone())
}

#[tauri::command]
pub async fn check_and_refresh_token(state: State<'_, AuthState>) -> Result<Option<MinecraftProfile>, AppError> {
    // Check if refresh is needed first
    let (needs_refresh, has_profile) = {
        let profile_state = state.profile.lock().unwrap();
        if let Some(profile) = profile_state.as_ref() {
            let current_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            // Refresh if token expires in less than 10 minutes
            let needs_refresh = current_time + 600 >= profile.expires_at;
            (needs_refresh, true)
        } else {
            (false, false)
        }
    };

    if has_profile && needs_refresh {
        // Acquire lock only for the duration of the check, not across await
        {
            let _refresh_guard = state.refresh_lock.lock().unwrap();
            // Double-check after acquiring lock
        }
        
        match refresh_microsoft_token(state.clone()).await {
            Ok(profile) => Ok(Some(profile)),
            Err(_) => {
                let profile_state = state.profile.lock().unwrap();
                Ok(profile_state.clone())
            }
        }
    } else if has_profile {
        let profile_state = state.profile.lock().unwrap();
        Ok(profile_state.clone())
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn logout(state: State<'_, AuthState>) -> Result<(), AppError> {
    let mut profile_state = state.profile.lock().unwrap();
    *profile_state = None;
    state.delete_profile()?;
    Ok(())
}
