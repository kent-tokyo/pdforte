use std::path::{Path, PathBuf};
use std::process::Command;
use serde::Serialize;

fn temp_path(prefix: &str, ext: &str) -> PathBuf {
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let pid = std::process::id();
    std::env::temp_dir().join(format!("pdforte_{prefix}_{pid}_{nonce}.{ext}"))
}

/// Write data to a new file with 0o600 permissions on Unix (exclusive create).
fn write_secure(path: &std::path::Path, data: &[u8]) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        let mut f = std::fs::OpenOptions::new()
            .write(true).create_new(true).mode(0o600)
            .open(path)
            .map_err(|e| e.to_string())?;
        f.write_all(data).map_err(|e| e.to_string())
    }
    #[cfg(not(unix))]
    std::fs::write(path, data).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct LibreOfficeStatus {
    pub found: bool,
    pub path: String,
    pub version: String,
    pub install_guide: String,
}

#[tauri::command]
pub async fn check_libreoffice() -> LibreOfficeStatus {
    let bin = super::libreoffice_bin();

    let version_result = Command::new(bin).arg("--version").output();
    if let Ok(out) = version_result {
        if out.status.success() {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            return LibreOfficeStatus {
                found: true,
                path: bin.to_string(),
                version,
                install_guide: String::new(),
            };
        }
    }

    let path_result = Command::new("libreoffice").arg("--version").output();
    if let Ok(out) = path_result {
        if out.status.success() {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            return LibreOfficeStatus {
                found: true,
                path: "libreoffice".to_string(),
                version,
                install_guide: String::new(),
            };
        }
    }

    let guide = if cfg!(target_os = "macos") {
        "https://www.libreoffice.org/download/download/ からダウンロードしてインストールしてください。\nまたは: brew install --cask libreoffice"
    } else if cfg!(target_os = "windows") {
        "https://www.libreoffice.org/download/download/ からダウンロードしてインストールしてください。"
    } else {
        "sudo apt install libreoffice  または  sudo dnf install libreoffice"
    };

    LibreOfficeStatus {
        found: false,
        path: bin.to_string(),
        version: String::new(),
        install_guide: guide.to_string(),
    }
}

#[tauri::command]
pub async fn convert_via_libreoffice(
    input_path: String,
    format: String,
    output_dir: String,
) -> Result<String, String> {
    let lo = super::libreoffice_bin().to_string();
    let fmt = format.clone();
    let inp = input_path.clone();
    let out = output_dir.clone();

    let status = tokio::task::spawn_blocking(move || {
        Command::new(&lo)
            .args(["--headless", "--convert-to", &fmt, "--outdir", &out, &inp])
            .status()
            .map_err(|e| format!("LibreOffice が見つかりません。インストールしてください。({})", e))
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))??;

    if !status.success() {
        return Err(format!("LibreOffice 変換に失敗しました (format={})", format));
    }

    let stem = Path::new(&input_path)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let ext = if format.contains(':') { format.split(':').next().unwrap_or(&format) } else { &format };
    let sep = if output_dir.contains('\\') { '\\' } else { '/' };
    Ok(format!("{}{}{}.{}", output_dir, sep, stem, ext))
}

#[tauri::command]
pub async fn ocr_page(image_bytes: Vec<u8>, lang: String) -> Result<String, String> {
    let tmp_img = temp_path("ocr_in", "png");
    let tmp_out_base = temp_path("ocr_out", "txt").with_extension("");
    let tmp_txt = tmp_out_base.with_extension("txt");

    std::fs::write(&tmp_img, &image_bytes).map_err(|e| e.to_string())?;

    let lang_arg = if lang.is_empty() { "jpn+eng".to_string() } else { lang };
    let img_str = tmp_img.to_str().unwrap_or("").to_string();
    let base_str = tmp_out_base.to_str().unwrap_or("").to_string();
    let lang_clone = lang_arg.clone();

    let run_result = tokio::task::spawn_blocking(move || {
        Command::new("tesseract")
            .args([&img_str, &base_str, "-l", &lang_clone])
            .status()
            .map_err(|e| format!("Tesseract が見つかりません: {}", e))
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))?;

    let _ = std::fs::remove_file(&tmp_img);
    let status = run_result?;

    if !status.success() {
        let _ = std::fs::remove_file(&tmp_txt);
        return Err("Tesseract OCR に失敗しました".to_string());
    }

    let text = std::fs::read_to_string(&tmp_txt).unwrap_or_default();
    let _ = std::fs::remove_file(&tmp_txt);
    Ok(text)
}

#[tauri::command]
pub async fn ocr_page_to_pdf(image_bytes: Vec<u8>, lang: String) -> Result<Vec<u8>, String> {
    let tmp_img = temp_path("ocr_in", "png");
    let tmp_out_base = temp_path("ocr_page", "pdf").with_extension("");
    let tmp_pdf = tmp_out_base.with_extension("pdf");

    std::fs::write(&tmp_img, &image_bytes).map_err(|e| e.to_string())?;

    let lang_arg = if lang.is_empty() { "jpn+eng".to_string() } else { lang };
    let img_str = tmp_img.to_str().unwrap_or("").to_string();
    let base_str = tmp_out_base.to_str().unwrap_or("").to_string();
    let lang_clone = lang_arg.clone();

    let run_result = tokio::task::spawn_blocking(move || {
        Command::new("tesseract")
            .args([&img_str, &base_str, "-l", &lang_clone, "pdf"])
            .status()
            .map_err(|e| format!("Tesseract が見つかりません: {}", e))
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))?;

    let _ = std::fs::remove_file(&tmp_img);
    let status = run_result?;

    if !status.success() {
        let _ = std::fs::remove_file(&tmp_pdf);
        return Err("Tesseract PDF 生成に失敗しました".to_string());
    }

    let pdf_bytes = std::fs::read(&tmp_pdf).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&tmp_pdf);
    Ok(pdf_bytes)
}

#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn protect_pdf(
    input_path: String,
    output_path: String,
    user_password: String,
    owner_password: String,
    allow_printing: bool,
    allow_copying: bool,
) -> Result<(), String> {
    let argfile_path = temp_path("qpdf_args", "txt");

    let mut lines = vec![
        input_path,
        "--encrypt".to_string(),
        user_password,
        owner_password,
        "256".to_string(),
    ];
    if !allow_printing { lines.push("--print=none".to_string()); }
    if !allow_copying {
        lines.push("--modify=none".to_string());
        lines.push("--extract=n".to_string());
    }
    lines.push("--".to_string());
    lines.push(output_path);

    write_secure(&argfile_path, lines.join("\n").as_bytes())?;

    let argfile_str = argfile_path.to_str().unwrap_or("").to_string();
    let run_result = tokio::task::spawn_blocking(move || {
        Command::new("qpdf")
            .arg(format!("@{}", argfile_str))
            .status()
            .map_err(|e| format!("qpdf が見つかりません。`brew install qpdf` でインストールしてください。({})", e))
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))?;

    let _ = std::fs::remove_file(&argfile_path);

    if run_result?.success() { Ok(()) } else { Err("qpdf による暗号化に失敗しました".to_string()) }
}

#[tauri::command]
pub async fn unlock_pdf(bytes: Vec<u8>, password: String) -> Result<Vec<u8>, String> {
    let in_path = temp_path("unlock_in", "pdf");
    let out_path = temp_path("unlock_out", "pdf");

    write_secure(&in_path, &bytes)?;

    let in_str = in_path.to_str().unwrap_or("").to_string();
    let out_str = out_path.to_str().unwrap_or("").to_string();
    let in_path_clone = in_path.clone();

    let unlock_result = tokio::task::spawn_blocking(move || -> Result<(), String> {
        use std::io::Write;
        use std::process::Stdio;

        let mut child = Command::new("qpdf")
            .args(["--password-file=-", "--decrypt", &in_str, &out_str])
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| format!("qpdf が見つかりません。`brew install qpdf` でインストールしてください。({})", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(password.as_bytes());
        }
        let status = child.wait().map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&in_path_clone);

        if status.success() { Ok(()) } else { Err("パスワードが正しくないか、復号化に失敗しました".to_string()) }
    })
    .await
    .map_err(|e| format!("spawn_blocking error: {}", e))?;

    if let Err(e) = unlock_result {
        let _ = std::fs::remove_file(&out_path);
        return Err(e);
    }

    let result = std::fs::read(&out_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&out_path);
    Ok(result)
}
