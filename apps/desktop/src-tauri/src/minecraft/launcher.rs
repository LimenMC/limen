use crate::AppError;
use super::config::LimenConfig;
use super::downloader::MinecraftDownloader;
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use tauri::Emitter;

pub struct MinecraftLauncher {
    config: LimenConfig,
    downloader: MinecraftDownloader,
    java_cache: Mutex<HashMap<String, String>>,
}

impl MinecraftLauncher {
    pub fn new() -> Result<Self, AppError> {
        let config = LimenConfig::new()?;
        let downloader = MinecraftDownloader::new(config.clone());
        Ok(Self {
            config,
            downloader,
            java_cache: Mutex::new(HashMap::new()),
        })
    }

    pub async fn get_versions(&self) -> Result<Vec<String>, AppError> {
        let manifest = self.downloader.fetch_version_manifest().await?;
        let versions: Vec<String> = manifest.versions.iter().map(|v| v.id.clone()).collect();
        Ok(versions)
    }

    pub fn get_config(&self) -> &LimenConfig {
        &self.config
    }

    pub fn is_version_downloaded(&self, version: &str) -> bool {
        self.downloader.is_version_downloaded(version)
    }

    fn get_cached_java(&self, version: &str) -> Option<String> {
        self.java_cache.lock().unwrap().get(version).cloned()
    }

    fn cache_java(&self, version: &str, java_path: String) {
        self.java_cache.lock().unwrap().insert(version.to_string(), java_path);
    }
}

// Version preparation methods
impl MinecraftLauncher {
    pub fn prepare_version<'a>(
        &'a self,
        version: &'a str,
        app: Option<tauri::AppHandle>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, AppError>> + Send + 'a>> {
        Box::pin(async move {
            if self.downloader.is_version_downloaded(version) {
                return Ok(format!("Version {} is already downloaded", version));
            }

            let version_json_path = self.config.versions_dir.join(version).join(format!("{}.json", version));
            
            if version_json_path.exists() {
                return self.prepare_modded_version(version, &version_json_path, app).await;
            }

            self.prepare_vanilla_version(version, app).await
        })
    }

    async fn prepare_vanilla_version(
        &self,
        version: &str,
        app: Option<tauri::AppHandle>,
    ) -> Result<String, AppError> {
        let manifest = self.downloader.fetch_version_manifest().await?;
        let version_info = manifest.versions.iter().find(|v| v.id == version)
            .ok_or_else(|| AppError::InvalidParam(format!("Version {} not found", version)))?;
        let details = self.downloader.fetch_version_details(&version_info.url).await?;

        let version_dir = self.config.versions_dir.join(version);
        std::fs::create_dir_all(&version_dir)?;
        let version_json_path = version_dir.join(format!("{}.json", version));
        std::fs::write(&version_json_path, serde_json::to_string_pretty(&details)?)?;

        self.emit_progress(&app, "client", "Downloading client JAR...");
        self.downloader.download_client_jar(version, &details.downloads.client.url).await?;

        self.emit_progress(&app, "libraries", "Downloading libraries...");
        self.downloader.download_libraries(&details).await?;

        self.emit_progress(&app, "assets", "Downloading assets...");
        self.downloader.download_asset_index(&details, app.clone()).await?;

        Ok(format!("Version {} downloaded successfully", version))
    }

    async fn prepare_modded_version(
        &self,
        version: &str,
        version_json_path: &std::path::Path,
        app: Option<tauri::AppHandle>,
    ) -> Result<String, AppError> {
        let json_content = std::fs::read_to_string(version_json_path)?;
        let json: serde_json::Value = serde_json::from_str(&json_content)?;
        
        let inherits_from = json.get("inheritsFrom")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::InvalidParam("Modded version missing inheritsFrom".to_string()))?;

        if !self.downloader.is_version_downloaded(inherits_from) {
            self.prepare_version(inherits_from, app.clone()).await?;
        }

        self.download_parent_libraries(inherits_from).await?;
        self.download_modded_libraries(&json).await?;

        Ok(format!("Modded version {} prepared successfully", version))
    }

    async fn download_parent_libraries(&self, parent_version: &str) -> Result<(), AppError> {
        let parent_json_path = self.config.versions_dir
            .join(parent_version)
            .join(format!("{}.json", parent_version));
        
        if !parent_json_path.exists() {
            return Ok(());
        }

        let parent_json_content = std::fs::read_to_string(&parent_json_path)?;
        let parent_json: serde_json::Value = serde_json::from_str(&parent_json_content)?;
        
        if let Some(parent_libs) = parent_json.get("libraries").and_then(|v| v.as_array()) {
            self.download_library_list(parent_libs).await?;
        }

        Ok(())
    }

    async fn download_modded_libraries(&self, json: &serde_json::Value) -> Result<(), AppError> {
        if let Some(libraries) = json.get("libraries").and_then(|v| v.as_array()) {
            self.download_library_list(libraries).await?;
        }
        Ok(())
    }

    async fn download_library_list(&self, libraries: &[serde_json::Value]) -> Result<(), AppError> {
        for lib in libraries {
            let name = lib.get("name").and_then(|v| v.as_str());
            
            if let Some(name) = name {
                if name.contains(":client") && name.starts_with("net.minecraftforge:forge:") {
                    continue;
                }

                let lib_path = self.maven_to_path(name);
                let lib_file = self.config.libraries_dir.join(&lib_path);
                
                if lib_file.exists() {
                    continue;
                }
                
                if let Some(parent) = lib_file.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                
                let download_url = self.get_library_url(lib, &lib_path);
                
                if let Err(e) = self.downloader.download_modded_library(name, &download_url, &lib_file).await {
                    return Err(AppError::NetworkError(format!(
                        "Failed to download library {}: {}",
                        name, e
                    )));
                }
            }
        }
        Ok(())
    }

    fn get_library_url(&self, lib: &serde_json::Value, lib_path: &str) -> String {
        if let Some(artifact_url) = lib.get("downloads")
            .and_then(|d| d.get("artifact"))
            .and_then(|a| a.get("url"))
            .and_then(|u| u.as_str())
            .filter(|u| !u.is_empty())
        {
            return artifact_url.to_string();
        }

        let base_url = lib.get("url")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("https://maven.minecraftforge.net/");
        
        let base = if base_url.ends_with('/') { 
            base_url.to_string() 
        } else { 
            format!("{}/", base_url) 
        };
        
        format!("{}{}", base, lib_path)
    }

    fn emit_progress(&self, app: &Option<tauri::AppHandle>, stage: &str, message: &str) {
        if let Some(app_handle) = app {
            let _ = app_handle.emit("download-progress", serde_json::json!({
                "stage": stage,
                "message": message
            }));
        }
    }
}

// Launch methods
impl MinecraftLauncher {
    pub async fn launch_with_account(
        &self,
        version: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        max_memory_mb: u32,
    ) -> Result<String, AppError> {
        self.launch(version, username, uuid, access_token, "default", max_memory_mb).await
    }

    pub async fn launch(
        &self,
        version: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        instance_name: &str,
        max_memory_mb: u32,
    ) -> Result<String, AppError> {
        if !self.downloader.is_version_downloaded(version) {
            return Err(AppError::InvalidParam(format!("Version {} is not downloaded", version)));
        }

        let java_cmd = self.get_java_for_version(version)?;
        let (details, modded_info) = self.load_version_details(version).await?;

        let jar_version = modded_info.as_ref()
            .and_then(|m| m.inherits_from.as_deref())
            .unwrap_or(version);
        
        let jar_path = self.get_jar_path(jar_version)?;
        
        // Quick check: only verify critical files
        if !jar_path.exists() {
            return Err(AppError::InvalidParam(format!("Client JAR not found: {:?}", jar_path)));
        }
        
        let classpath = self.build_classpath(&details, &modded_info, &jar_path, version)?;
        let natives_dir = self.prepare_natives(&classpath, jar_version)?;
        let game_dir = self.prepare_game_dir(instance_name)?;

        let main_class = modded_info.as_ref()
            .and_then(|m| m.main_class.as_deref())
            .unwrap_or(&details.main_class);

        let mut cmd = self.build_launch_command(
            &java_cmd,
            max_memory_mb,
            &natives_dir,
            &jar_path,
            &game_dir,
            &classpath,
            main_class,
            &modded_info,
            version,
        );

        self.add_game_arguments(
            &mut cmd,
            &details,
            &modded_info,
            version,
            username,
            uuid,
            access_token,
            &game_dir,
        );

        let child = cmd
            .current_dir(&game_dir)
            .spawn()
            .map_err(|e| AppError::NetworkError(format!("Failed to launch Minecraft: {}", e)))?;
        
        let pid = child.id();
        Ok(format!("{}|{}", version, pid))
    }
}

struct ModdedVersionInfo {
    inherits_from: Option<String>,
    main_class: Option<String>,
    libraries: Option<Vec<serde_json::Value>>,
    arguments: Option<serde_json::Value>,
}

impl MinecraftLauncher {
    async fn load_version_details(
        &self,
        version: &str,
    ) -> Result<(super::config::VersionDetails, Option<ModdedVersionInfo>), AppError> {
        let version_json_path = self.config.versions_dir.join(version).join(format!("{}.json", version));
        
        if !version_json_path.exists() {
            let manifest = self.downloader.fetch_version_manifest().await?;
            let version_info = manifest.versions.iter().find(|v| v.id == version)
                .ok_or_else(|| AppError::InvalidParam(format!("Version {} not found", version)))?;
            let details = self.downloader.fetch_version_details(&version_info.url).await?;
            return Ok((details, None));
        }

        let json_content = std::fs::read_to_string(&version_json_path)?;
        let json: serde_json::Value = serde_json::from_str(&json_content)?;
        
        if let Some(inherits_from) = json.get("inheritsFrom").and_then(|v| v.as_str()) {
            let parent_details = self.load_parent_details(inherits_from).await?;
            
            let modded_info = ModdedVersionInfo {
                inherits_from: Some(inherits_from.to_string()),
                main_class: json.get("mainClass").and_then(|v| v.as_str()).map(|s| s.to_string()),
                libraries: json.get("libraries").and_then(|v| v.as_array()).cloned(),
                arguments: json.get("arguments").cloned(),
            };
            
            return Ok((parent_details, Some(modded_info)));
        }

        let details = serde_json::from_str(&json_content)
            .map_err(|e| AppError::InvalidParam(format!("Failed to parse version JSON: {}", e)))?;
        Ok((details, None))
    }

    async fn load_parent_details(&self, parent_version: &str) -> Result<super::config::VersionDetails, AppError> {
        let parent_json_path = self.config.versions_dir
            .join(parent_version)
            .join(format!("{}.json", parent_version));
        
        if parent_json_path.exists() {
            let parent_json_content = std::fs::read_to_string(&parent_json_path)?;
            return serde_json::from_str(&parent_json_content)
                .map_err(|e| AppError::InvalidParam(format!("Failed to parse parent version JSON: {}", e)));
        }

        let manifest = self.downloader.fetch_version_manifest().await?;
        let version_info = manifest.versions.iter().find(|v| v.id == parent_version)
            .ok_or_else(|| AppError::InvalidParam(format!("Parent version {} not found", parent_version)))?;
        self.downloader.fetch_version_details(&version_info.url).await
    }

    fn get_jar_path(&self, jar_version: &str) -> Result<std::path::PathBuf, AppError> {
        let jar_path = self.config.versions_dir.join(jar_version).join(format!("{}.jar", jar_version));
        
        if !jar_path.exists() {
            return Err(AppError::InvalidParam(format!("Client JAR not found at: {:?}", jar_path)));
        }
        
        Ok(jar_path)
    }

    fn prepare_natives(&self, classpath: &[String], jar_version: &str) -> Result<std::path::PathBuf, AppError> {
        let natives_dir = self.config.versions_dir.join(jar_version).join("natives");
        std::fs::create_dir_all(&natives_dir)?;
        self.extract_natives(classpath, &natives_dir)?;
        Ok(natives_dir)
    }

    fn prepare_game_dir(&self, instance_name: &str) -> Result<std::path::PathBuf, AppError> {
        let game_dir = self.config.get_instance_dir(instance_name);
        std::fs::create_dir_all(&game_dir)?;
        Ok(game_dir)
    }
}

// Classpath building
impl MinecraftLauncher {
    fn build_classpath(
        &self,
        details: &super::config::VersionDetails,
        modded_info: &Option<ModdedVersionInfo>,
        jar_path: &std::path::Path,
        version: &str,
    ) -> Result<Vec<String>, AppError> {
        let mut classpath_map: HashMap<String, (String, usize)> = HashMap::new();
        let mut order_counter: usize = 0;

        for library in &details.libraries {
            if let Some(downloads) = &library.downloads {
                if let Some(artifact) = &downloads.artifact {
                    let lib_path = self.config.libraries_dir.join(&artifact.path);
                    if lib_path.exists() {
                        let path_str = lib_path.to_string_lossy().to_string();
                        let key = self.artifact_id(&library.name);
                        classpath_map.entry(key).or_insert_with(|| {
                            order_counter += 1;
                            (path_str, order_counter)
                        });
                    }
                }
            }
        }
        
        if let Some(mod_info) = modded_info {
            if let Some(mod_libs) = &mod_info.libraries {
                for lib in mod_libs {
                    if let Some(name) = lib.get("name").and_then(|v| v.as_str()) {
                        let lib_path = self.maven_to_path(name);
                        let full_path = self.config.libraries_dir.join(&lib_path);
                        
                        if full_path.exists() {
                            let path_str = full_path.to_string_lossy().to_string();
                            let key = self.artifact_id(name);
                            let existing_order = classpath_map.get(&key).map(|(_, o)| *o);
                            let ord = existing_order.unwrap_or_else(|| {
                                order_counter += 1;
                                order_counter
                            });
                            classpath_map.insert(key, (path_str, ord));
                        }
                    }
                }
            }
        }
        
        let mut classpath_entries: Vec<(String, usize)> = classpath_map.into_values().collect();
        classpath_entries.sort_by_key(|(_, order)| *order);
        let mut classpath: Vec<String> = classpath_entries.into_iter().map(|(path, _)| path).collect();

        self.add_minecraft_jar_to_classpath(&mut classpath, modded_info, jar_path, version);

        Ok(classpath)
    }

    fn add_minecraft_jar_to_classpath(
        &self,
        classpath: &mut Vec<String>,
        modded_info: &Option<ModdedVersionInfo>,
        jar_path: &std::path::Path,
        version: &str,
    ) {
        let is_forge = self.is_forge(modded_info, version);
        let is_neoforge = self.is_neoforge(modded_info, version);

        if is_forge && !is_neoforge {
            if let Some(forge_client) = self.find_forge_client_jar(modded_info, version) {
                if !classpath.contains(&forge_client) {
                    classpath.insert(0, forge_client);
                }
                return;
            }
        }

        // For NeoForge, don't add vanilla JAR - it uses its own mapped JAR via production client provider
        // For other loaders, add the vanilla Minecraft JAR
        if !is_neoforge {
            let minecraft_jar = jar_path.to_string_lossy().to_string();
            if !classpath.contains(&minecraft_jar) {
                classpath.insert(0, minecraft_jar);
            }
        }
    }

    fn find_forge_client_jar(&self, modded_info: &Option<ModdedVersionInfo>, version: &str) -> Option<String> {
        let forge_full_version = if version.starts_with("forge-") {
            version.strip_prefix("forge-")?
        } else {
            modded_info.as_ref()?.inherits_from.as_ref()?.as_str()
        };
        
        let forge_client = self.config.libraries_dir
            .join("net/minecraftforge/forge")
            .join(forge_full_version)
            .join(format!("forge-{}-client.jar", forge_full_version));
        
        if forge_client.exists() {
            Some(forge_client.to_string_lossy().to_string())
        } else {
            None
        }
    }

    fn artifact_id(&self, maven: &str) -> String {
        let coords = maven.split('@').next().unwrap_or(maven);
        let parts: Vec<&str> = coords.split(':').collect();
        if parts.len() >= 4 {
            format!("{}:{}:{}", parts[0], parts[1], parts[3])
        } else if parts.len() >= 2 {
            format!("{}:{}", parts[0], parts[1])
        } else {
            maven.to_string()
        }
    }

    fn is_forge(&self, modded_info: &Option<ModdedVersionInfo>, version: &str) -> bool {
        modded_info.as_ref()
            .and_then(|m| m.main_class.as_ref())
            .map(|mc| mc.contains("forge") || mc.contains("Forge") || mc.contains("neoforge") || mc.contains("NeoForge"))
            .unwrap_or(false) || version.contains("forge") || version.contains("neoforge")
    }

    fn is_neoforge(&self, modded_info: &Option<ModdedVersionInfo>, version: &str) -> bool {
        modded_info.as_ref()
            .and_then(|m| m.main_class.as_ref())
            .map(|mc| mc.contains("neoforge") || mc.contains("NeoForge"))
            .unwrap_or(false) || version.contains("neoforge")
    }
}

// Command building
impl MinecraftLauncher {
    fn build_launch_command(
        &self,
        java_cmd: &str,
        max_memory_mb: u32,
        natives_dir: &std::path::Path,
        jar_path: &std::path::Path,
        game_dir: &std::path::Path,
        classpath: &[String],
        main_class: &str,
        modded_info: &Option<ModdedVersionInfo>,
        version: &str,
    ) -> Command {
        let mut cmd = Command::new(java_cmd);
        
        let max_mem = if max_memory_mb > 0 { max_memory_mb } else { 2048 };
        let min_mem = std::cmp::min(max_mem / 2, 1024);
        cmd.arg(format!("-Xmx{}M", max_mem))
           .arg(format!("-Xms{}M", min_mem));

        cmd.arg(format!("-Djava.library.path={}", natives_dir.to_string_lossy()))
           .arg(format!("-Dorg.lwjgl.librarypath={}", natives_dir.to_string_lossy()));
        
        let is_forge = self.is_forge(modded_info, version);
        let is_neoforge = self.is_neoforge(modded_info, version);

        if is_forge && !is_neoforge {
            self.add_forge_jvm_args(&mut cmd, jar_path, game_dir);
        } else if is_neoforge {
            self.add_neoforge_jvm_args(&mut cmd, jar_path, game_dir, modded_info, version);
        } else if modded_info.is_some() {
            self.add_modded_jvm_args(&mut cmd, modded_info, version);
        }
        
        let classpath_str = classpath.join(if cfg!(windows) { ";" } else { ":" });
        cmd.arg("-cp").arg(&classpath_str).arg(main_class);

        cmd
    }

    fn add_forge_jvm_args(&self, cmd: &mut Command, jar_path: &std::path::Path, game_dir: &std::path::Path) {
        let jar_url = format!("file:///{}", jar_path.to_string_lossy().replace('\\', "/"));
        cmd.arg(format!("-Dminecraft.client.jar={}", jar_url))
           .arg(format!("-Dminecraft.gameDir={}", game_dir.to_string_lossy()))
           .arg(format!("-DignoreList={}", jar_path.file_name().unwrap_or_default().to_string_lossy()))
           .arg("-Dfml.earlyprogresswindow=false");
        
        cmd.arg("--add-opens").arg("java.base/java.lang=ALL-UNNAMED")
           .arg("--add-opens").arg("java.base/java.util=ALL-UNNAMED")
           .arg("--add-opens").arg("java.base/sun.security.util=ALL-UNNAMED")
           .arg("--add-exports").arg("java.base/sun.security.util=ALL-UNNAMED")
           .arg("--add-opens").arg("java.base/java.io=ALL-UNNAMED")
           .arg("--add-opens").arg("java.base/java.nio=ALL-UNNAMED")
           .arg("--add-opens").arg("jdk.naming.dns/com.sun.jndi.dns=ALL-UNNAMED,java.naming")
           .arg("--add-opens").arg("java.base/sun.nio.ch=ALL-UNNAMED")
           .arg("--enable-native-access=ALL-UNNAMED");
    }

    fn add_neoforge_jvm_args(
        &self,
        cmd: &mut Command,
        jar_path: &std::path::Path,
        game_dir: &std::path::Path,
        modded_info: &Option<ModdedVersionInfo>,
        version: &str,
    ) {
        let jar_url = format!("file:///{}", jar_path.to_string_lossy().replace('\\', "/"));
        cmd.arg(format!("-Dminecraft.client.jar={}", jar_url))
           .arg(format!("-Dminecraft.gameDir={}", game_dir.to_string_lossy()))
           .arg("-Dfml.earlyprogresswindow=false");
        
        if let Some(modded_args) = modded_info.as_ref().and_then(|m| m.arguments.as_ref()) {
            self.process_jvm_arguments(cmd, modded_args, version);
        }
    }

    fn add_modded_jvm_args(&self, cmd: &mut Command, modded_info: &Option<ModdedVersionInfo>, version: &str) {
        if let Some(modded_args) = modded_info.as_ref().and_then(|m| m.arguments.as_ref()) {
            self.process_jvm_arguments(cmd, modded_args, version);
        }
    }

    fn process_jvm_arguments(&self, cmd: &mut Command, modded_args: &serde_json::Value, version_name: &str) {
        if let Some(jvm_args) = modded_args.get("jvm").and_then(|v| v.as_array()) {
            for arg in jvm_args {
                if let Some(arg_str) = arg.as_str() {
                    let resolved = self.resolve_argument(arg_str, version_name);
                    cmd.arg(resolved);
                } else if let Some(arg_obj) = arg.as_object() {
                    self.process_conditional_jvm_arg(cmd, arg_obj, version_name);
                }
            }
        }
    }

    fn process_conditional_jvm_arg(
        &self,
        cmd: &mut Command,
        arg_obj: &serde_json::Map<String, serde_json::Value>,
        version_name: &str,
    ) {
        if let Some(rules) = arg_obj.get("rules").and_then(|r| r.as_array()) {
            if !self.should_apply_rule(rules) {
                return;
            }
            
            if let Some(value) = arg_obj.get("value") {
                if let Some(val_str) = value.as_str() {
                    cmd.arg(self.resolve_argument(val_str, version_name));
                } else if let Some(val_arr) = value.as_array() {
                    for v in val_arr {
                        if let Some(v_str) = v.as_str() {
                            cmd.arg(self.resolve_argument(v_str, version_name));
                        }
                    }
                }
            }
        }
    }

    fn should_apply_rule(&self, rules: &[serde_json::Value]) -> bool {
        for rule in rules {
            if let Some(action) = rule.get("action").and_then(|a| a.as_str()) {
                if action == "allow" {
                    if let Some(os) = rule.get("os") {
                        if let Some(name) = os.get("name").and_then(|n| n.as_str()) {
                            return (cfg!(windows) && name == "windows") ||
                                   (cfg!(target_os = "linux") && name == "linux") ||
                                   (cfg!(target_os = "macos") && name == "osx");
                        }
                    } else {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn resolve_argument(&self, arg: &str, version_name: &str) -> String {
        arg.replace("${library_directory}", &self.config.libraries_dir.to_string_lossy())
           .replace("${classpath_separator}", if cfg!(windows) { ";" } else { ":" })
           .replace("${version_name}", version_name)
    }

    fn add_game_arguments(
        &self,
        cmd: &mut Command,
        details: &super::config::VersionDetails,
        modded_info: &Option<ModdedVersionInfo>,
        version: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        game_dir: &std::path::Path,
    ) {
        if let Some(mod_info) = modded_info {
            if let Some(modded_args) = &mod_info.arguments {
                if let Some(game_args) = modded_args.get("game").and_then(|v| v.as_array()) {
                    for arg in game_args {
                        if let Some(arg_str) = arg.as_str() {
                            cmd.arg(self.replace_game_args(arg_str, version, username, uuid, access_token, game_dir, details));
                        }
                    }
                }
            }
        }
        
        if self.is_forge(modded_info, version) && !self.is_neoforge(modded_info, version) {
            self.add_forge_game_args(cmd, modded_info, version);
        }

        if let Some(arguments) = &details.arguments {
            for arg in &arguments.game {
                if let Some(arg_str) = arg.as_str() {
                    cmd.arg(self.replace_game_args(arg_str, version, username, uuid, access_token, game_dir, details));
                }
            }
        } else if let Some(minecraft_arguments) = &details.minecraft_arguments {
            let args = self.replace_game_args(minecraft_arguments, version, username, uuid, access_token, game_dir, details);
            for arg in args.split_whitespace() {
                cmd.arg(arg);
            }
        } else {
            self.add_default_game_args(cmd, version, username, uuid, access_token, game_dir, details);
        }
    }

    fn add_forge_game_args(&self, cmd: &mut Command, modded_info: &Option<ModdedVersionInfo>, version: &str) {
        let forge_full_version = if version.starts_with("forge-") {
            version.strip_prefix("forge-").unwrap_or(version)
        } else if let Some(inherits) = modded_info.as_ref().and_then(|m| m.inherits_from.as_ref()) {
            if inherits.starts_with("forge-") {
                inherits.strip_prefix("forge-").unwrap_or(inherits)
            } else {
                inherits
            }
        } else {
            version
        };
        
        let pks_arg = format!("net.minecraftforge:forge:{}:client", forge_full_version);
        cmd.arg("--pks").arg(pks_arg);
    }

    fn add_default_game_args(
        &self,
        cmd: &mut Command,
        version: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        game_dir: &std::path::Path,
        details: &super::config::VersionDetails,
    ) {
        let assets_dir = self.config.assets_dir.to_string_lossy().to_string();
        cmd.arg("--username").arg(username)
           .arg("--version").arg(version)
           .arg("--gameDir").arg(game_dir.to_string_lossy().as_ref())
           .arg("--assetsDir").arg(&assets_dir)
           .arg("--assetIndex").arg(&details.asset_index.id)
           .arg("--uuid").arg(uuid)
           .arg("--accessToken").arg(access_token)
           .arg("--userType").arg("msa")
           .arg("--versionType").arg("release");
    }

    fn replace_game_args(
        &self,
        arg_str: &str,
        version: &str,
        username: &str,
        uuid: &str,
        access_token: &str,
        game_dir: &std::path::Path,
        details: &super::config::VersionDetails,
    ) -> String {
        let assets_dir = self.config.assets_dir.to_string_lossy().to_string();
        arg_str
            .replace("${auth_player_name}", username)
            .replace("${version_name}", version)
            .replace("${game_directory}", game_dir.to_string_lossy().as_ref())
            .replace("${assets_root}", &assets_dir)
            .replace("${assets_index_name}", &details.asset_index.id)
            .replace("${auth_uuid}", uuid)
            .replace("${auth_access_token}", access_token)
            .replace("${user_type}", "msa")
            .replace("${version_type}", "release")
            .replace("${user_properties}", "{}")
    }
}

// Java detection with caching
impl MinecraftLauncher {
    fn get_java_for_version(&self, version: &str) -> Result<String, AppError> {
        if let Some(cached) = self.get_cached_java(version) {
            return Ok(cached);
        }

        let java_cmd = self.detect_java_for_version(version)?;
        self.cache_java(version, java_cmd.clone());
        Ok(java_cmd)
    }

    fn detect_java_for_version(&self, version: &str) -> Result<String, AppError> {
        let base_version = self.extract_base_version(version);
        let version_parts: Vec<&str> = base_version.split('.').collect();
        
        if version_parts.len() < 2 {
            return Ok("java".to_string());
        }

        let major = version_parts[0];
        let minor = version_parts[1].parse::<i32>().unwrap_or(0);
        let patch = if version_parts.len() >= 3 {
            version_parts[2].parse::<i32>().unwrap_or(0)
        } else {
            0
        };

        if major != "1" {
            return Ok("java".to_string());
        }

        if minor == 21 && patch >= 10 {
            return self.find_java(25);
        }
        
        if (minor == 20 && patch >= 1) || (minor == 21 && patch < 10) {
            return self.find_java(21);
        }
        
        if (minor == 16 && patch >= 5) || (minor >= 17 && minor <= 20) {
            return self.find_java(17);
        }
        
        if (minor >= 12 && minor < 16) || (minor == 16 && patch < 5) {
            if let Ok(java8) = self.find_java(8) {
                return Ok(java8);
            }
            return self.find_java(17);
        }
        
        if minor >= 7 && minor <= 11 {
            return self.find_java(8);
        }

        Ok("java".to_string())
    }

    fn extract_base_version<'a>(&self, version: &'a str) -> &'a str {
        if version.contains("forge-") || version.contains("fabric-") || 
           version.contains("quilt-") || version.contains("neoforge-") {
            let parts: Vec<&str> = version.split('-').collect();
            if parts.len() >= 2 { 
                return parts[1]; 
            }
        }
        version
    }

    fn find_java(&self, version: u8) -> Result<String, AppError> {
        if let Some(custom_path) = self.find_custom_java(version) {
            return Ok(custom_path);
        }

        let possible_paths = vec![
            format!("C:\\Program Files\\Java\\jdk-{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Java\\jdk{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Eclipse Adoptium\\jdk-{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Eclipse Adoptium\\jdk-{}-hotspot\\bin\\java.exe", version),
            format!("C:\\Program Files\\Microsoft\\jdk-{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Zulu\\zulu-{}\\bin\\java.exe", version),
            format!("C:\\Program Files (x86)\\Java\\jdk-{}\\bin\\java.exe", version),
            format!("C:\\Program Files\\Java\\jre-{}\\bin\\java.exe", version),
            format!("C:\\Program Files (x86)\\Java\\jre{}\\bin\\java.exe", version),
        ];

        for path in possible_paths {
            if std::path::Path::new(&path).exists() {
                return Ok(path);
            }
        }
        
        Err(AppError::InvalidParam(format!(
            "Java {} not found. Please install Java {} or set a custom path in Settings.", 
            version, version
        )))
    }

    fn find_custom_java(&self, version: u8) -> Option<String> {
        let config_dir = dirs::config_dir()?;
        let java_config_path = config_dir.join("limen").join("java_paths.json");
        
        if !java_config_path.exists() {
            return None;
        }

        let content = std::fs::read_to_string(&java_config_path).ok()?;
        let custom_paths = serde_json::from_str::<Vec<crate::JavaInstallation>>(&content).ok()?;
        
        for java in custom_paths {
            if java.version == version && std::path::Path::new(&java.path).exists() {
                return Some(java.path);
            }
        }
        
        None
    }
}

// Utility methods
impl MinecraftLauncher {
    fn extract_natives(&self, classpath: &[String], natives_dir: &std::path::Path) -> Result<(), AppError> {
        use std::io::Read;

        for entry in classpath {
            let path = std::path::Path::new(entry);
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if !file_name.contains("natives") || !file_name.ends_with(".jar") || !path.exists() {
                continue;
            }

            let file = match std::fs::File::open(path) {
                Ok(f) => f,
                Err(_) => continue,
            };
            
            let mut archive = match zip::ZipArchive::new(file) {
                Ok(a) => a,
                Err(_) => continue,
            };

            for i in 0..archive.len() {
                let mut entry = match archive.by_index(i) {
                    Ok(e) => e,
                    Err(_) => continue,
                };

                let name = entry.name().to_string();
                if name.ends_with(".dll") || name.ends_with(".so") || name.ends_with(".dylib") {
                    let out_name = std::path::Path::new(&name).file_name().unwrap_or(std::ffi::OsStr::new(&name));
                    let target = natives_dir.join(out_name);

                    if !target.exists() {
                        let mut buf = Vec::new();
                        if entry.read_to_end(&mut buf).is_ok() {
                            let _ = std::fs::write(&target, buf);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn maven_to_path(&self, maven: &str) -> String {
        let (coords, packaging) = if let Some((c, p)) = maven.split_once('@') {
            (c, p)
        } else {
            (maven, "jar")
        };
        
        let parts: Vec<&str> = coords.split(':').collect();
        if parts.len() < 3 {
            return maven.to_string();
        }
        
        let group = parts[0].replace('.', "/");
        let artifact = parts[1];
        let version = parts[2];
        let classifier = if parts.len() >= 4 { Some(parts[3]) } else { None };
        
        let file_name = match classifier {
            Some(c) => format!("{}-{}-{}.{}", artifact, version, c, packaging),
            None => format!("{}-{}.{}", artifact, version, packaging),
        };
        
        format!("{}/{}/{}/{}", group, artifact, version, file_name)
    }
}
