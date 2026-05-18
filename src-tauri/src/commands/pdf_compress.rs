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
