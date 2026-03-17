use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, PartialEq)]
pub enum GameState {
    MainMenu,
    Singleplayer(String),
    Multiplayer(String),
}

#[derive(Debug, Clone)]
pub struct MinecraftLogParser {
    log_path: PathBuf,
    last_position: Arc<AtomicU64>,
    game_state: Arc<RwLock<GameState>>,
    running: Arc<AtomicBool>,
}

impl MinecraftLogParser {
    pub fn new(game_dir: PathBuf) -> Self {
        let log_path = game_dir.join("logs").join("latest.log");
        
        Self {
            log_path,
            last_position: Arc::new(AtomicU64::new(0)),
            game_state: Arc::new(RwLock::new(GameState::MainMenu)),
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start_monitoring(&self) {
        if self.running.swap(true, Ordering::SeqCst) {
            return;
        }
        
        let log_path = self.log_path.clone();
        let last_position = self.last_position.clone();
        let game_state = self.game_state.clone();
        let running = self.running.clone();

        thread::spawn(move || {
            if !Self::wait_for_log_file(&log_path) {
                running.store(false, Ordering::SeqCst);
                return;
            }
            
            while running.load(Ordering::SeqCst) {
                if log_path.exists() {
                    if let Err(_) = Self::process_log_file(&log_path, &last_position, &game_state) {
                        thread::sleep(Duration::from_secs(1));
                        continue;
                    }
                }
                thread::sleep(Duration::from_millis(500));
            }
        });
    }

    fn wait_for_log_file(log_path: &PathBuf) -> bool {
        for _ in 0..30 {
            if log_path.exists() {
                return true;
            }
            thread::sleep(Duration::from_secs(1));
        }
        false
    }

    fn process_log_file(
        log_path: &PathBuf,
        last_position: &Arc<AtomicU64>,
        game_state: &Arc<RwLock<GameState>>,
    ) -> Result<(), std::io::Error> {
        let mut file = File::open(log_path)?;
        let mut pos = last_position.load(Ordering::Relaxed);
        
        if let Ok(metadata) = file.metadata() {
            if metadata.len() < pos {
                pos = 0;
                last_position.store(0, Ordering::Relaxed);
            }
        }

        file.seek(SeekFrom::Start(pos))?;
        let reader = BufReader::new(file);

        for line in reader.lines().flatten() {
            pos += line.len() as u64 + 1;
            Self::process_log_line(&line, game_state);
        }

        last_position.store(pos, Ordering::Relaxed);
        Ok(())
    }

    fn process_log_line(line: &str, game_state: &Arc<RwLock<GameState>>) {
        if line.contains("Connecting to") && !line.contains("local") {
            if let Some(server_addr) = Self::extract_server_address(line) {
                if let Ok(mut state) = game_state.write() {
                    *state = GameState::Multiplayer(server_addr);
                }
            }
        } else if line.contains("logged in with entity id") && line.contains("[local:") {
            if let Some(world_name) = Self::extract_world_name(line) {
                if let Ok(mut state) = game_state.write() {
                    *state = GameState::Singleplayer(world_name);
                }
            }
        } else if line.contains("Saving chunks for level") && line.contains("ServerLevel[") {
            if let Ok(current_state) = game_state.read() {
                if matches!(*current_state, GameState::MainMenu) {
                    drop(current_state);
                    if let Some(world_name) = Self::extract_world_name(line) {
                        if let Ok(mut state) = game_state.write() {
                            *state = GameState::Singleplayer(world_name);
                        }
                    }
                }
            }
        } else if Self::is_disconnect_event(line) {
            if let Ok(mut state) = game_state.write() {
                *state = GameState::MainMenu;
            }
        }
    }

    fn is_disconnect_event(line: &str) -> bool {
        line.contains("Stopping!") 
            || line.contains("Disconnected") 
            || line.contains("lost connection")
            || line.contains("Quitting")
    }

    fn extract_server_address(line: &str) -> Option<String> {
        let start = line.find("Connecting to")? + 13;
        let rest = line[start..].trim();
        let comma = rest.find(',')?;
        let addr = rest[..comma].trim();
        
        if !addr.is_empty() && !addr.contains("local") {
            Some(addr.to_string())
        } else {
            None
        }
    }

    fn extract_world_name(line: &str) -> Option<String> {
        let start = line.find("ServerLevel[")? + 12;
        let rest = &line[start..];
        let end = rest.find(']')?;
        let world_name = rest[..end].trim();
        
        if !world_name.is_empty() {
            Some(world_name.to_string())
        } else {
            None
        }
    }

    pub fn get_current_state(&self) -> GameState {
        self.game_state.read().unwrap().clone()
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Ok(mut state) = self.game_state.write() {
            *state = GameState::MainMenu;
        }
    }
}
