use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};

/// Message types from Python sidecar
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum SidecarMessage {
    #[serde(rename = "progress")]
    Progress { current: u32, total: u32 },
    #[serde(rename = "result")]
    Result { data: serde_json::Value },
    #[serde(rename = "error")]
    Error { code: String, message: String },
}

/// Request to send to Python sidecar
#[derive(Debug, Clone, Serialize)]
pub struct SidecarRequest {
    pub action: String,
    pub params: serde_json::Value,
}

/// Python sidecar process manager
pub struct PythonSidecar {
    process: Option<Child>,
}

impl PythonSidecar {
    pub fn new() -> Self {
        Self { process: None }
    }

    /// Start the Python sidecar process
    pub fn start(&mut self, python_path: &str) -> Result<(), String> {
        let process = Command::new("python")
            .args([python_path])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start sidecar: {}", e))?;

        self.process = Some(process);
        Ok(())
    }

    /// Send a request to the sidecar and get response
    pub fn send_request(&mut self, request: &SidecarRequest) -> Result<SidecarMessage, String> {
        let process = self
            .process
            .as_mut()
            .ok_or("Sidecar not started")?;

        // Send request
        let stdin = process.stdin.as_mut().ok_or("Failed to get stdin")?;
        let request_json = serde_json::to_string(request).map_err(|e| e.to_string())?;
        writeln!(stdin, "{}", request_json).map_err(|e| e.to_string())?;

        // Read response
        let stdout = process.stdout.as_mut().ok_or("Failed to get stdout")?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;

        // Parse response
        let message: SidecarMessage =
            serde_json::from_str(&line).map_err(|e| format!("Failed to parse response: {}", e))?;

        Ok(message)
    }

    /// Stop the sidecar process
    pub fn stop(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
        }
    }
}

impl Drop for PythonSidecar {
    fn drop(&mut self) {
        self.stop();
    }
}
