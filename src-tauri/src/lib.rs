use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager};

// ── SSH process singleton ─────────────────────────────────────────────────────

static SSH_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

// ── Config store (JSON file in app config dir) ────────────────────────────────

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

fn read_config(app: &AppHandle) -> HashMap<String, Value> {
    config_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_config(app: &AppHandle, map: &HashMap<String, Value>) -> Result<(), String> {
    let path = config_path(app)?;
    let data = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn store_get(app: AppHandle, key: String) -> Value {
    read_config(&app).get(&key).cloned().unwrap_or(Value::Null)
}

#[tauri::command]
fn store_set(app: AppHandle, key: String, value: Value) -> Result<(), String> {
    let mut map = read_config(&app);
    map.insert(key, value);
    write_config(&app, &map)
}

#[tauri::command]
fn store_delete(app: AppHandle, key: String) -> Result<(), String> {
    let mut map = read_config(&app);
    map.remove(&key);
    write_config(&app, &map)
}

// ── File read ─────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct FileReadResult {
    name: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    base64: String,
    size: u64,
}

fn ext_to_mime(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "json" => "application/json",
        "csv" => "text/csv",
        "js" => "text/javascript",
        "ts" => "text/typescript",
        "py" => "text/x-python",
        "rs" => "text/x-rust",
        "go" => "text/x-go",
        "java" => "text/x-java",
        "c" | "h" => "text/x-c",
        "cpp" => "text/x-c++",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
fn file_read(path: String) -> Result<FileReadResult, String> {
    let p = std::path::Path::new(&path);
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    let size = bytes.len() as u64;
    let base64 = STANDARD.encode(&bytes);
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("file").to_string();
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    Ok(FileReadResult { name, mime_type: ext_to_mime(&ext).to_string(), base64, size })
}

// ── SSH tunnel ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SSHConfig {
    host: String,
    port: u16,
    username: String,
    #[serde(rename = "privateKeyPath")]
    private_key_path: String,
    #[serde(rename = "remotePort")]
    remote_port: u16,
}

#[derive(Serialize)]
pub struct SSHConnectResult {
    success: bool,
    #[serde(rename = "localPort")]
    local_port: Option<u16>,
    error: Option<String>,
}

fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .map(|l| l.local_addr().unwrap().port())
        .unwrap_or(19000)
}

fn port_open(port: u16) -> bool {
    std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

#[tauri::command]
fn ssh_connect(config: SSHConfig) -> SSHConnectResult {
    if let Ok(mut lock) = SSH_PROCESS.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }
    let local_port = free_port();
    let home = std::env::var("HOME").unwrap_or_default();
    let key_path = config.private_key_path.replace('~', &home);

    let child = match Command::new("ssh")
        .args([
            "-N",
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "ExitOnForwardFailure=yes",
            "-o", "ServerAliveInterval=30",
            "-o", "BatchMode=yes",
            "-L", &format!("{}:127.0.0.1:{}", local_port, config.remote_port),
            "-p", &config.port.to_string(),
            "-i", &key_path,
            &format!("{}@{}", config.username, config.host),
        ])
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return SSHConnectResult { success: false, local_port: None, error: Some(e.to_string()) },
    };

    if let Ok(mut lock) = SSH_PROCESS.lock() {
        *lock = Some(child);
    }

    // Poll until local port accepts connections (max 15s, same as Electron version)
    let deadline = std::time::Instant::now() + Duration::from_secs(15);
    std::thread::sleep(Duration::from_millis(300));
    loop {
        if port_open(local_port) {
            return SSHConnectResult { success: true, local_port: Some(local_port), error: None };
        }
        if let Ok(mut lock) = SSH_PROCESS.lock() {
            if let Some(c) = lock.as_mut() {
                if let Ok(Some(status)) = c.try_wait() {
                    *lock = None;
                    return SSHConnectResult { success: false, local_port: None, error: Some(format!("SSH exited: {}", status)) };
                }
            }
        }
        if std::time::Instant::now() > deadline {
            return SSHConnectResult { success: false, local_port: None, error: Some("SSH tunnel timed out".into()) };
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

#[tauri::command]
fn ssh_disconnect() {
    if let Ok(mut lock) = SSH_PROCESS.lock() {
        if let Some(mut child) = lock.take() {
            let _ = child.kill();
        }
    }
}

// ── App entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            store_get,
            store_set,
            store_delete,
            file_read,
            ssh_connect,
            ssh_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClawChat");
}
