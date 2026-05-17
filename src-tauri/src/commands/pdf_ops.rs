use harumi::{Document, PdfMetadata};

// ── Shared data types ─────────────────────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Default, Debug)]
pub struct MetadataPayload {
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub creator: Option<String>,
}

#[derive(serde::Serialize, Debug)]
pub struct SignatureFieldInfo {
    pub name: String,
    pub reason: Option<String>,
    pub date: Option<String>,
}

// ── Page operations ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn merge_pdfs(pdfs: Vec<Vec<u8>>) -> Result<Vec<u8>, String> {
    if pdfs.is_empty() {
        return Err("No PDFs provided".into());
    }
    let mut base = Document::from_bytes(&pdfs[0]).map_err(|e| e.to_string())?;
    for rest in &pdfs[1..] {
        let other = Document::from_bytes(rest).map_err(|e| e.to_string())?;
        base.merge_from(other).map_err(|e| e.to_string())?;
    }
    base.save_to_bytes().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn split_pdf(bytes: Vec<u8>, ranges: Vec<Vec<u32>>) -> Result<Vec<Vec<u8>>, String> {
    let doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for range in &ranges {
        let mut sub = doc.extract_pages(range).map_err(|e| e.to_string())?;
        result.push(sub.save_to_bytes().map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub async fn rotate_pages_pdf(bytes: Vec<u8>, rotations: Vec<(u32, i32)>) -> Result<Vec<u8>, String> {
    let mut doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    for (page, deg) in rotations {
        doc.rotate_page(page, deg).map_err(|e| e.to_string())?;
    }
    doc.save_to_bytes().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reorder_pages_pdf(bytes: Vec<u8>, new_order: Vec<u32>) -> Result<Vec<u8>, String> {
    let mut doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    doc.reorder_pages(&new_order).map_err(|e| e.to_string())?;
    doc.save_to_bytes().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_pages_pdf(bytes: Vec<u8>, mut pages: Vec<u32>) -> Result<Vec<u8>, String> {
    let mut doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    pages.sort_unstable_by(|a, b| b.cmp(a));
    pages.dedup();
    for p in pages {
        doc.remove_page(p).map_err(|e| e.to_string())?;
    }
    doc.save_to_bytes().map_err(|e| e.to_string())
}

// ── PDF generation ────────────────────────────────────────────────────────────

fn image_dims(bytes: &[u8]) -> Result<(f32, f32), String> {
    let img = image::load_from_memory(bytes).map_err(|e| e.to_string())?;
    Ok((img.width() as f32, img.height() as f32))
}

fn fit_image_rect(img_w: f32, img_h: f32, page_w: f32, page_h: f32, fixed: bool) -> [f32; 4] {
    if fixed {
        let scale = (page_w / img_w).min(page_h / img_h);
        let dw = img_w * scale;
        let dh = img_h * scale;
        [(page_w - dw) / 2.0, (page_h - dh) / 2.0, dw, dh]
    } else {
        [0.0, 0.0, img_w, img_h]
    }
}

/// `page_width`/`page_height` > 0 → scale images to fit that fixed size.
/// Pass 0.0 / 0.0 to use each image's natural dimensions.
#[tauri::command]
pub async fn create_pdf_from_images(
    images: Vec<Vec<u8>>,
    page_width: f32,
    page_height: f32,
) -> Result<Vec<u8>, String> {
    if images.is_empty() {
        return Err("No images provided".into());
    }

    let fixed = page_width > 0.0 && page_height > 0.0;
    let (first_w, first_h) = image_dims(&images[0])?;
    let (p0_w, p0_h) = if fixed { (page_width, page_height) } else { (first_w, first_h) };

    let mut doc = Document::new((p0_w, p0_h)).map_err(|e| e.to_string())?;

    for (i, img_bytes) in images.iter().enumerate() {
        let (img_w, img_h) = if i == 0 { (first_w, first_h) } else { image_dims(img_bytes)? };
        let (pw, ph) = if fixed { (page_width, page_height) } else { (img_w, img_h) };
        let page_num = (i + 1) as u32;

        if i > 0 {
            doc.insert_blank_page(page_num - 1, (pw, ph))
                .map_err(|e| e.to_string())?;
        }

        let rect = fit_image_rect(img_w, img_h, pw, ph, fixed);
        doc.page(page_num)
            .map_err(|e| e.to_string())?
            .add_image(img_bytes, rect)
            .map_err(|e| e.to_string())?;
    }

    doc.save_to_bytes().map_err(|e| e.to_string())
}

fn char_w(c: char, font_size: f32) -> f32 {
    if (c as u32) > 0x2E7F { font_size } else { font_size * 0.55 }
}

fn wrap_text(text: &str, max_width: f32, font_size: f32) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    for raw in text.split('\n') {
        if raw.trim().is_empty() {
            lines.push(String::new());
            continue;
        }
        let words: Vec<&str> = raw.split(' ').collect();
        let mut cur = String::new();
        let mut cur_w = 0.0_f32;
        for w in words {
            let w_w: f32 = w.chars().map(|c| char_w(c, font_size)).sum();
            if cur.is_empty() {
                cur = w.to_string();
                cur_w = w_w;
            } else {
                let space_w = char_w(' ', font_size);
                if cur_w + space_w + w_w > max_width {
                    lines.push(cur.clone());
                    cur = w.to_string();
                    cur_w = w_w;
                } else {
                    cur.push(' ');
                    cur.push_str(w);
                    cur_w += space_w + w_w;
                }
            }
        }
        if !cur.is_empty() {
            lines.push(cur);
        }
    }
    lines
}

#[tauri::command]
pub async fn create_pdf_from_text_content(
    text: String,
    font_bytes: Vec<u8>,
    page_width: f32,
    page_height: f32,
    font_size: f32,
) -> Result<Vec<u8>, String> {
    let margin = 50.0_f32;
    let line_h = font_size * 1.4;
    let all_lines = wrap_text(&text, page_width - margin * 2.0, font_size);

    let lines_per_page = ((( page_height - margin * 2.0) / line_h).floor() as usize).max(1);
    let chunks: Vec<Vec<String>> = all_lines
        .chunks(lines_per_page)
        .map(|c| c.to_vec())
        .collect();

    let mut doc = Document::new((page_width, page_height)).map_err(|e| e.to_string())?;
    let font = doc.embed_font(&font_bytes).map_err(|e| e.to_string())?;

    for i in 1..chunks.len() {
        doc.insert_blank_page(i as u32, (page_width, page_height))
            .map_err(|e| e.to_string())?;
    }

    for (page_idx, chunk) in chunks.iter().enumerate() {
        let page_num = (page_idx + 1) as u32;
        let mut page = doc.page(page_num).map_err(|e| e.to_string())?;
        let mut y = page_height - margin - font_size;
        for line in chunk {
            if !line.is_empty() {
                page.add_text(line, font, [margin, y], font_size, [0.0, 0.0, 0.0])
                    .map_err(|e| e.to_string())?;
            }
            y -= line_h;
        }
    }

    doc.save_to_bytes().map_err(|e| e.to_string())
}

/// Extract specific pages into a new PDF. `pages` is 1-indexed.
#[tauri::command]
pub async fn extract_pages_pdf(bytes: Vec<u8>, pages: Vec<u32>) -> Result<Vec<u8>, String> {
    let doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    let mut sub = doc.extract_pages(&pages).map_err(|e| e.to_string())?;
    sub.save_to_bytes().map_err(|e| e.to_string())
}

/// Insert a blank page after `after` (0 = prepend). Page size is copied from
/// the adjacent page; falls back to A4 if the document is empty or size lookup fails.
#[tauri::command]
pub async fn insert_blank_page_pdf(bytes: Vec<u8>, after: u32) -> Result<Vec<u8>, String> {
    let mut doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;

    // Determine page size from adjacent page
    let total = doc.page_count();
    let ref_page = if after == 0 { 1 } else { after.min(total) };
    let (pw, ph) = doc
        .page(ref_page)
        .ok()
        .and_then(|p| p.size().ok())
        .unwrap_or((595.28, 841.89)); // A4 fallback

    doc.insert_blank_page(after, (pw, ph))
        .map_err(|e| e.to_string())?;
    doc.save_to_bytes().map_err(|e| e.to_string())
}

// ── Metadata ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_pdf_metadata(bytes: Vec<u8>) -> Result<MetadataPayload, String> {
    let doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    let meta = doc.metadata().map_err(|e| e.to_string())?;
    Ok(MetadataPayload {
        title: meta.title,
        author: meta.author,
        subject: meta.subject,
        keywords: meta.keywords,
        creator: meta.creator,
    })
}

#[tauri::command]
pub async fn set_pdf_metadata(bytes: Vec<u8>, meta: MetadataPayload) -> Result<Vec<u8>, String> {
    let mut doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    doc.set_metadata(&PdfMetadata {
        title: meta.title,
        author: meta.author,
        subject: meta.subject,
        keywords: meta.keywords,
        creator: meta.creator,
    })
    .map_err(|e| e.to_string())?;
    doc.save_to_bytes().map_err(|e| e.to_string())
}

// ── Sanitize ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn sanitize_pdf(
    bytes: Vec<u8>,
    remove_js: bool,
    remove_embedded: bool,
    remove_metadata: bool,
) -> Result<Vec<u8>, String> {
    use lopdf::Document as LDoc;
    use std::io::Cursor;

    let mut doc = LDoc::load_from(Cursor::new(&bytes)).map_err(|e| e.to_string())?;

    let catalog_id = doc
        .trailer
        .get(b"Root")
        .and_then(|o| o.as_reference())
        .map_err(|e| e.to_string())?;

    // Collect Names dict id before any mutable borrow
    let names_id: Option<lopdf::ObjectId> = doc
        .get_object(catalog_id)
        .ok()
        .and_then(|o| o.as_dict().ok())
        .and_then(|d| d.get(b"Names").ok())
        .and_then(|o| o.as_reference().ok());

    // Mutate catalog dict
    if let Ok(obj) = doc.get_object_mut(catalog_id) {
        if let Ok(cat) = obj.as_dict_mut() {
            if remove_js {
                cat.remove(b"OpenAction");
                cat.remove(b"AA");
            }
            if remove_embedded {
                cat.remove(b"EmbeddedFiles");
            }
            if remove_metadata {
                cat.remove(b"Metadata");
            }
        }
    }

    // Mutate Names dict
    if let Some(nid) = names_id {
        if let Ok(obj) = doc.get_object_mut(nid) {
            if let Ok(nd) = obj.as_dict_mut() {
                if remove_js {
                    nd.remove(b"JavaScript");
                }
                if remove_embedded {
                    nd.remove(b"EmbeddedFiles");
                }
            }
        }
    }

    if remove_metadata {
        doc.trailer.remove(b"Info");
    }

    let mut out = Vec::new();
    doc.save_to(&mut out).map_err(|e| e.to_string())?;
    Ok(out)
}

// ── Signature fields ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_signature_fields(bytes: Vec<u8>) -> Result<Vec<SignatureFieldInfo>, String> {
    use lopdf::Document as LDoc;
    use std::io::Cursor;

    let doc = LDoc::load_from(Cursor::new(&bytes)).map_err(|e| e.to_string())?;

    let catalog_id = match doc.trailer.get(b"Root").and_then(|o| o.as_reference()) {
        Ok(id) => id,
        Err(_) => return Ok(vec![]),
    };

    let acroform_id = match doc
        .get_object(catalog_id)
        .ok()
        .and_then(|o| o.as_dict().ok())
        .and_then(|d| d.get(b"AcroForm").ok())
        .and_then(|o| o.as_reference().ok())
    {
        Some(id) => id,
        None => return Ok(vec![]),
    };

    let fields_arr: Vec<lopdf::Object> = match doc
        .get_object(acroform_id)
        .ok()
        .and_then(|o| o.as_dict().ok())
        .and_then(|d| d.get(b"Fields").ok())
        .and_then(|o| o.as_array().ok())
    {
        Some(arr) => arr.clone(),
        None => return Ok(vec![]),
    };

    let mut result = Vec::new();
    let mut visited = std::collections::HashSet::new();
    for field_ref in &fields_arr {
        if let Ok(fid) = field_ref.as_reference() {
            collect_sig_fields(&doc, fid, &mut result, &mut visited);
        }
    }

    Ok(result)
}

fn collect_sig_fields(
    doc: &lopdf::Document,
    field_id: lopdf::ObjectId,
    out: &mut Vec<SignatureFieldInfo>,
    visited: &mut std::collections::HashSet<lopdf::ObjectId>,
) {
    if !visited.insert(field_id) { return; }
    let field_dict = match doc.get_object(field_id).ok().and_then(|o| o.as_dict().ok()) {
        Some(d) => d,
        None => return,
    };

    let is_sig = matches!(
        field_dict.get(b"FT"),
        Ok(lopdf::Object::Name(n)) if n == b"Sig"
    );

    if is_sig {
        let name = field_dict
            .get(b"T")
            .ok()
            .and_then(|o| o.as_str().ok())
            .map(|b| String::from_utf8_lossy(b).into_owned())
            .unwrap_or_default();

        let v_id = field_dict
            .get(b"V")
            .ok()
            .and_then(|o| o.as_reference().ok());

        let (reason, date) = if let Some(vid) = v_id {
            match doc.get_object(vid).ok().and_then(|o| o.as_dict().ok()) {
                Some(vd) => {
                    let r = vd
                        .get(b"Reason")
                        .ok()
                        .and_then(|o| o.as_str().ok())
                        .map(|b| String::from_utf8_lossy(b).into_owned());
                    let d = vd
                        .get(b"M")
                        .ok()
                        .and_then(|o| o.as_str().ok())
                        .map(|b| parse_pdf_date(String::from_utf8_lossy(b).as_ref()));
                    (r, d)
                }
                None => (None, None),
            }
        } else {
            (None, None)
        };

        out.push(SignatureFieldInfo { name, reason, date });
    }

    // Walk /Kids recursively
    let kids: Vec<lopdf::Object> = field_dict
        .get(b"Kids")
        .ok()
        .and_then(|o| o.as_array().ok())
        .cloned()
        .unwrap_or_default();

    for kid_ref in &kids {
        if let Ok(kid_id) = kid_ref.as_reference() {
            collect_sig_fields(doc, kid_id, out, visited);
        }
    }
}

fn parse_pdf_date(raw: &str) -> String {
    let s = raw.trim_matches(|c| c == '(' || c == ')');
    if let Some(rest) = s.strip_prefix("D:") {
        let chars: Vec<char> = rest.chars().collect();
        if chars.len() >= 14 {
            let y: String = chars[0..4].iter().collect();
            let mo: String = chars[4..6].iter().collect();
            let d: String = chars[6..8].iter().collect();
            let h: String = chars[8..10].iter().collect();
            let mi: String = chars[10..12].iter().collect();
            let sec: String = chars[12..14].iter().collect();
            return format!("{y}/{mo}/{d} {h}:{mi}:{sec}");
        }
    }
    String::new()
}

// ── Annotation baking helpers ─────────────────────────────────────────────────

fn hex_to_rgb(hex: &str) -> [f32; 3] {
    let h = hex.trim_start_matches('#');
    let parse = |i: usize| -> f32 {
        u8::from_str_radix(h.get(i..i + 2).unwrap_or("80"), 16).unwrap_or(128) as f32 / 255.0
    };
    [parse(0), parse(2), parse(4)]
}

fn load_font_bytes_for_lang(fonts_dir: &std::path::Path, lang: &str) -> Option<Vec<u8>> {
    let primary = match lang {
        "ja"    => "NotoSansJP-Regular.ttf",
        "zh-CN" => "NotoSansSC-Regular.ttf",
        "zh-TW" => "NotoSansTC-Regular.ttf",
        "ko"    => "NotoSansKR-Regular.ttf",
        _       => "NotoSans-Regular.ttf",
    };
    if let Ok(b) = std::fs::read(fonts_dir.join(primary)) {
        return Some(b);
    }
    // Fallback: first .ttf in directory
    let Ok(dir) = std::fs::read_dir(fonts_dir) else { return None };
    for entry in dir.flatten() {
        let p = entry.path();
        if p.extension().map_or(false, |e| e == "ttf") {
            if let Ok(b) = std::fs::read(&p) {
                return Some(b);
            }
        }
    }
    None
}

fn json_f32(v: &serde_json::Value, key: &str, default: f32) -> f32 {
    v[key].as_f64().unwrap_or(default as f64) as f32
}

fn json_u32(v: &serde_json::Value, key: &str, default: u32) -> u32 {
    v[key].as_u64().unwrap_or(default as u64) as u32
}

fn json_pdf_rect(v: &serde_json::Value) -> [f32; 4] {
    let r = &v["pdfRect"];
    [json_f32(r, "x", 0.0), json_f32(r, "y", 0.0), json_f32(r, "width", 100.0), json_f32(r, "height", 30.0)]
}

fn json_image_bytes(v: &serde_json::Value) -> Vec<u8> {
    v["imageBytes"].as_array()
        .map(|a| a.iter().filter_map(|n| n.as_u64().map(|n| n as u8)).collect())
        .unwrap_or_default()
}

fn pdf_text_escape(text: &str) -> String {
    text.replace('\\', r"\\").replace('(', r"\(").replace(')', r"\)")
}

#[tauri::command]
pub async fn bake_annotations(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    annotations: Vec<serde_json::Value>,
) -> Result<Vec<u8>, String> {
    use tauri::Manager;
    let mut doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    let fonts_dir = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| d.join("fonts"))
        .unwrap_or_default();

    // Pre-embed fonts for all langs used in textbox annotations
    let mut font_cache: std::collections::HashMap<String, harumi::FontHandle> = Default::default();
    for ann in &annotations {
        if ann["type"].as_str() == Some("textbox") {
            let lang = ann["lang"].as_str().unwrap_or("en").to_string();
            if !font_cache.contains_key(&lang) {
                if let Some(fb) = load_font_bytes_for_lang(&fonts_dir, &lang) {
                    if let Ok(fh) = doc.embed_font(&fb) {
                        font_cache.insert(lang, fh);
                    }
                }
            }
        }
        // stickynote / callout also need text
        if matches!(ann["type"].as_str(), Some("stickynote") | Some("callout")) {
            let lang = "en".to_string();
            if !font_cache.contains_key(&lang) {
                if let Some(fb) = load_font_bytes_for_lang(&fonts_dir, "en") {
                    if let Ok(fh) = doc.embed_font(&fb) {
                        font_cache.insert(lang, fh);
                    }
                }
            }
        }
    }
    let any_font: Option<harumi::FontHandle> = font_cache.values().copied().next();

    for ann in &annotations {
        let page_idx = json_u32(ann, "pageIndex", 0);
        let page_num = page_idx.saturating_add(1);
        let Ok(mut page) = doc.page(page_num) else { continue };

        match ann["type"].as_str().unwrap_or("") {
            "textbox" => {
                let lang = ann["lang"].as_str().unwrap_or("en");
                let font_opt = font_cache.get(lang).copied().or_else(|| any_font);
                let Some(font) = font_opt else { continue };
                let rect = json_pdf_rect(ann);
                let font_size = json_f32(ann, "fontSize", 12.0);
                let color = hex_to_rgb(ann["fontColor"].as_str().unwrap_or("#000000"));
                let content = ann["content"].as_str().unwrap_or("");
                let _ = page.add_text_box(content, font, rect, font_size, color, 0.0);
            }
            "highlight" => {
                let color_str = ann["color"].as_str().unwrap_or("#FFFF00");
                let color_trunc: String = color_str.chars().take(7).collect();
                let color = hex_to_rgb(&color_trunc);
                if let Some(rects) = ann["rects"].as_array() {
                    for r in rects {
                        let x = json_f32(r, "x", 0.0);
                        let y = json_f32(r, "y", 0.0);
                        let w = json_f32(r, "width", 0.0);
                        let h = json_f32(r, "height", 0.0);
                        let _ = page.add_rect([x, y, w, h], color, 0.4);
                    }
                }
            }
            "underline" => {
                let color = hex_to_rgb(ann["color"].as_str().unwrap_or("#000000"));
                if let Some(rects) = ann["rects"].as_array() {
                    for r in rects {
                        let x = json_f32(r, "x", 0.0);
                        let y = json_f32(r, "y", 0.0);
                        let w = json_f32(r, "width", 0.0);
                        let _ = page.add_line([x, y], [x + w, y], color, 1.0, 1.0);
                    }
                }
            }
            "strikethrough" => {
                let color = hex_to_rgb(ann["color"].as_str().unwrap_or("#000000"));
                if let Some(rects) = ann["rects"].as_array() {
                    for r in rects {
                        let x = json_f32(r, "x", 0.0);
                        let y = json_f32(r, "y", 0.0);
                        let h = json_f32(r, "height", 0.0);
                        let w = json_f32(r, "width", 0.0);
                        let mid = y + h / 2.0;
                        let _ = page.add_line([x, mid], [x + w, mid], color, 1.0, 1.0);
                    }
                }
            }
            "signature" => {
                let img = json_image_bytes(ann);
                if !img.is_empty() {
                    let rect = json_pdf_rect(ann);
                    let _ = page.add_image(&img, rect);
                }
            }
            "stamp" => {
                let img = json_image_bytes(ann);
                if !img.is_empty() {
                    let rect = json_pdf_rect(ann);
                    let opacity = json_f32(ann, "opacity", 1.0);
                    let _ = page.add_image_with_opacity(&img, rect, opacity);
                }
            }
            "image" => {
                let img = json_image_bytes(ann);
                if !img.is_empty() {
                    let rect = json_pdf_rect(ann);
                    let opacity = json_f32(ann, "opacity", 1.0);
                    let _ = page.add_image_with_opacity(&img, rect, opacity);
                }
            }
            "stickynote" => {
                let rect = json_pdf_rect(ann);
                let bg = hex_to_rgb(ann["color"].as_str().unwrap_or("#FFFF99"));
                let _ = page.add_rect(rect, bg, 0.85);
                let _ = page.add_rect_stroke(rect, [0.6, 0.5, 0.0], 0.5, 1.0);
                if let Some(font) = any_font {
                    let content = ann["content"].as_str().unwrap_or("");
                    let inner = [rect[0] + 2.0, rect[1] + 2.0, rect[2] - 4.0, (rect[3] - 4.0).max(1.0)];
                    let _ = page.add_text_box(content, font, inner, 8.0, [0.1, 0.1, 0.1], 0.0);
                }
            }
            "callout" => {
                let rect = json_pdf_rect(ann);
                let bg = hex_to_rgb(ann["color"].as_str().unwrap_or("#FFFFCC"));
                let tail_x = json_f32(ann, "tailPdfX", rect[0]);
                let tail_y = json_f32(ann, "tailPdfY", rect[1]);
                let box_cx = rect[0] + rect[2] / 2.0;
                let _ = page.add_rect(rect, bg, 0.9);
                let _ = page.add_rect_stroke(rect, [0.5, 0.5, 0.0], 0.5, 1.0);
                let _ = page.add_line([box_cx, rect[1]], [tail_x, tail_y], [0.4, 0.4, 0.0], 0.75, 1.0);
                if let Some(font) = any_font {
                    let font_size = json_f32(ann, "fontSize", 10.0);
                    let content = ann["content"].as_str().unwrap_or("");
                    let inner = [rect[0] + 3.0, rect[1] + 3.0, rect[2] - 6.0, (rect[3] - 6.0).max(1.0)];
                    let _ = page.add_text_box(content, font, inner, font_size, [0.0, 0.0, 0.0], 0.0);
                }
            }
            "shape" => {
                let shape_kind = ann["shape"].as_str().unwrap_or("rect");
                let stroke_hex = ann["strokeColor"].as_str().unwrap_or("#000000");
                let fill_hex = ann["fillColor"].as_str().unwrap_or("");
                let stroke_color = hex_to_rgb(stroke_hex);
                let stroke_width = json_f32(ann, "strokeWidth", 2.0);
                let opacity = json_f32(ann, "opacity", 1.0);
                let rect = json_pdf_rect(ann);

                match shape_kind {
                    "rect" => {
                        if !fill_hex.is_empty() {
                            let _ = page.add_rect(rect, hex_to_rgb(fill_hex), opacity);
                        }
                        let _ = page.add_rect_stroke(rect, stroke_color, stroke_width, opacity);
                    }
                    "line" => {
                        let x1 = json_f32(ann, "x1", rect[0]);
                        let y1 = json_f32(ann, "y1", rect[1]);
                        let x2 = json_f32(ann, "x2", rect[0] + rect[2]);
                        let y2 = json_f32(ann, "y2", rect[1] + rect[3]);
                        let _ = page.add_line([x1, y1], [x2, y2], stroke_color, stroke_width, opacity);
                    }
                    "arrow" => {
                        let x1 = json_f32(ann, "x1", rect[0]);
                        let y1 = json_f32(ann, "y1", rect[1]);
                        let x2 = json_f32(ann, "x2", rect[0] + rect[2]);
                        let y2 = json_f32(ann, "y2", rect[1] + rect[3]);
                        let _ = page.add_line([x1, y1], [x2, y2], stroke_color, stroke_width, opacity);
                        let dx = x2 - x1;
                        let dy = y2 - y1;
                        let len = (dx * dx + dy * dy).sqrt();
                        if len > 0.001 {
                            let nx = dx / len;
                            let ny = dy / len;
                            let as_ = (stroke_width * 4.0).max(10.0);
                            let wg = as_ * 0.38;
                            let ax = x2 - nx * as_ - ny * wg;
                            let ay = y2 - ny * as_ + nx * wg;
                            let bx = x2 - nx * as_ + ny * wg;
                            let by_ = y2 - ny * as_ - nx * wg;
                            let _ = page.add_line([x2, y2], [ax, ay], stroke_color, stroke_width, opacity);
                            let _ = page.add_line([x2, y2], [bx, by_], stroke_color, stroke_width, opacity);
                        }
                    }
                    // ellipse: handled in lopdf second pass below
                    _ => {}
                }
            }
            _ => {}
        }
    }

    let mut result = doc.save_to_bytes().map_err(|e| e.to_string())?;

    // Second pass: lopdf for ellipse shapes
    let ellipse_anns: Vec<&serde_json::Value> = annotations.iter()
        .filter(|a| a["type"].as_str() == Some("shape") && a["shape"].as_str() == Some("ellipse"))
        .collect();
    if !ellipse_anns.is_empty() {
        result = bake_ellipses_lopdf(result, &ellipse_anns)?;
    }

    // Third pass: lopdf for pencil strokes and polygon shapes
    let lopdf_path_anns: Vec<&serde_json::Value> = annotations.iter()
        .filter(|a| {
            a["type"].as_str() == Some("pencil")
            || (a["type"].as_str() == Some("shape") && a["shape"].as_str() == Some("polygon"))
        })
        .collect();
    if !lopdf_path_anns.is_empty() {
        result = bake_pencils_lopdf(result, &lopdf_path_anns)?;
    }

    Ok(result)
}

fn bake_ellipses_lopdf(bytes: Vec<u8>, anns: &[&serde_json::Value]) -> Result<Vec<u8>, String> {
    use std::io::Cursor;
    let mut doc = lopdf::Document::load_mem(&bytes).map_err(|e| e.to_string())?;
    let page_ids: Vec<lopdf::ObjectId> = doc.page_iter().collect();
    const K: f32 = 0.5522847498;

    for ann in anns {
        let page_idx = json_u32(ann, "pageIndex", 0) as usize;
        let Some(&page_id) = page_ids.get(page_idx) else { continue };
        ensure_inline_page_resources(&mut doc, page_id)?;

        let rect = json_pdf_rect(ann);
        let cx = rect[0] + rect[2] / 2.0;
        let cy = rect[1] + rect[3] / 2.0;
        let rx = rect[2] / 2.0;
        let ry = rect[3] / 2.0;

        let stroke_hex = ann["strokeColor"].as_str().unwrap_or("#000000");
        let fill_hex   = ann["fillColor"].as_str().unwrap_or("");
        let sw         = json_f32(ann, "strokeWidth", 2.0);
        let [sr, sg, sb] = hex_to_rgb(stroke_hex);

        let paint_op = if fill_hex.is_empty() {
            "S".to_string()
        } else {
            let [fr, fg, fb] = hex_to_rgb(fill_hex);
            format!("{:.4} {:.4} {:.4} rg B", fr, fg, fb)
        };

        let stream = format!(
            "q {sw:.4} w {sr:.4} {sg:.4} {sb:.4} RG \
             {:.4} {:.4} m \
             {:.4} {:.4} {:.4} {:.4} {:.4} {:.4} c \
             {:.4} {:.4} {:.4} {:.4} {:.4} {:.4} c \
             {:.4} {:.4} {:.4} {:.4} {:.4} {:.4} c \
             {:.4} {:.4} {:.4} {:.4} {:.4} {:.4} c \
             h {paint_op} Q",
            cx - rx, cy,
            cx - rx, cy + K*ry,  cx - K*rx, cy + ry,  cx, cy + ry,
            cx + K*rx, cy + ry,  cx + rx, cy + K*ry,  cx + rx, cy,
            cx + rx, cy - K*ry,  cx + K*rx, cy - ry,  cx, cy - ry,
            cx - K*rx, cy - ry,  cx - rx, cy - K*ry,  cx - rx, cy,
        );

        append_lopdf_content_stream(&mut doc, page_id, stream.into_bytes())?;
    }

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out)).map_err(|e| e.to_string())?;
    Ok(out)
}

fn bake_pencils_lopdf(bytes: Vec<u8>, anns: &[&serde_json::Value]) -> Result<Vec<u8>, String> {
    use std::io::Cursor;
    let mut doc = lopdf::Document::load_mem(&bytes).map_err(|e| e.to_string())?;
    let page_ids: Vec<lopdf::ObjectId> = doc.page_iter().collect();

    for ann in anns {
        let page_idx = json_u32(ann, "pageIndex", 0) as usize;
        let Some(&page_id) = page_ids.get(page_idx) else { continue };
        ensure_inline_page_resources(&mut doc, page_id)?;

        let is_polygon = ann["type"].as_str() == Some("shape") && ann["shape"].as_str() == Some("polygon");

        // Determine color / stroke width / opacity
        let (color_hex, fill_hex, sw, opacity) = if is_polygon {
            (
                ann["strokeColor"].as_str().unwrap_or("#000000"),
                ann["fillColor"].as_str().unwrap_or(""),
                json_f32(ann, "strokeWidth", 2.0),
                json_f32(ann, "opacity", 1.0),
            )
        } else {
            (
                ann["color"].as_str().unwrap_or("#000000"),
                "",
                json_f32(ann, "strokeWidth", 2.0),
                json_f32(ann, "opacity", 1.0),
            )
        };

        let [r, g, b] = hex_to_rgb(color_hex);

        let Some(pts) = ann["points"].as_array() else { continue };
        let min_pts = if is_polygon { 3 } else { 2 };
        if pts.len() < min_pts { continue }

        let mut stream = format!("q {sw:.4} w {r:.4} {g:.4} {b:.4} RG 1 J 1 j ");

        // ExtGState for opacity
        if opacity < 0.999 {
            let gs_name = b"GSp1";
            let mut gs_dict = lopdf::Dictionary::new();
            gs_dict.set("Type", lopdf::Object::Name(b"ExtGState".to_vec()));
            gs_dict.set("CA", lopdf::Object::Real(opacity));
            gs_dict.set("ca", lopdf::Object::Real(opacity));
            let gs_id = doc.add_object(lopdf::Object::Dictionary(gs_dict));
            let page_obj = doc.get_object_mut(page_id).map_err(|e| e.to_string())?;
            let page_dict = page_obj.as_dict_mut().map_err(|e| e.to_string())?;
            let res = page_dict.get_mut(b"Resources").ok().and_then(|o| o.as_dict_mut().ok());
            if let Some(res_dict) = res {
                let ext_gs = res_dict.get_mut(b"ExtGState").ok().and_then(|o| o.as_dict_mut().ok());
                if let Some(eg) = ext_gs {
                    eg.set(gs_name.to_vec(), lopdf::Object::Reference(gs_id));
                } else {
                    let mut eg = lopdf::Dictionary::new();
                    eg.set(gs_name.to_vec(), lopdf::Object::Reference(gs_id));
                    res_dict.set("ExtGState", lopdf::Object::Dictionary(eg));
                }
            }
            stream.push_str("/GSp1 gs ");
        }

        // Fill color for polygon
        if is_polygon && !fill_hex.is_empty() {
            let [fr, fg, fb] = hex_to_rgb(fill_hex);
            stream.push_str(&format!("{fr:.4} {fg:.4} {fb:.4} rg "));
        }

        // Build path from points
        let first = &pts[0];
        let x0 = first[0].as_f64().unwrap_or(0.0) as f32;
        let y0 = first[1].as_f64().unwrap_or(0.0) as f32;
        stream.push_str(&format!("{x0:.4} {y0:.4} m "));
        for pt in pts.iter().skip(1) {
            let x = pt[0].as_f64().unwrap_or(0.0) as f32;
            let y = pt[1].as_f64().unwrap_or(0.0) as f32;
            stream.push_str(&format!("{x:.4} {y:.4} l "));
        }

        // Close and paint
        if is_polygon && !fill_hex.is_empty() {
            stream.push_str("h B Q"); // close + fill + stroke
        } else if is_polygon {
            stream.push_str("h S Q"); // close + stroke only
        } else {
            stream.push_str("S Q");   // pencil: open stroke
        }

        append_lopdf_content_stream(&mut doc, page_id, stream.into_bytes())?;
    }

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out)).map_err(|e| e.to_string())?;
    Ok(out)
}

// ── Watermark ─────────────────────────────────────────────────────────────────

fn ensure_inline_page_resources(doc: &mut lopdf::Document, page_id: lopdf::ObjectId) -> Result<(), String> {
    use lopdf::Object;
    enum Rs { Inline, Ref(lopdf::ObjectId), None }
    let state = {
        let dict = doc.get_object(page_id).map_err(|e| e.to_string())?.as_dict().map_err(|e| e.to_string())?;
        match dict.get(b"Resources") {
            Ok(Object::Dictionary(_)) => Rs::Inline,
            Ok(Object::Reference(id)) => Rs::Ref(*id),
            _ => Rs::None,
        }
    };
    match state {
        Rs::Inline => {}
        Rs::Ref(rid) => {
            let res = doc.get_object(rid).map_err(|e| e.to_string())?
                .as_dict().map_err(|e| e.to_string())?.clone();
            doc.get_object_mut(page_id).map_err(|e| e.to_string())?
                .as_dict_mut().map_err(|e| e.to_string())?
                .set("Resources", Object::Dictionary(res));
        }
        Rs::None => {
            doc.get_object_mut(page_id).map_err(|e| e.to_string())?
                .as_dict_mut().map_err(|e| e.to_string())?
                .set("Resources", Object::Dictionary(lopdf::Dictionary::new()));
        }
    }
    Ok(())
}

fn lopdf_page_size(doc: &lopdf::Document, page_id: lopdf::ObjectId) -> (f32, f32) {
    let fallback = (595.28_f32, 841.89_f32);
    let Ok(obj) = doc.get_object(page_id) else { return fallback };
    let Ok(dict) = obj.as_dict() else { return fallback };
    let Ok(mb) = dict.get(b"MediaBox").and_then(|o| o.as_array()) else { return fallback };
    if mb.len() < 4 { return fallback }
    let get = |i: usize| match &mb[i] {
        lopdf::Object::Integer(v) => *v as f32,
        lopdf::Object::Real(v) => *v,
        _ => 0.0,
    };
    (get(2) - get(0), get(3) - get(1))
}

fn append_lopdf_content_stream(
    doc: &mut lopdf::Document,
    page_id: lopdf::ObjectId,
    content: Vec<u8>,
) -> Result<(), String> {
    use lopdf::Object;
    let new_id = doc.add_object(Object::Stream(lopdf::Stream::new(lopdf::Dictionary::new(), content)));
    let existing = doc.get_object(page_id).map_err(|e| e.to_string())?
        .as_dict().map_err(|e| e.to_string())?
        .get(b"Contents").ok().cloned();
    let page_dict = doc.get_object_mut(page_id).map_err(|e| e.to_string())?
        .as_dict_mut().map_err(|e| e.to_string())?;
    match existing {
        None => page_dict.set("Contents", Object::Reference(new_id)),
        Some(Object::Reference(r)) => page_dict.set("Contents", Object::Array(vec![
            Object::Reference(r), Object::Reference(new_id),
        ])),
        Some(Object::Array(mut arr)) => {
            arr.push(Object::Reference(new_id));
            page_dict.set("Contents", Object::Array(arr));
        }
        _ => page_dict.set("Contents", Object::Reference(new_id)),
    }
    Ok(())
}

#[tauri::command]
pub async fn add_watermark_pdf(
    bytes: Vec<u8>,
    text: String,
    font_size: f32,
    color: String,
    opacity: f32,
    rotation: f32,
    pages: Option<Vec<u32>>,
) -> Result<Vec<u8>, String> {
    use std::io::Cursor;
    use lopdf::{Dictionary, Object};

    let mut doc = lopdf::Document::load_from(Cursor::new(&bytes)).map_err(|e| e.to_string())?;
    let [r, g, b] = hex_to_rgb(&color);

    let angle = rotation * std::f32::consts::PI / 180.0;
    let cos_a = angle.cos();
    let sin_a = angle.sin();

    // Add shared Helvetica font object (Type1)
    let mut font_dict = Dictionary::new();
    font_dict.set("Type",     Object::Name(b"Font".to_vec()));
    font_dict.set("Subtype",  Object::Name(b"Type1".to_vec()));
    font_dict.set("BaseFont", Object::Name(b"Helvetica".to_vec()));
    font_dict.set("Encoding", Object::Name(b"WinAnsiEncoding".to_vec()));
    let font_id = doc.add_object(Object::Dictionary(font_dict));

    let all_pages: Vec<(u32, lopdf::ObjectId)> = {
        let mut v: Vec<_> = doc.get_pages().into_iter().collect();
        v.sort_by_key(|(n, _)| *n);
        v
    };

    let target_pages: Vec<(u32, lopdf::ObjectId)> = match &pages {
        Some(ps) => all_pages.into_iter().filter(|(n, _)| ps.contains(n)).collect(),
        None => all_pages,
    };

    // Estimate text width (Helvetica ≈ 0.5 × font_size per char)
    let text_w = text.chars().count() as f32 * font_size * 0.50;
    let tx = -text_w / 2.0;
    let ty = -(font_size * 0.25);

    let escaped = pdf_text_escape(&text);

    for (_, page_id) in &target_pages {
        let page_id = *page_id;
        let (pw, ph) = lopdf_page_size(&doc, page_id);
        let cx = pw / 2.0;
        let cy = ph / 2.0;

        ensure_inline_page_resources(&mut doc, page_id)?;

        // Add GS + Font to page Resources
        {
            let page_dict = doc.get_object_mut(page_id).map_err(|e| e.to_string())?
                .as_dict_mut().map_err(|e| e.to_string())?;
            let res = page_dict.get_mut(b"Resources").map_err(|e| format!("{e}"))?
                .as_dict_mut().map_err(|e| format!("{e}"))?;

            // Font
            if !res.has(b"Font") { res.set("Font", Object::Dictionary(Dictionary::new())); }
            res.get_mut(b"Font").unwrap().as_dict_mut().unwrap()
                .set("WmFont", Object::Reference(font_id));

            // ExtGState
            if !res.has(b"ExtGState") { res.set("ExtGState", Object::Dictionary(Dictionary::new())); }
            let mut gs_d = Dictionary::new();
            gs_d.set("ca", Object::Real(opacity));
            gs_d.set("CA", Object::Real(opacity));
            res.get_mut(b"ExtGState").unwrap().as_dict_mut().unwrap()
                .set("WmGS", Object::Dictionary(gs_d));
        }

        let stream = format!(
            "q\n/WmGS gs\n{cos:.4} {sin:.4} {msin:.4} {cos:.4} {cx:.4} {cy:.4} cm\n{r:.4} {g:.4} {b:.4} rg\nBT\n/WmFont {size:.1} Tf\n{tx:.2} {ty:.2} Td\n({text}) Tj\nET\nQ\n",
            cos = cos_a, sin = sin_a, msin = -sin_a,
            cx = cx, cy = cy,
            r = r, g = g, b = b,
            size = font_size,
            tx = tx, ty = ty,
            text = escaped,
        );
        append_lopdf_content_stream(&mut doc, page_id, stream.into_bytes())?;
    }

    let mut out = Vec::new();
    doc.save_to(&mut out).map_err(|e| e.to_string())?;
    Ok(out)
}

// ── Header / Footer ───────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct HeaderFooterOptions {
    pub text: String,
    pub font_size: f32,
    pub color: String,
    pub position: String, // "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
    pub margin: f32,
    pub pages: Option<Vec<u32>>,
}

#[tauri::command]
pub async fn add_header_footer_pdf(
    app: tauri::AppHandle,
    bytes: Vec<u8>,
    options: HeaderFooterOptions,
) -> Result<Vec<u8>, String> {
    use tauri::Manager;
    let mut doc = Document::from_bytes(&bytes).map_err(|e| e.to_string())?;
    let fonts_dir = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| d.join("fonts"))
        .unwrap_or_default();

    let font_bytes = load_font_bytes_for_lang(&fonts_dir, "en")
        .ok_or_else(|| "フォントが見つかりません。src-tauri/fonts/ にフォントをインストールしてください。".to_string())?;
    let font = doc.embed_font(&font_bytes).map_err(|e| e.to_string())?;

    let color = hex_to_rgb(&options.color);
    let total = doc.page_count();

    let page_nums: Vec<u32> = options.pages.clone().unwrap_or_else(|| (1..=total).collect());

    for page_num in page_nums {
        if page_num < 1 || page_num > total { continue; }

        let (pw, ph) = doc.page(page_num)
            .and_then(|p| p.size())
            .unwrap_or((595.28, 841.89));

        let text = options.text
            .replace("{n}", &page_num.to_string())
            .replace("{total}", &total.to_string());

        // Estimate text width (0.55 * font_size * nchars)
        let text_w = text.chars().count() as f32 * options.font_size * 0.55;

        let y = if options.position.starts_with("top") {
            ph - options.margin - options.font_size
        } else {
            options.margin
        };
        let x = if options.position.ends_with("left") {
            options.margin
        } else if options.position.ends_with("right") {
            (pw - options.margin - text_w).max(options.margin)
        } else {
            ((pw - text_w) / 2.0).max(options.margin)
        };

        if let Ok(mut page) = doc.page(page_num) {
            let _ = page.add_text_with_opacity(&text, font, [x, y], options.font_size, color, 1.0);
        }
    }

    doc.save_to_bytes().map_err(|e| e.to_string())
}

// ── PDF Compress ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn compress_pdf(
    bytes: Vec<u8>,
    image_quality: u8,
    max_image_pixels: u32,
    remove_metadata: bool,
) -> Result<Vec<u8>, String> {
    use std::io::Cursor;

    let mut doc = lopdf::Document::load_mem(&bytes).map_err(|e| e.to_string())?;

    // Collect image XObject IDs
    let image_ids: Vec<lopdf::ObjectId> = doc.objects.iter()
        .filter_map(|(&id, obj)| {
            let lopdf::Object::Stream(s) = obj else { return None };
            let is_image = s.dict.get(b"Subtype").ok()
                .and_then(|o| o.as_name().ok())
                .map_or(false, |n| n == b"Image");
            if is_image { Some(id) } else { None }
        })
        .collect();

    for id in image_ids {
        if let Some(new_stream) = compress_one_image(&doc, id, image_quality, max_image_pixels) {
            doc.objects.insert(id, lopdf::Object::Stream(new_stream));
        }
    }

    if remove_metadata {
        doc.trailer.remove(b"Info");
        let meta_ids: Vec<lopdf::ObjectId> = doc.objects.iter()
            .filter_map(|(&id, obj)| {
                let lopdf::Object::Stream(s) = obj else { return None };
                let is_meta = s.dict.get(b"Type").ok()
                    .and_then(|o| o.as_name().ok())
                    .map_or(false, |n| n == b"Metadata");
                if is_meta { Some(id) } else { None }
            })
            .collect();
        for id in meta_ids {
            doc.objects.remove(&id);
        }
    }

    let mut out = Vec::new();
    doc.save_to(&mut Cursor::new(&mut out)).map_err(|e| e.to_string())?;
    Ok(out)
}

fn compress_one_image(
    doc: &lopdf::Document,
    id: lopdf::ObjectId,
    quality: u8,
    max_px: u32,
) -> Option<lopdf::Stream> {
    use image::{DynamicImage, ImageFormat, codecs::jpeg::JpegEncoder};

    let stream = match doc.objects.get(&id) {
        Some(lopdf::Object::Stream(s)) => s,
        _ => return None,
    };

    let width  = u32::try_from(stream.dict.get(b"Width").ok()?.as_i64().ok()?).ok()?;
    let height = u32::try_from(stream.dict.get(b"Height").ok()?.as_i64().ok()?).ok()?;
    if width == 0 || height == 0 { return None; }

    let needs_resize = max_px > 0 && (width > max_px || height > max_px);

    // Get primary filter
    let filter: Option<Vec<u8>> = stream.dict.get(b"Filter").ok()
        .and_then(|o| match o {
            lopdf::Object::Name(n) => Some(n.clone()),
            lopdf::Object::Array(arr) => arr.first()?.as_name().ok().map(|n| n.to_vec()),
            _ => None,
        });

    let img: DynamicImage = match filter.as_deref() {
        Some(b"DCTDecode") => {
            // Always re-encode JPEG at new quality (+ resize if needed)
            image::load_from_memory_with_format(&stream.content, ImageFormat::Jpeg).ok()?
        }
        Some(b"FlateDecode") | None => {
            if !needs_resize { return None; }
            let mut s = stream.clone();
            s.decompress().ok()?;
            let raw = s.content;
            let cs = stream.dict.get(b"ColorSpace").ok()
                .and_then(|o| o.as_name().ok()).map(|n| n.to_vec());
            let bits = stream.dict.get(b"BitsPerComponent").ok()
                .and_then(|o| o.as_i64().ok()).unwrap_or(8);
            if bits != 8 { return None; }
            match cs.as_deref() {
                Some(b"DeviceRGB") =>
                    DynamicImage::ImageRgb8(image::RgbImage::from_raw(width, height, raw)?),
                Some(b"DeviceGray") =>
                    DynamicImage::ImageLuma8(image::GrayImage::from_raw(width, height, raw)?),
                _ => return None,
            }
        }
        _ => return None,
    };

    // Resize if needed
    let img = if needs_resize {
        img.resize(max_px, max_px, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    let nw = img.width();
    let nh = img.height();

    // Determine output color space before consuming img
    let cs_name: &[u8] = match &img {
        DynamicImage::ImageLuma8(_) | DynamicImage::ImageLuma16(_) => b"DeviceGray",
        _ => b"DeviceRGB",
    };

    // Convert to RGB(A) for JPEG encoding if grayscale
    let img = img.into_rgb8();

    let mut jpeg = Vec::new();
    let encoder = JpegEncoder::new_with_quality(&mut jpeg, quality);
    use image::ImageEncoder;
    encoder.write_image(img.as_raw(), nw, nh, image::ExtendedColorType::Rgb8).ok()?;

    let mut new_dict = lopdf::Dictionary::new();
    new_dict.set("Type",             lopdf::Object::Name(b"XObject".to_vec()));
    new_dict.set("Subtype",          lopdf::Object::Name(b"Image".to_vec()));
    new_dict.set("Width",            lopdf::Object::Integer(nw as i64));
    new_dict.set("Height",           lopdf::Object::Integer(nh as i64));
    new_dict.set("ColorSpace",       lopdf::Object::Name(cs_name.to_vec()));
    new_dict.set("BitsPerComponent", lopdf::Object::Integer(8));
    new_dict.set("Filter",           lopdf::Object::Name(b"DCTDecode".to_vec()));
    new_dict.set("Length",           lopdf::Object::Integer(jpeg.len() as i64));

    Some(lopdf::Stream::new(new_dict, jpeg))
}
