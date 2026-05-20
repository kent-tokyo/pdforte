use serde::Serialize;
use std::path::Path;

/// S2: reject paths containing '..' to prevent arbitrary directory enumeration
fn validate_path(path: &str) -> Result<(), String> {
    if Path::new(path).components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Invalid path: '..' is not allowed".to_string());
    }
    Ok(())
}

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_pdf: bool,
}

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    validate_path(&path)?;
    let dir = Path::new(&path);
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;

    let mut result: Vec<FileEntry> = entries
        .filter_map(|e| e.ok())
        .map(|e| {
            let path_buf = e.path();
            let is_dir = path_buf.is_dir();
            let name = path_buf
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let ext = path_buf
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();
            let is_pdf = ext == "pdf";
            FileEntry {
                name,
                path: path_buf.to_string_lossy().to_string(),
                is_dir,
                is_pdf,
            }
        })
        .filter(|e| !e.name.starts_with('.'))
        .collect();

    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(result)
}

#[tauri::command]
pub async fn convert_to_pdf(input_path: String, output_path: String) -> Result<(), String> {
    validate_path(&input_path)?;
    validate_path(&output_path)?;
    let libreoffice = super::libreoffice_bin();

    let output_dir = Path::new(&output_path)
        .parent()
        .ok_or("Invalid output path")?
        .to_string_lossy()
        .to_string();

    let status = std::process::Command::new(libreoffice)
        .args(["--headless", "--convert-to", "pdf", "--outdir", &output_dir, &input_path])
        .status()
        .map_err(|e| format!("LibreOffice not found or failed: {}. Please install LibreOffice.", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("LibreOffice conversion failed".to_string())
    }
}
