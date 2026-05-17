use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn open_file_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .add_filter("PDF & Documents", &["pdf", "docx", "pptx"])
        .add_filter("PDF", &["pdf"])
        .add_filter("Word", &["docx"])
        .add_filter("PowerPoint", &["pptx"])
        .blocking_pick_file();

    Ok(result.and_then(|f| f.as_path().map(|p| p.to_string_lossy().to_string())))
}

#[tauri::command]
pub async fn save_file_dialog(app: AppHandle, default_name: String) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .set_file_name(&default_name)
        .blocking_save_file();

    Ok(result.and_then(|f| f.as_path().map(|p| p.to_string_lossy().to_string())))
}

#[tauri::command]
pub async fn open_files_dialog(app: AppHandle) -> Result<Vec<String>, String> {
    let results = app
        .dialog()
        .file()
        .add_filter("PDF & Images", &["pdf", "jpg", "jpeg", "png", "docx", "xlsx", "pptx"])
        .blocking_pick_files();

    let paths = results
        .unwrap_or_default()
        .into_iter()
        .filter_map(|f| f.as_path().map(|p| p.to_string_lossy().to_string()))
        .collect();

    Ok(paths)
}

#[tauri::command]
pub async fn open_folder_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .blocking_pick_folder();

    Ok(result.and_then(|f| f.as_path().map(|p| p.to_string_lossy().to_string())))
}

#[tauri::command]
pub async fn open_image_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .add_filter("画像ファイル", &["jpg", "jpeg", "png", "gif", "bmp", "webp"])
        .blocking_pick_file();

    Ok(result.and_then(|f| f.as_path().map(|p| p.to_string_lossy().to_string())))
}
