use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join("settings.json"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_settings(app: AppHandle) -> Result<String, String> {
    let path = settings_path(&app)?;
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
pub async fn write_settings(app: AppHandle, json: String) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_settings_path(app: AppHandle) -> Result<String, String> {
    settings_path(&app).map(|p| p.to_string_lossy().to_string())
}
