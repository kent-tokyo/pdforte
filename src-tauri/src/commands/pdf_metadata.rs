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
