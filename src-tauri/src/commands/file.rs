use std::path::Path;
use serde::{Deserialize, Serialize};

/// S1: reject paths containing '..' to prevent path traversal attacks
fn validate_path(path: &str) -> Result<(), String> {
    if Path::new(path).components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Invalid path: '..' is not allowed".to_string());
    }
    Ok(())
}

#[derive(Serialize)]
pub struct OpenPdfResult {
    pub bytes: Vec<u8>,
    pub sidecar: Option<String>,
    pub file_path: String,
}

#[tauri::command]
pub async fn open_pdf(path: String) -> Result<OpenPdfResult, String> {
    validate_path(&path)?;
    let pdf_path = Path::new(&path);
    let bytes = std::fs::read(pdf_path).map_err(|e| e.to_string())?;

    let sidecar_path = pdf_path.with_extension("pdfine.json");
    let sidecar = if sidecar_path.exists() {
        Some(std::fs::read_to_string(&sidecar_path).map_err(|e| e.to_string())?)
    } else {
        None
    };

    Ok(OpenPdfResult {
        bytes,
        sidecar,
        file_path: path,
    })
}

#[tauri::command]
pub async fn save_pdf(path: String, bytes: Vec<u8>) -> Result<(), String> {
    validate_path(&path)?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_sidecar(pdf_path: String, json: String) -> Result<(), String> {
    validate_path(&pdf_path)?;
    let sidecar_path = Path::new(&pdf_path).with_extension("pdfine.json");
    std::fs::write(sidecar_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_sidecar(pdf_path: String) -> Result<(), String> {
    validate_path(&pdf_path)?;
    let sidecar_path = Path::new(&pdf_path).with_extension("pdfine.json");
    if sidecar_path.exists() {
        std::fs::remove_file(sidecar_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
}
