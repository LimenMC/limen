use crate::AppError;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use once_cell::sync::Lazy;

const MICROSOFT_CLIENT_ID: &str = "00000000402b5328";
const MICROSOFT_REDIRECT_URI: &str = "https://login.live.com/oauth20_desktop.srf";
const MICROSOFT_SCOPE: &str = "XboxLive.signin offline_access";

static AUTH_HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .pool_max_idle_per_host(5)
        .timeout(std::time::Duration::from_secs(30))
        .https_only(true)
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .build()
        .expect("Failed to build auth HTTP client")
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinecraftProfile {
    pub uuid: String,
    pub username: String,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: u64,
}

#[derive(Debug, Deserialize)]
struct MicrosoftTokenResponse {
    access_token: String,
    refresh_token: String,
    #[allow(dead_code)]
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct XboxLiveAuthResponse {
    #[serde(rename = "Token")]
    token: String,
}

#[derive(Debug, Deserialize)]
struct XboxXstsResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XboxDisplayClaims,
}

#[derive(Debug, Deserialize)]
struct XboxDisplayClaims {
    xui: Vec<XboxUserInfo>,
}

#[derive(Debug, Deserialize)]
struct XboxUserInfo {
    uhs: String,
}

#[derive(Debug, Deserialize)]
struct MinecraftAuthResponse {
    access_token: String,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct MinecraftProfileResponse {
    id: String,
    name: String,
}

pub struct MicrosoftAuth {
    client: reqwest::Client,
}

impl MicrosoftAuth {
    pub fn new() -> Self {
        Self {
            client: AUTH_HTTP_CLIENT.clone(),
        }
    }

    pub fn get_login_url(&self) -> String {
        format!(
            "https://login.live.com/oauth20_authorize.srf?client_id={}&response_type=code&redirect_uri={}&scope={}",
            MICROSOFT_CLIENT_ID,
            urlencoding::encode(MICROSOFT_REDIRECT_URI),
            urlencoding::encode(MICROSOFT_SCOPE)
        )
    }

    pub async fn authenticate(&self, auth_code: &str) -> Result<MinecraftProfile, AppError> {
        let ms_token = self.get_microsoft_token(auth_code).await
            .map_err(|e| AppError::AuthError(format!("GetOAuthToken failed: {}", e)))?;

        let xbox_token = self.authenticate_xbox_live(&ms_token.access_token).await
            .map_err(|e| AppError::AuthError(format!("XboxLiveAuth failed: {}", e)))?;

        let (xsts_token, user_hash) = self.get_xsts_token(&xbox_token).await
            .map_err(|_| AppError::AuthError("XstsAuthorize failed: Check if your account is in a family group or has Xbox restrictions".to_string()))?;

        let mc_token = self.authenticate_minecraft(&xsts_token, &user_hash).await
            .map_err(|e| AppError::AuthError(format!("MinecraftToken failed: {}", e)))?;

        let _ = self.check_minecraft_entitlements(&mc_token.access_token).await;

        let profile = self.get_minecraft_profile(&mc_token.access_token).await
            .map_err(|_| AppError::AuthError("MinecraftProfile failed: Account doesn't own Minecraft or profile not set up. Launch official Minecraft Launcher once to set up profile.".to_string()))?;

        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + mc_token.expires_in;

        Ok(MinecraftProfile {
            uuid: profile.id,
            username: profile.name,
            access_token: mc_token.access_token,
            refresh_token: ms_token.refresh_token,
            expires_at,
        })
    }

    pub async fn refresh_token(&self, refresh_token: &str) -> Result<MinecraftProfile, AppError> {
        let params = [
            ("client_id", MICROSOFT_CLIENT_ID),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
            ("redirect_uri", MICROSOFT_REDIRECT_URI),
            ("scope", MICROSOFT_SCOPE),
        ];

        let response = self
            .client
            .post("https://login.live.com/oauth20_token.srf")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AuthError("Failed to refresh token".to_string()));
        }

        let ms_token: MicrosoftTokenResponse = response.json().await?;

        let xbox_token = self.authenticate_xbox_live(&ms_token.access_token).await?;
        let (xsts_token, user_hash) = self.get_xsts_token(&xbox_token).await?;
        let mc_token = self.authenticate_minecraft(&xsts_token, &user_hash).await?;
        let profile = self.get_minecraft_profile(&mc_token.access_token).await?;

        let expires_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + mc_token.expires_in;

        Ok(MinecraftProfile {
            uuid: profile.id,
            username: profile.name,
            access_token: mc_token.access_token,
            refresh_token: ms_token.refresh_token,
            expires_at,
        })
    }

    async fn get_microsoft_token(&self, auth_code: &str) -> Result<MicrosoftTokenResponse, AppError> {
        let params = [
            ("client_id", MICROSOFT_CLIENT_ID),
            ("code", auth_code),
            ("grant_type", "authorization_code"),
            ("redirect_uri", MICROSOFT_REDIRECT_URI),
            ("scope", MICROSOFT_SCOPE),
        ];

        let response = self
            .client
            .post("https://login.live.com/oauth20_token.srf")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AuthError("Failed to get Microsoft token".to_string()));
        }

        Ok(response.json().await?)
    }

    async fn authenticate_xbox_live(&self, ms_access_token: &str) -> Result<String, AppError> {
        let body = serde_json::json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={}", ms_access_token)
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        });

        let response = self
            .client
            .post("https://user.auth.xboxlive.com/user/authenticate")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AuthError("Failed to authenticate with Xbox Live".to_string()));
        }

        let xbox_response: XboxLiveAuthResponse = response.json().await?;
        Ok(xbox_response.token)
    }

    async fn get_xsts_token(&self, xbox_token: &str) -> Result<(String, String), AppError> {
        let body = serde_json::json!({
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [xbox_token]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        });

        let response = self
            .client
            .post("https://xsts.auth.xboxlive.com/xsts/authorize")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AuthError("Failed to get XSTS token".to_string()));
        }

        let xsts_response: XboxXstsResponse = response.json().await?;
        let user_hash = xsts_response
            .display_claims
            .xui
            .first()
            .ok_or_else(|| AppError::AuthError("No user hash found".to_string()))?
            .uhs
            .clone();

        Ok((xsts_response.token, user_hash))
    }

    async fn authenticate_minecraft(&self, xsts_token: &str, user_hash: &str) -> Result<MinecraftAuthResponse, AppError> {
        let body = serde_json::json!({
            "identityToken": format!("XBL3.0 x={};{}", user_hash, xsts_token)
        });

        let response = self
            .client
            .post("https://api.minecraftservices.com/authentication/login_with_xbox")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AuthError("Failed to authenticate with Minecraft".to_string()));
        }

        Ok(response.json().await?)
    }

    async fn get_minecraft_profile(&self, mc_access_token: &str) -> Result<MinecraftProfileResponse, AppError> {
        let response = self
            .client
            .get("https://api.minecraftservices.com/minecraft/profile")
            .header("Authorization", format!("Bearer {}", mc_access_token))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AuthError("Failed to get Minecraft profile. User may not own Minecraft.".to_string()));
        }

        Ok(response.json().await?)
    }

    async fn check_minecraft_entitlements(&self, mc_access_token: &str) -> Result<(), AppError> {
        let response = self
            .client
            .get("https://api.minecraftservices.com/entitlements/mcstore")
            .header("Authorization", format!("Bearer {}", mc_access_token))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::AuthError("Failed to check Minecraft entitlements".to_string()));
        }

        Ok(())
    }
}
