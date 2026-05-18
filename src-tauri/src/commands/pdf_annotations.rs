use harumi::Document;

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
