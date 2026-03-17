use std::io::{Read, Write};
use serde::{Serialize, Deserialize};

#[cfg(windows)]
use std::fs::OpenOptions;
#[cfg(unix)]
use std::os::unix::net::UnixStream;

const DISCORD_CLIENT_ID: &str = "1120717693943820308";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activity {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamps: Option<Timestamps>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<Assets>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub buttons: Option<Vec<Button>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Button {
    pub label: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timestamps {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assets {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub large_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub large_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub small_image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub small_text: Option<String>,
}

#[derive(Serialize)]
struct HandshakePayload {
    v: u8,
    client_id: String,
}

#[derive(Serialize)]
struct SetActivityPayload {
    cmd: String,
    args: ActivityArgs,
    nonce: String,
}

#[derive(Serialize)]
struct ActivityArgs {
    pid: u32,
    activity: Option<Activity>,
}

enum OpCode {
    Handshake = 0,
    Frame = 1,
}

#[derive(Debug)]
pub struct DiscordRpc {
    #[cfg(windows)]
    pipe: Option<std::fs::File>,
    #[cfg(unix)]
    socket: Option<UnixStream>,
    connected: bool,
}

impl DiscordRpc {
    pub fn new() -> Self {
        Self {
            #[cfg(windows)]
            pipe: None,
            #[cfg(unix)]
            socket: None,
            connected: false,
        }
    }

    pub fn connect(&mut self) -> Result<(), String> {
        #[cfg(windows)]
        {
            for i in 0..10 {
                let pipe_name = format!(r"\\.\pipe\discord-ipc-{}", i);
                if let Ok(pipe) = OpenOptions::new().read(true).write(true).open(&pipe_name) {
                    self.pipe = Some(pipe);
                    self.connected = true;
                    return self.handshake();
                }
            }
            Err("Failed to connect to Discord IPC".to_string())
        }

        #[cfg(unix)]
        {
            let runtime_dir = std::env::var("XDG_RUNTIME_DIR")
                .or_else(|_| std::env::var("TMPDIR"))
                .or_else(|_| std::env::var("TMP"))
                .or_else(|_| std::env::var("TEMP"))
                .unwrap_or_else(|_| "/tmp".to_string());

            for i in 0..10 {
                let socket_path = format!("{}/discord-ipc-{}", runtime_dir, i);
                if let Ok(socket) = UnixStream::connect(&socket_path) {
                    self.socket = Some(socket);
                    self.connected = true;
                    return self.handshake();
                }
            }
            Err("Failed to connect to Discord IPC".to_string())
        }
    }

    fn handshake(&mut self) -> Result<(), String> {
        let payload = HandshakePayload {
            v: 1,
            client_id: DISCORD_CLIENT_ID.to_string(),
        };

        let json = serde_json::to_string(&payload)
            .map_err(|e| format!("Failed to serialize handshake: {}", e))?;

        self.write_frame(OpCode::Handshake, json.as_bytes())?;
        let _response = self.read_frame()?;
        Ok(())
    }

    pub fn set_activity(&mut self, activity: Option<Activity>) -> Result<(), String> {
        if !self.connected {
            return Err("Not connected to Discord".to_string());
        }

        let payload = SetActivityPayload {
            cmd: "SET_ACTIVITY".to_string(),
            args: ActivityArgs {
                pid: std::process::id(),
                activity,
            },
            nonce: uuid::Uuid::new_v4().to_string(),
        };

        let json = serde_json::to_string(&payload)
            .map_err(|e| format!("Failed to serialize activity: {}", e))?;

        match self.write_frame(OpCode::Frame, json.as_bytes()) {
            Ok(_) => match self.read_frame() {
                Ok(_) => Ok(()),
                Err(e) => {
                    self.connected = false;
                    Err(e)
                }
            },
            Err(e) => {
                self.connected = false;
                Err(e)
            }
        }
    }

    pub fn clear_activity(&mut self) -> Result<(), String> {
        if !self.connected {
            return Ok(());
        }
        
        match self.set_activity(None) {
            Ok(_) | Err(_) => {
                self.disconnect();
                Ok(())
            }
        }
    }
    
    pub fn is_connected(&self) -> bool {
        self.connected
    }

    pub fn disconnect(&mut self) {
        self.connected = false;
        #[cfg(windows)]
        {
            self.pipe = None;
        }
        #[cfg(unix)]
        {
            self.socket = None;
        }
    }

    fn write_frame(&mut self, opcode: OpCode, data: &[u8]) -> Result<(), String> {
        let op = opcode as u32;
        let len = data.len() as u32;

        let mut buffer = Vec::with_capacity(8 + data.len());
        buffer.extend_from_slice(&op.to_le_bytes());
        buffer.extend_from_slice(&len.to_le_bytes());
        buffer.extend_from_slice(data);

        #[cfg(windows)]
        {
            if let Some(pipe) = &mut self.pipe {
                pipe.write_all(&buffer)
                    .map_err(|e| format!("Failed to write to pipe: {}", e))?;
                pipe.flush()
                    .map_err(|e| format!("Failed to flush pipe: {}", e))?;
            }
        }

        #[cfg(unix)]
        {
            if let Some(socket) = &mut self.socket {
                socket.write_all(&buffer)
                    .map_err(|e| format!("Failed to write to socket: {}", e))?;
                socket.flush()
                    .map_err(|e| format!("Failed to flush socket: {}", e))?;
            }
        }

        Ok(())
    }

    fn read_frame(&mut self) -> Result<Vec<u8>, String> {
        let mut header = [0u8; 8];

        #[cfg(windows)]
        {
            if let Some(pipe) = &mut self.pipe {
                pipe.read_exact(&mut header)
                    .map_err(|e| format!("Failed to read header: {}", e))?;
            }
        }

        #[cfg(unix)]
        {
            if let Some(socket) = &mut self.socket {
                socket.read_exact(&mut header)
                    .map_err(|e| format!("Failed to read header: {}", e))?;
            }
        }

        let length = u32::from_le_bytes([header[4], header[5], header[6], header[7]]);
        let mut data = vec![0u8; length as usize];

        #[cfg(windows)]
        {
            if let Some(pipe) = &mut self.pipe {
                pipe.read_exact(&mut data)
                    .map_err(|e| format!("Failed to read data: {}", e))?;
            }
        }

        #[cfg(unix)]
        {
            if let Some(socket) = &mut self.socket {
                socket.read_exact(&mut data)
                    .map_err(|e| format!("Failed to read data: {}", e))?;
            }
        }

        Ok(data)
    }
}

impl Drop for DiscordRpc {
    fn drop(&mut self) {
        if self.connected {
            let _ = self.clear_activity();
        }
    }
}
