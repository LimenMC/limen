use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};
use sysinfo::{System, Pid, ProcessRefreshKind};
use crate::discord::{DiscordRpc, Activity, Timestamps, Assets, Button};
use crate::minecraft::MinecraftLogParser;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSessionInfo {
    pub profile_id: String,
    pub profile_name: String,
    pub start_time: u64,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone)]
struct GameSession {
    profile_id: String,
    profile_name: String,
    start_time: u64,
    pid: Option<u32>,
}

#[derive(Debug, Clone, Default)]
pub struct ProcessTracker {
    current_session: Arc<RwLock<Option<GameSession>>>,
    system: Arc<RwLock<System>>,
    discord_rpc: Arc<RwLock<Option<DiscordRpc>>>,
    rpc_enabled: Arc<RwLock<bool>>,
    log_parser: Arc<RwLock<Option<MinecraftLogParser>>>,
    last_discord_update: Arc<RwLock<u64>>,
}

impl ProcessTracker {
    pub fn new() -> Self {
        Self {
            current_session: Arc::new(RwLock::new(None)),
            system: Arc::new(RwLock::new(System::new())),
            discord_rpc: Arc::new(RwLock::new(None)),
            rpc_enabled: Arc::new(RwLock::new(true)),
            log_parser: Arc::new(RwLock::new(None)),
            last_discord_update: Arc::new(RwLock::new(0)),
        }
    }

    pub fn start_session(
        &self,
        profile_id: String,
        profile_name: String,
        pid: Option<u32>,
        game_dir: Option<std::path::PathBuf>,
    ) {
        let now = Self::current_timestamp();

        let session = GameSession {
            profile_id,
            profile_name: profile_name.clone(),
            start_time: now,
            pid,
        };

        if let Ok(mut current) = self.current_session.write() {
            *current = Some(session);
        }

        if let Some(dir) = game_dir {
            let parser = MinecraftLogParser::new(dir);
            parser.start_monitoring();
            if let Ok(mut log_parser) = self.log_parser.write() {
                *log_parser = Some(parser);
            }
        }

        self.update_discord_presence(&profile_name, now);
    }

    pub fn end_session(&self) {
        if let Ok(mut current) = self.current_session.write() {
            *current = None;
        }

        if let Ok(mut log_parser) = self.log_parser.write() {
            if let Some(parser) = log_parser.as_ref() {
                parser.stop();
            }
            *log_parser = None;
        }

        self.clear_discord_presence();
    }

    pub fn get_current_session(&self) -> Option<GameSessionInfo> {
        self.check_process_alive();
        
        self.current_session.read().ok()?.as_ref().map(|s| GameSessionInfo {
            profile_id: s.profile_id.clone(),
            profile_name: s.profile_name.clone(),
            start_time: s.start_time,
            pid: s.pid,
        })
    }

    pub fn is_playing(&self) -> bool {
        self.check_process_alive();
        
        if let Ok(current) = self.current_session.read() {
            current.is_some()
        } else {
            false
        }
    }

    pub fn get_play_duration(&self) -> Option<u64> {
        self.check_process_alive();
        
        let current = self.current_session.read().ok()?;
        let session = current.as_ref()?;
        Some(Self::current_timestamp() - session.start_time)
    }

    pub fn set_pid(&self, pid: u32) {
        if let Ok(mut current) = self.current_session.write() {
            if let Some(session) = current.as_mut() {
                session.pid = Some(pid);
            }
        }
    }

    fn check_process_alive(&self) {
        let session_info = {
            let current = match self.current_session.read() {
                Ok(c) => c,
                Err(_) => return,
            };
            
            match current.as_ref() {
                Some(s) => (s.pid, s.profile_name.clone(), s.start_time),
                None => return,
            }
        };

        let (pid_opt, profile_name, start_time) = session_info;
        
        if let Some(pid) = pid_opt {
            let is_alive = {
                let mut sys = match self.system.write() {
                    Ok(s) => s,
                    Err(_) => return,
                };
                sys.refresh_processes_specifics(ProcessRefreshKind::new());
                sys.process(Pid::from_u32(pid)).is_some()
            };

            if !is_alive {
                self.end_session();
            } else {
                self.update_discord_presence_throttled(&profile_name, start_time);
            }
        }
    }

    fn update_discord_presence_throttled(&self, profile_name: &str, start_time: u64) {
        let now = Self::current_timestamp();
        let last_update = self.last_discord_update.read().ok().map(|t| *t).unwrap_or(0);
        
        if now - last_update < 5 {
            return;
        }

        if let Ok(mut last) = self.last_discord_update.write() {
            *last = now;
        }

        self.update_discord_presence(profile_name, start_time);
    }

    fn update_discord_presence(&self, profile_name: &str, start_time: u64) {
        let enabled = self.rpc_enabled.read().ok().map(|e| *e).unwrap_or(false);
        if !enabled {
            return;
        }

        let (state_text, details_text) = self.get_activity_text(profile_name);
        
        let mut rpc = match self.discord_rpc.write() {
            Ok(r) => r,
            Err(_) => return,
        };

        if rpc.is_none() || !rpc.as_ref().unwrap().is_connected() {
            let mut new_rpc = DiscordRpc::new();
            if new_rpc.connect().is_ok() {
                *rpc = Some(new_rpc);
            } else {
                return;
            }
        }

        if let Some(rpc_client) = rpc.as_mut() {
            let activity = Activity {
                state: Some(state_text),
                details: details_text,
                timestamps: Some(Timestamps {
                    start: Some(start_time),
                    end: None,
                }),
                assets: Some(Assets {
                    large_image: Some("minecraft_logo".to_string()),
                    large_text: Some("Minecraft".to_string()),
                    small_image: None,
                    small_text: None,
                }),
                buttons: Some(vec![Button {
                    label: "Download Now".to_string(),
                    url: "https://github.com/".to_string(),
                }]),
            };

            if rpc_client.set_activity(Some(activity)).is_err() {
                *rpc = None;
            }
        }
    }

    fn get_activity_text(&self, profile_name: &str) -> (String, Option<String>) {
        let log_parser = match self.log_parser.read() {
            Ok(p) => p,
            Err(_) => return ("Playing Minecraft".to_string(), Some(profile_name.to_string())),
        };

        if let Some(parser) = log_parser.as_ref() {
            use crate::minecraft::log_parser::GameState;
            
            match parser.get_current_state() {
                GameState::Multiplayer(server) => {
                    let server_display = Self::format_server_name(&server);
                    ("Playing on a server".to_string(), Some(format!("{} • {}", profile_name, server_display)))
                }
                GameState::Singleplayer(world) => {
                    ("Playing solo".to_string(), Some(format!("{} • {}", profile_name, world)))
                }
                GameState::MainMenu => {
                    ("In main menu".to_string(), Some(profile_name.to_string()))
                }
            }
        } else {
            ("Playing Minecraft".to_string(), Some(profile_name.to_string()))
        }
    }

    fn format_server_name(server: &str) -> String {
        let parts: Vec<&str> = server.split('.').collect();
        if parts.len() >= 2 {
            parts[parts.len() - 2].to_string()
        } else {
            server.to_string()
        }
    }

    fn clear_discord_presence(&self) {
        if let Ok(mut rpc) = self.discord_rpc.write() {
            if let Some(rpc_client) = rpc.as_mut() {
                let _ = rpc_client.clear_activity();
                rpc_client.disconnect();
            }
            *rpc = None;
        }
    }

    pub fn enable_discord_rpc(&self) {
        if let Ok(mut enabled) = self.rpc_enabled.write() {
            *enabled = true;
        }
    }

    pub fn disable_discord_rpc(&self) {
        if let Ok(mut enabled) = self.rpc_enabled.write() {
            *enabled = false;
        }
        self.clear_discord_presence();
    }

    pub fn update_activity(&self, activity_type: &str, details: Option<&str>) {
        let enabled = self.rpc_enabled.read().ok().map(|e| *e).unwrap_or(false);
        if !enabled {
            return;
        }

        let mut rpc = match self.discord_rpc.write() {
            Ok(r) => r,
            Err(_) => return,
        };

        if rpc.is_none() || !rpc.as_ref().unwrap().is_connected() {
            let mut new_rpc = DiscordRpc::new();
            if new_rpc.connect().is_ok() {
                *rpc = Some(new_rpc);
            } else {
                return;
            }
        }

        if let Some(rpc_client) = rpc.as_mut() {
            let (state, detail_text) = match activity_type {
                "idle" => ("Idling...".to_string(), None),
                "browsing" => ("Browsing Mods".to_string(), None),
                "playing" => ("Playing Minecraft".to_string(), details.map(|d| d.to_string())),
                _ => ("In Limen".to_string(), None),
            };

            let activity = Activity {
                state: Some(state),
                details: detail_text,
                timestamps: None,
                assets: Some(Assets {
                    large_image: Some("limen_logo".to_string()),
                    large_text: Some("Limen".to_string()),
                    small_image: None,
                    small_text: None,
                }),
                buttons: Some(vec![Button {
                    label: "Download Now".to_string(),
                    url: "https://github.com/".to_string(),
                }]),
            };

            if rpc_client.set_activity(Some(activity)).is_err() {
                *rpc = None;
            }
        }
    }

    fn current_timestamp() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}
