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
