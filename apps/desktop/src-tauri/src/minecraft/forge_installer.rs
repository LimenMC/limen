use crate::AppError;
use reqwest::Client;
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Read;

pub struct ForgeInstaller {
    client: Client,
    limen_dir: PathBuf,
}

impl ForgeInstaller {
    pub fn new(limen_dir: PathBuf) -> Self {
        Self {
            client: Client::builder()
                .user_agent("Limen/0.1.0")
                .build()
                .expect("Failed to build HTTP client"),
            limen_dir,
        }
    }

    pub fn is_installed(&self, forge_version: &str) -> bool {
        let full_version = if forge_version.contains('-') {
            forge_version.to_string()
        } else {
            forge_version.to_string()
        };
        let forge_version_name = format!("forge-{}", full_version);
        let version_json = self.limen_dir
            .join("minecraft")
            .join("versions")
            .join(&forge_version_name)
            .join(format!("{}.json", forge_version_name));
        
        version_json.exists()
    }

    pub async fn install_forge(
        &self,
        game_version: &str,
        forge_version: &str,
    ) -> Result<String, AppError> {
        let full_version = if forge_version.contains('-') {
            forge_version.to_string()
        } else {
            format!("{}-{}", game_version, forge_version)
        };
        let forge_version_name = format!("forge-{}", full_version);
        let version_dir = self.limen_dir.join("minecraft").join("versions").join(&forge_version_name);
        fs::create_dir_all(&version_dir)?;

        let installer_url = format!(
            "https://maven.minecraftforge.net/net/minecraftforge/forge/{}/forge-{}-installer.jar",
            full_version, full_version
        );
        let installer_path = version_dir.join("forge-installer.jar");
        
        self.download_installer(&installer_url, &installer_path).await?;
        let (version_json, install_profile, libs_to_download) =
            self.extract_data(&installer_path, game_version, &forge_version_name)?;
        
        self.save_version_json(&version_dir, &forge_version_name, &version_json)?;
        
        if !libs_to_download.is_empty() {
            self.download_libraries(&libs_to_download).await?;
        }

        if let Some(profile) = &install_profile {
            self.run_forge_processors(&installer_path, profile, game_version)?;
        } else {
            self.copy_vanilla_as_forge_client(game_version, &full_version)?;
        }

        self.cleanup(&installer_path);
        Ok(forge_version_name)
    }

    async fn download_installer(&self, url: &str, path: &Path) -> Result<(), AppError> {
        let response = self.client.get(url).send().await?;
        if !response.status().is_success() {
            return Err(AppError::ApiError(format!(
                "Failed to download Forge installer: HTTP {}",
                response.status()
            )));
        }
        let bytes = response.bytes().await?;
        fs::write(path, bytes)?;
        Ok(())
    }

    fn save_version_json(
        &self,
        version_dir: &Path,
        version_name: &str,
        version_json: &serde_json::Value,
    ) -> Result<(), AppError> {
        let json_path = version_dir.join(format!("{}.json", version_name));
        fs::write(json_path, serde_json::to_string_pretty(version_json)?)?;
        Ok(())
    }

    fn copy_vanilla_as_forge_client(&self, game_version: &str, full_version: &str) -> Result<(), AppError> {
        let vanilla_jar = self.limen_dir.join("minecraft").join("versions")
            .join(game_version).join(format!("{}.jar", game_version));
        
        if vanilla_jar.exists() {
            let forge_client_path = format!("net/minecraftforge/forge/{}/forge-{}-client.jar", full_version, full_version);
            let target_path = self.limen_dir.join("minecraft").join("libraries").join(&forge_client_path);
            
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&vanilla_jar, &target_path)?;
        }
        Ok(())
    }

    fn cleanup(&self, installer_path: &Path) {
        let _ = fs::remove_file(installer_path);
        let _ = fs::remove_dir_all(self.limen_dir.join("minecraft").join("forge_data_temp"));
    }

    fn extract_data(
        &self,
        installer_path: &Path,
        game_version: &str,
        forge_version_name: &str,
    ) -> Result<(serde_json::Value, Option<serde_json::Value>, Vec<serde_json::Value>), AppError> {
        let file = fs::File::open(installer_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        let mut version_json = self.extract_version_json(&mut archive, forge_version_name)?;
        self.update_version_json(&mut version_json, game_version, forge_version_name);
        
        let install_profile = self.extract_install_profile(&mut archive);
        
        self.extract_maven_libraries(installer_path)?;
        
        let all_libs = self.collect_libraries(&version_json, &install_profile);

        Ok((version_json, install_profile, all_libs))
    }

    fn extract_version_json(
        &self,
        archive: &mut zip::ZipArchive<fs::File>,
        forge_version_name: &str,
    ) -> Result<serde_json::Value, AppError> {
        let mut f = archive.by_name("version.json")
            .map_err(|_| AppError::InvalidParam(format!(
                "No version.json in Forge installer for {}",
                forge_version_name
            )))?;
        let mut s = String::new();
        f.read_to_string(&mut s)?;
        Ok(serde_json::from_str(&s)?)
    }

    fn update_version_json(
        &self,
        version_json: &mut serde_json::Value,
        game_version: &str,
        forge_version_name: &str,
    ) {
        if let Some(obj) = version_json.as_object_mut() {
            obj.insert("id".to_string(), serde_json::json!(forge_version_name));
            obj.insert("inheritsFrom".to_string(), serde_json::json!(game_version));
            obj.insert("type".to_string(), serde_json::json!("release"));
        }
    }

    fn extract_install_profile(
        &self,
        archive: &mut zip::ZipArchive<fs::File>,
    ) -> Option<serde_json::Value> {
        if let Ok(mut f) = archive.by_name("install_profile.json") {
            let mut s = String::new();
            f.read_to_string(&mut s).ok()?;
            serde_json::from_str(&s).ok()
        } else {
            None
        }
    }

    fn extract_maven_libraries(&self, installer_path: &Path) -> Result<(), AppError> {
        let libraries_dir = self.limen_dir.join("minecraft").join("libraries");
        fs::create_dir_all(&libraries_dir)?;

        let file = fs::File::open(installer_path)?;
        let mut archive = zip::ZipArchive::new(file)?;
        
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)?;
            let name = entry.name().to_string();
            
            if name.starts_with("maven/") && !entry.is_dir() {
                let rel = name.strip_prefix("maven/").unwrap();
                let target = libraries_dir.join(rel);
                
                if let Some(p) = target.parent() {
                    fs::create_dir_all(p)?;
                }
                
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf)?;
                fs::write(&target, buf)?;
            }
        }
        Ok(())
    }

    fn collect_libraries(
        &self,
        version_json: &serde_json::Value,
        install_profile: &Option<serde_json::Value>,
    ) -> Vec<serde_json::Value> {
        let mut all_libs = Vec::new();
        
        if let Some(libs) = version_json.get("libraries").and_then(|l| l.as_array()) {
            all_libs.extend(libs.clone());
        }
        
        if let Some(ref profile) = install_profile {
            if let Some(libs) = profile.get("libraries").and_then(|l| l.as_array()) {
                all_libs.extend(libs.clone());
            }
        }
        
        all_libs
    }

    fn run_forge_processors(
        &self,
        installer_path: &Path,
        install_profile: &serde_json::Value,
        game_version: &str,
    ) -> Result<(), AppError> {
        let libraries_dir = self.limen_dir.join("minecraft").join("libraries");
        let minecraft_jar = self.limen_dir.join("minecraft").join("versions")
            .join(game_version).join(format!("{}.jar", game_version));
        let minecraft_dir = self.limen_dir.join("minecraft");
        let java_cmd = self.find_java()?;

        self.extract_data_files(installer_path)?;

        let data_dir = self.limen_dir.join("minecraft").join("forge_data_temp");
        let data_map = install_profile.get("data").and_then(|d| d.as_object());
        let processors = install_profile.get("processors").and_then(|p| p.as_array())
            .ok_or_else(|| AppError::InvalidParam("No processors in install_profile".into()))?;

        for proc_entry in processors.iter() {
            if !self.should_run_processor(proc_entry) {
                continue;
            }

            if self.check_outputs(proc_entry, &data_map, &libraries_dir, &minecraft_jar, &data_dir, installer_path, &minecraft_dir) {
                continue;
            }

            let jar_name = proc_entry.get("jar").and_then(|j| j.as_str()).unwrap_or("");
            let jar_path = libraries_dir.join(self.maven_to_path(jar_name));
            
            if !jar_path.exists() {
                continue;
            }

            self.run_processor(&java_cmd, &jar_path, proc_entry, &data_map, &libraries_dir, &minecraft_jar, &data_dir, installer_path, &minecraft_dir)?;
        }

        Ok(())
    }

    fn extract_data_files(&self, installer_path: &Path) -> Result<(), AppError> {
        let data_dir = self.limen_dir.join("minecraft").join("forge_data_temp");
        fs::create_dir_all(&data_dir)?;
        
        let file = fs::File::open(installer_path)?;
        let mut archive = zip::ZipArchive::new(file)?;
        
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)?;
            let name = entry.name().to_string();
            
            if name.starts_with("data/") && !entry.is_dir() {
                let target = data_dir.join(&name);
                if let Some(p) = target.parent() {
                    fs::create_dir_all(p)?;
                }
                let mut buf = Vec::new();
                entry.read_to_end(&mut buf)?;
                fs::write(&target, buf)?;
            }
        }
        Ok(())
    }

    fn should_run_processor(&self, proc_entry: &serde_json::Value) -> bool {
        if let Some(sides) = proc_entry.get("sides").and_then(|s| s.as_array()) {
            sides.iter().any(|s| s.as_str() == Some("client"))
        } else {
            true
        }
    }

    fn run_processor(
        &self,
        java_cmd: &str,
        jar_path: &Path,
        proc_entry: &serde_json::Value,
        data_map: &Option<&serde_json::Map<String, serde_json::Value>>,
        libraries_dir: &Path,
        minecraft_jar: &Path,
        data_dir: &Path,
        installer_path: &Path,
        minecraft_dir: &Path,
    ) -> Result<(), AppError> {
        let main_class = self.get_main_class(jar_path)?;
        let classpath = self.build_classpath(jar_path, proc_entry, libraries_dir);
        let args = self.build_processor_args(proc_entry, data_map, libraries_dir, minecraft_jar, data_dir, installer_path, minecraft_dir)?;

        let cp_str = classpath.join(if cfg!(windows) { ";" } else { ":" });
        let output = std::process::Command::new(java_cmd)
            .arg("-cp").arg(&cp_str)
            .arg(&main_class)
            .args(&args)
            .output()?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let jar_name = proc_entry.get("jar").and_then(|j| j.as_str()).unwrap_or("unknown");
            return Err(AppError::ApiError(format!("Forge processor {} failed: {}", jar_name, stderr)));
        }
        Ok(())
    }

    fn build_classpath(&self, jar_path: &Path, proc_entry: &serde_json::Value, libraries_dir: &Path) -> Vec<String> {
        let mut cp = vec![jar_path.to_string_lossy().to_string()];
        
        if let Some(classpath) = proc_entry.get("classpath").and_then(|c| c.as_array()) {
            for e in classpath {
                if let Some(n) = e.as_str() {
                    let p = libraries_dir.join(self.maven_to_path(n));
                    if p.exists() {
                        cp.push(p.to_string_lossy().to_string());
                    }
                }
            }
        }
        cp
    }

    fn build_processor_args(
        &self,
        proc_entry: &serde_json::Value,
        data_map: &Option<&serde_json::Map<String, serde_json::Value>>,
        libraries_dir: &Path,
        minecraft_jar: &Path,
        data_dir: &Path,
        installer_path: &Path,
        minecraft_dir: &Path,
    ) -> Result<Vec<String>, AppError> {
        let mut args = Vec::new();
        
        if let Some(proc_args) = proc_entry.get("args").and_then(|a| a.as_array()) {
            for a in proc_args {
                if let Some(s) = a.as_str() {
                    args.push(self.resolve_arg(s, data_map, libraries_dir, minecraft_jar, data_dir, installer_path, minecraft_dir)?);
                }
            }
        }
        Ok(args)
    }

    fn resolve_arg(
        &self, value: &str,
        data_map: &Option<&serde_json::Map<String, serde_json::Value>>,
        libraries_dir: &Path, minecraft_jar: &Path,
        data_dir: &Path, installer_path: &Path, minecraft_dir: &Path,
    ) -> Result<String, AppError> {
        if value.starts_with('{') && value.ends_with('}') {
            let var = &value[1..value.len()-1];
            return match var {
                "MINECRAFT_JAR" => Ok(minecraft_jar.to_string_lossy().to_string()),
                "INSTALLER" => Ok(installer_path.to_string_lossy().to_string()),
                "ROOT" => Ok(minecraft_dir.to_string_lossy().to_string()),
                "LIBRARY_DIR" => Ok(libraries_dir.to_string_lossy().to_string()),
                "SIDE" => Ok("client".to_string()),
                _ => {
                    if let Some(map) = data_map {
                        if let Some(entry) = map.get(var) {
                            let val = entry.get("client").and_then(|v| v.as_str()).unwrap_or("");
                            return self.resolve_data_entry(val, libraries_dir, data_dir);
                        }
                    }
                    Ok(value.to_string())
                }
            };
        }
        if value.starts_with('[') {
            return self.resolve_data_entry(value, libraries_dir, data_dir);
        }
        Ok(value.to_string())
    }

    fn resolve_data_entry(&self, value: &str, libraries_dir: &Path, data_dir: &Path) -> Result<String, AppError> {
        if value.starts_with('[') {
            let end = value.find(']').unwrap_or(value.len());
            let maven = &value[1..end];
            let lib_path = libraries_dir.join(self.maven_to_path(maven));
            if end + 1 < value.len() {
                let inner = value[end+1..].trim_start_matches('/');
                return self.extract_from_jar(&lib_path, inner);
            }
            return Ok(lib_path.to_string_lossy().to_string());
        }
        if value.starts_with('/') {
            let rel = value.trim_start_matches('/');
            return Ok(data_dir.join(rel).to_string_lossy().to_string());
        }
        Ok(value.to_string())
    }

    fn extract_from_jar(&self, jar_path: &Path, inner_path: &str) -> Result<String, AppError> {
        let temp_dir = self.limen_dir.join("minecraft").join("forge_data_temp").join("extracted");
        fs::create_dir_all(&temp_dir)?;
        let safe_name = inner_path.replace('/', "_").replace('\\', "_");
        let target = temp_dir.join(&safe_name);
        if target.exists() {
            return Ok(target.to_string_lossy().to_string());
        }
        let file = fs::File::open(jar_path)?;
        let mut archive = zip::ZipArchive::new(file)?;
        let mut entry = archive.by_name(inner_path)
            .map_err(|_| AppError::InvalidParam(format!("{} not found in {:?}", inner_path, jar_path)))?;
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf)?;
        fs::write(&target, buf)?;
        Ok(target.to_string_lossy().to_string())
    }

    fn get_main_class(&self, jar_path: &Path) -> Result<String, AppError> {
        let file = fs::File::open(jar_path)?;
        let mut archive = zip::ZipArchive::new(file)?;
        let mut manifest = archive.by_name("META-INF/MANIFEST.MF")
            .map_err(|_| AppError::InvalidParam(format!("No MANIFEST.MF in {:?}", jar_path)))?;
        let mut contents = String::new();
        manifest.read_to_string(&mut contents)?;
        for line in contents.lines() {
            if line.starts_with("Main-Class:") {
                return Ok(line.trim_start_matches("Main-Class:").trim().to_string());
            }
        }
        Err(AppError::InvalidParam(format!("No Main-Class in {:?}", jar_path)))
    }

    fn check_outputs(
        &self, proc_entry: &serde_json::Value,
        data_map: &Option<&serde_json::Map<String, serde_json::Value>>,
        libraries_dir: &Path, minecraft_jar: &Path,
        data_dir: &Path, installer_path: &Path, minecraft_dir: &Path,
    ) -> bool {
        let outputs = match proc_entry.get("outputs").and_then(|o| o.as_object()) {
            Some(o) => o,
            None => return false,
        };
        for (key, _) in outputs {
            match self.resolve_arg(key, data_map, libraries_dir, minecraft_jar, data_dir, installer_path, minecraft_dir) {
                Ok(path) => {
                    if !Path::new(&path).exists() { return false; }
                }
                Err(_) => return false,
            }
        }
        true
    }

    // Download libraries from Forge Maven and fallback repositories
    async fn download_libraries(&self, libraries: &[serde_json::Value]) -> Result<(), AppError> {
        use futures::stream::{self, StreamExt};
        
        let libraries_dir = self.limen_dir.join("minecraft").join("libraries");
        fs::create_dir_all(&libraries_dir)?;

        let mut to_download = Vec::new();
        
        for lib in libraries {
            let name = match lib.get("name").and_then(|n| n.as_str()) {
                Some(n) => n,
                None => continue,
            };
            if name.contains(":client") && name.starts_with("net.minecraftforge:forge:") {
                continue;
            }
            let lib_path = self.maven_to_path(name);
            let lib_file = libraries_dir.join(&lib_path);
            if lib_file.exists() {
                continue;
            }
            
            let lib_url = self.resolve_lib_url(lib, &lib_path);
            to_download.push((lib_url, lib_path, lib_file));
        }
        
        let results: Vec<_> = stream::iter(to_download.into_iter())
            .map(|(lib_url, lib_path, lib_file)| {
                let client = self.client.clone();
                async move {
                    if let Some(parent) = lib_file.parent() { 
                        fs::create_dir_all(parent)?; 
                    }

                    match client.get(&lib_url).send().await {
                        Ok(r) if r.status().is_success() => {
                            let bytes = r.bytes().await?;
                            fs::write(&lib_file, bytes)?;
                            Ok::<(), AppError>(())
                        }
                        Ok(_) => {
                            let fallback = format!("https://libraries.minecraft.net/{}", lib_path);
                            if let Ok(r2) = client.get(&fallback).send().await {
                                if r2.status().is_success() {
                                    let bytes = r2.bytes().await?;
                                    fs::write(&lib_file, bytes)?;
                                    return Ok::<(), AppError>(());
                                }
                            }
                            Ok(())
                        }
                        Err(_) => Ok(()),
                    }
                }
            })
            .buffer_unordered(8)
            .collect()
            .await;
        
        for result in results {
            result?;
        }
        
        Ok(())
    }

    fn resolve_lib_url(&self, lib: &serde_json::Value, lib_path: &str) -> String {
        if let Some(url) = lib.get("downloads")
            .and_then(|d| d.get("artifact"))
            .and_then(|a| a.get("url"))
            .and_then(|u| u.as_str())
            .filter(|u| !u.is_empty())
        {
            return url.to_string();
        }
        let base = lib.get("url").and_then(|u| u.as_str()).filter(|s| !s.is_empty())
            .unwrap_or("https://maven.minecraftforge.net/");
        let base = if base.ends_with('/') { base.to_string() } else { format!("{}/", base) };
        format!("{}{}", base, lib_path)
    }

    fn find_java(&self) -> Result<String, AppError> {
        for ver in [25u8, 21, 17] {
            let paths = [
                format!("C:\\Program Files\\Java\\jdk-{}\\bin\\java.exe", ver),
                format!("C:\\Program Files\\Java\\jdk{}\\bin\\java.exe", ver),
                format!("C:\\Program Files\\Eclipse Adoptium\\jdk-{}\\bin\\java.exe", ver),
                format!("C:\\Program Files\\Eclipse Adoptium\\jdk-{}-hotspot\\bin\\java.exe", ver),
                format!("C:\\Program Files\\Microsoft\\jdk-{}\\bin\\java.exe", ver),
            ];
            for p in &paths {
                if Path::new(p).exists() { return Ok(p.clone()); }
            }
        }
        Ok("java".to_string())
    }

    fn maven_to_path(&self, maven: &str) -> String {
        let (coords, packaging) = if let Some((c, p)) = maven.split_once('@') { (c, p) } else { (maven, "jar") };
        let parts: Vec<&str> = coords.split(':').collect();
        if parts.len() < 3 { return maven.to_string(); }
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
