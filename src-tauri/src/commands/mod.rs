pub mod convert;
pub mod dialog;
pub mod explorer;
pub mod file;
pub mod font;
pub mod pdf_annotations;
pub mod pdf_compress;
pub mod pdf_metadata;
pub mod pdf_ops;
pub mod settings;
pub mod translate;

pub(crate) fn libreoffice_bin() -> &'static str {
    if cfg!(target_os = "macos") {
        "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    } else if cfg!(target_os = "windows") {
        "soffice.exe"
    } else {
        "libreoffice"
    }
}

/// Reject empty paths, paths with `..` components, and paths outside the user's
/// home directory or the system temp directory.
///
/// For paths that may not yet exist (e.g. save destinations), we canonicalize
/// the deepest existing ancestor and reconstruct the full path from there.
pub(crate) fn validate_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("Path must not be empty".to_string());
    }
    // Fast pre-check: reject literal `..` components
    if std::path::Path::new(path)
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err("Invalid path: '..' not allowed".to_string());
    }

    // Resolve to an absolute, symlink-free path.  We walk up the path until
    // we find an ancestor that already exists, canonicalize that, then append
    // the remaining tail.  This handles write-targets (files not yet created).
    let p = std::path::Path::new(path);
    let canonical = if p.exists() {
        std::fs::canonicalize(p).map_err(|e| format!("Cannot resolve path: {e}"))?
    } else {
        // Find the deepest existing ancestor
        let mut existing = p;
        let mut tail = std::path::PathBuf::new();
        loop {
            match existing.parent() {
                Some(parent) => {
                    tail = existing
                        .file_name()
                        .map(|n| std::path::Path::new(n).join(&tail))
                        .unwrap_or(tail);
                    existing = parent;
                    if existing.exists() || existing.as_os_str().is_empty() {
                        break;
                    }
                }
                None => break,
            }
        }
        if existing.as_os_str().is_empty() {
            return Err(format!("Cannot resolve path: no existing ancestor found for '{path}'"));
        }
        let canon_ancestor = std::fs::canonicalize(existing)
            .map_err(|e| format!("Cannot resolve path: {e}"))?;
        canon_ancestor.join(&tail)
    };

    let home = dirs_next_or_home();
    let temp = std::env::temp_dir();
    if !canonical.starts_with(&home) && !canonical.starts_with(&temp) {
        return Err("Access denied: path is outside allowed directories".to_string());
    }
    Ok(())
}

fn dirs_next_or_home() -> std::path::PathBuf {
    std::env::var("HOME")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir())
}

/// Load a `harumi::Document` from bytes, apply `f`, and serialize back to bytes.
pub(crate) fn with_doc<F>(bytes: &[u8], f: F) -> Result<Vec<u8>, String>
where
    F: FnOnce(&mut harumi::Document) -> Result<(), String>,
{
    let mut doc = harumi::Document::from_bytes(bytes).map_err(|e| e.to_string())?;
    f(&mut doc)?;
    doc.save_to_bytes().map_err(|e| e.to_string())
}
