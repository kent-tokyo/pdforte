use harumi::Document;

use super::with_doc;

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
    with_doc(&bytes, |doc| {
        for (page, deg) in rotations {
            doc.rotate_page(page, deg).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn reorder_pages_pdf(bytes: Vec<u8>, new_order: Vec<u32>) -> Result<Vec<u8>, String> {
    with_doc(&bytes, |doc| {
        doc.reorder_pages(&new_order).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub async fn delete_pages_pdf(bytes: Vec<u8>, mut pages: Vec<u32>) -> Result<Vec<u8>, String> {
    pages.sort_unstable_by(|a, b| b.cmp(a));
    pages.dedup();
    with_doc(&bytes, |doc| {
        for p in &pages {
            doc.remove_page(*p).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
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
    with_doc(&bytes, |doc| {
        // Determine page size from adjacent page
        let total = doc.page_count();
        let ref_page = if after == 0 { 1 } else { after.min(total) };
        let (pw, ph) = doc
            .page(ref_page)
            .ok()
            .and_then(|p| p.size().ok())
            .unwrap_or((595.28, 841.89)); // A4 fallback

        doc.insert_blank_page(after, (pw, ph)).map_err(|e| e.to_string())
    })
}
