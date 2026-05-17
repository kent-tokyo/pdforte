mod commands;

use commands::convert::{check_libreoffice, convert_via_libreoffice, ocr_page, ocr_page_to_pdf, protect_pdf, unlock_pdf, read_file_bytes, save_bytes};
use commands::pdf_ops::{
    merge_pdfs, split_pdf, rotate_pages_pdf, reorder_pages_pdf, delete_pages_pdf,
    extract_pages_pdf, insert_blank_page_pdf,
    create_pdf_from_images, create_pdf_from_text_content,
    get_pdf_metadata, set_pdf_metadata,
    sanitize_pdf, get_signature_fields,
    bake_annotations, add_watermark_pdf, add_header_footer_pdf,
    compress_pdf,
};
use commands::dialog::{open_file_dialog, open_files_dialog, open_folder_dialog, save_file_dialog, open_image_dialog};
use commands::explorer::{convert_to_pdf, list_directory};
use commands::file::{delete_sidecar, open_pdf, save_pdf, save_sidecar};
use commands::font::{list_fonts, load_font};
use commands::settings::{get_settings_path, read_settings, write_settings};
use commands::translate::translate_text;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;

    // ファイル
    let file_menu = Submenu::with_items(
        app,
        "ファイル",
        true,
        &[
            &MenuItem::with_id(app, "open",          "開く...",                   true, Some("CmdOrCtrl+O"))?,
            &MenuItem::with_id(app, "open_recent",   "最近使ったファイルを開く",   true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "merge",         "ファイルを結合...",          true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "save",          "保存",                       true, Some("CmdOrCtrl+S"))?,
            &MenuItem::with_id(app, "save_as",       "別名で保存...",              true, Some("CmdOrCtrl+Shift+S"))?,
            &MenuItem::with_id(app, "convert",       "Word/Excel/PowerPointに変換...", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "compress",      "ファイルを圧縮...",          true, None::<&str>)?,
            &MenuItem::with_id(app, "protect",       "パスワードを保護...",        true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "print",         "プリント...",               true, Some("CmdOrCtrl+P"))?,
            &MenuItem::with_id(app, "find",          "簡易検索",                  true, Some("CmdOrCtrl+F"))?,
            &MenuItem::with_id(app, "find_advanced", "高度な検索",                true, Some("CmdOrCtrl+Shift+F"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "properties",    "文書のプロパティ...",        true, Some("CmdOrCtrl+D"))?,
            &MenuItem::with_id(app, "close_file",    "ウィンドウを閉じる",         true, Some("CmdOrCtrl+W"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("終了"))?,
        ],
    )?;

    // 編集
    let undo_sub = Submenu::with_items(
        app,
        "元に戻す、やり直しなど",
        true,
        &[
            &MenuItem::with_id(app, "undo", "元に戻す", true, Some("CmdOrCtrl+Z"))?,
            &MenuItem::with_id(app, "redo", "やり直し", true, Some("CmdOrCtrl+Shift+Z"))?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "編集",
        true,
        &[
            &PredefinedMenuItem::cut(app, Some("カット"))?,
            &PredefinedMenuItem::copy(app, Some("コピー"))?,
            &PredefinedMenuItem::paste(app, Some("ペースト"))?,
            &undo_sub,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "edit_pdf",      "PDFを編集",       true, None::<&str>)?,
            &MenuItem::with_id(app, "add_textbox",   "テキストを追加",  true, None::<&str>)?,
            &MenuItem::with_id(app, "add_image",     "画像を追加",      true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "delete_pages",  "ページを削除",    true, None::<&str>)?,
            &MenuItem::with_id(app, "rotate_pages",  "ページを回転",    true, None::<&str>)?,
            &MenuItem::with_id(app, "organize_pages","ページを整理",    true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "ocr",           "スキャンと OCR...",true, None::<&str>)?,
            &MenuItem::with_id(app, "protect2",      "保護...",         true, None::<&str>)?,
        ],
    )?;

    // 表示
    let zoom_sub = Submenu::with_items(
        app,
        "ズーム",
        true,
        &[
            &MenuItem::with_id(app, "zoom_in",    "拡大",           true, Some("CmdOrCtrl+="))?,
            &MenuItem::with_id(app, "zoom_out",   "縮小",           true, Some("CmdOrCtrl+-"))?,
            &MenuItem::with_id(app, "zoom_reset", "実際のサイズ",   true, Some("CmdOrCtrl+0"))?,
            &MenuItem::with_id(app, "zoom_fit",   "ページに合わせる", true, None::<&str>)?,
        ],
    )?;

    let page_nav_sub = Submenu::with_items(
        app,
        "ページナビゲーション",
        true,
        &[
            &MenuItem::with_id(app, "first_page", "最初のページ", true, None::<&str>)?,
            &MenuItem::with_id(app, "prev_page",  "前のページ",   true, None::<&str>)?,
            &MenuItem::with_id(app, "next_page",  "次のページ",   true, None::<&str>)?,
            &MenuItem::with_id(app, "last_page",  "最後のページ", true, None::<&str>)?,
        ],
    )?;

    let theme_sub = Submenu::with_items(
        app,
        "表示テーマ",
        true,
        &[
            &MenuItem::with_id(app, "theme_dark",   "ダーク",   true, None::<&str>)?,
            &MenuItem::with_id(app, "theme_light",  "ライト",   true, None::<&str>)?,
            &MenuItem::with_id(app, "theme_system", "システム", true, None::<&str>)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "表示",
        true,
        &[
            &page_nav_sub,
            &zoom_sub,
            &PredefinedMenuItem::separator(app)?,
            &theme_sub,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "reading_mode", "閲覧モード", true, Some("Ctrl+Shift+H"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, Some("フルスクリーンモード"))?,
        ],
    )?;

    // 署名
    let sign_menu = Submenu::with_items(
        app,
        "署名",
        true,
        &[
            &MenuItem::with_id(app, "add_signature", "署名を追加...", true, None::<&str>)?,
            &MenuItem::with_id(app, "add_stamp",     "スタンプを追加...", true, None::<&str>)?,
        ],
    )?;

    // ウィンドウ
    let window_menu = Submenu::with_items(
        app,
        "ウィンドウ",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("最小化"))?,
            &PredefinedMenuItem::maximize(app, Some("最大化"))?,
        ],
    )?;

    // ヘルプ
    let help_menu = Submenu::with_items(
        app,
        "ヘルプ",
        true,
        &[&MenuItem::with_id(app, "about", "pdforte について", true, None::<&str>)?],
    )?;

    menu.append(&file_menu)?;
    menu.append(&edit_menu)?;
    menu.append(&view_menu)?;
    menu.append(&sign_menu)?;
    menu.append(&window_menu)?;
    menu.append(&help_menu)?;

    Ok(menu)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            let _ = match id {
                "open"           => app.emit("menu:open", ()),
                "open_recent"    => app.emit("menu:open-recent", ()),
                "merge"          => app.emit("menu:merge", ()),
                "close_file"     => app.emit("menu:close", ()),
                "save"           => app.emit("menu:save", ()),
                "save_as"        => app.emit("menu:save-as", ()),
                "convert"        => app.emit("menu:convert", ()),
                "compress"       => app.emit("menu:compress", ()),
                "protect" | "protect2" => app.emit("menu:protect", ()),
                "print"          => app.emit("menu:print", ()),
                "find"           => app.emit("menu:find", ()),
                "find_advanced"  => app.emit("menu:find-advanced", ()),
                "properties"     => app.emit("menu:properties", ()),
                "undo"           => app.emit("menu:undo", ()),
                "redo"           => app.emit("menu:redo", ()),
                "edit_pdf"       => app.emit("menu:edit-pdf", ()),
                "add_textbox"    => app.emit("menu:add-textbox", ()),
                "add_image"      => app.emit("menu:add-image", ()),
                "delete_pages"   => app.emit("menu:delete-pages", ()),
                "rotate_pages"   => app.emit("menu:rotate-pages", ()),
                "organize_pages" => app.emit("menu:organize-pages", ()),
                "ocr"            => app.emit("menu:ocr", ()),
                "zoom_in"        => app.emit("menu:zoom-in", ()),
                "zoom_out"       => app.emit("menu:zoom-out", ()),
                "zoom_reset"     => app.emit("menu:zoom-reset", ()),
                "zoom_fit"       => app.emit("menu:zoom-fit", ()),
                "first_page"     => app.emit("menu:first-page", ()),
                "prev_page"      => app.emit("menu:prev-page", ()),
                "next_page"      => app.emit("menu:next-page", ()),
                "last_page"      => app.emit("menu:last-page", ()),
                "theme_dark"     => app.emit("menu:theme-dark", ()),
                "theme_light"    => app.emit("menu:theme-light", ()),
                "theme_system"   => app.emit("menu:theme-system", ()),
                "reading_mode"   => app.emit("menu:reading-mode", ()),
                "add_signature"  => app.emit("menu:signature", ()),
                "add_stamp"      => app.emit("menu:stamp", ()),
                "about"          => app.emit("menu:about", ()),
                _ => Ok(()),
            };
        })
        .invoke_handler(tauri::generate_handler![
            open_pdf,
            save_pdf,
            save_sidecar,
            delete_sidecar,
            open_file_dialog,
            open_files_dialog,
            save_file_dialog,
            open_folder_dialog,
            open_image_dialog,
            load_font,
            list_fonts,
            read_settings,
            write_settings,
            get_settings_path,
            list_directory,
            convert_to_pdf,
            convert_via_libreoffice,
            ocr_page,
            ocr_page_to_pdf,
            protect_pdf,
            unlock_pdf,
            save_bytes,
            read_file_bytes,
            translate_text,
            check_libreoffice,
            merge_pdfs,
            split_pdf,
            rotate_pages_pdf,
            reorder_pages_pdf,
            delete_pages_pdf,
            create_pdf_from_images,
            create_pdf_from_text_content,
            get_pdf_metadata,
            set_pdf_metadata,
            sanitize_pdf,
            get_signature_fields,
            extract_pages_pdf,
            insert_blank_page_pdf,
            bake_annotations,
            add_watermark_pdf,
            add_header_footer_pdf,
            compress_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
