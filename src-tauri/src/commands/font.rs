use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

#[tauri::command]
pub async fn load_font(app: AppHandle, font_name: String) -> Result<Vec<u8>, String> {
    // Reject traversal attempts before joining the path.
    if font_name.contains('/') || font_name.contains('\\') || font_name.contains("..") {
        return Err("Invalid font name".to_string());
    }

    let fonts_dir = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("fonts");

    let resource_path = fonts_dir.join(&font_name);

    // Canonicalize both paths and confirm the font stays inside fonts_dir.
    let canonical_font = resource_path.canonicalize()
        .map_err(|_| "Invalid font name".to_string())?;
    let canonical_fonts_dir = fonts_dir.canonicalize()
        .map_err(|e| e.to_string())?;
    if !canonical_font.starts_with(&canonical_fonts_dir) {
        return Err("Invalid font name".to_string());
    }

    std::fs::read(&canonical_font)
        .map_err(|e| format!("Failed to load font {}: {}", font_name, e))
}

#[tauri::command]
pub async fn list_fonts(app: AppHandle) -> Result<Vec<String>, String> {
    let fonts_dir: PathBuf = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("fonts");

    let entries = std::fs::read_dir(&fonts_dir).map_err(|e| e.to_string())?;
    let fonts: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|name| name.ends_with(".otf") || name.ends_with(".ttf"))
        .collect();

    Ok(fonts)
}
