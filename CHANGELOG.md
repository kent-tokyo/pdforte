# Changelog

All notable changes to pdforte are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Smart text box placement** — background color, font size, and font family are auto-detected from the surrounding PDF canvas pixels and text content when a text box is placed
- **Clear background button** — toolbar button to reset text box background to transparent

### Changed
- Text box default background changed from yellow to white (`rgba(255,255,255,0.9)`)
- reqwest upgraded 0.12 → 0.13 (`rustls-tls` feature renamed to `rustls`)

### Security
- `validate_path` now canonicalizes the path and enforces `starts_with(HOME | temp_dir)` confinement — previously only rejected literal `..` components, leaving absolute paths and symlink escapes unguarded
- `read_file_bytes` and `save_bytes` commands now call `validate_path` before accessing the filesystem
- `convert_via_libreoffice` now validates `input_path` and `output_dir`
- `protect_pdf` argfile (containing passwords) is now always deleted, including on timeout and JoinError paths

### Fixed
- Polygon annotations placed after zooming were baked with wrong PDF coordinates (stale `finalizePolygon` closure)
- OCR temporary image files were not deleted when Tesseract timed out or `spawn_blocking` failed
- `getTextContent()` effect now guards against stale font data being written after a component re-renders due to zoom
- Current-page detection formula corrected (`containerRect.bottom / 2` → `(containerRect.top + containerRect.bottom) / 2`)
- Watermark command no longer panics on PDFs where Font/ExtGState resources are stored as indirect references (Ghostscript, Acrobat)

### Performance / Refactoring
- Annotation store: `idToPage` reverse map makes `findPage` O(1) instead of O(pages × annotations)
- `updateAnnotationSilent` prevents one undo snapshot per keystroke in text boxes; undo checkpoint is committed on blur
- Rust: shared `validate_path` and `with_doc` helpers centralised in `commands/mod.rs`

---

## [0.2.1] — 2025-05-xx

### Added
- **Ctrl+F inline find bar** — floating search bar over the viewer; Enter/Shift+Enter to navigate hits, Esc to close; shared `useSearch` hook with the sidebar search panel
- **Right-click context menu** — right-click selected text → Copy; right-click any annotation → Delete / Edit comment
- **Annotation comments** — `comment?` field added to all annotation types; right-click → "Edit comment" opens a balloon input; comments are previewed in the annotation list panel
- **Thumbnail drag-to-reorder** — drag page thumbnails in the sidebar to reorder pages (uses `reorderPages` + `loadFromBytes`, same as the Page Order dialog)
- macOS universal binary (arm64 + x86_64) via GitHub Actions
- Linux AppImage build in CI

### Changed
- `pdf_ops.rs` split into four focused modules: `pdf_annotations`, `pdf_compress`, `pdf_metadata`, `pdf_pages`
- `uiStore` dialog state consolidated to `Record<DialogName, boolean>` (Phase 2-B refactor)
- I/O operations moved to `spawn_blocking`; thumbnail rendering made lazy
- Several React selector optimizations (per-key subscriptions instead of whole-object)

### Fixed
- Security: TOCTOU in file write (now uses `O_CREAT|O_EXCL` + mode 0o600)
- Security: qpdf passwords passed via argfile/stdin instead of command-line arguments
- Security: annotation store cleared on PDF document switch
- Bug: consecutive saves caused double-baking of annotations (`originalBytes` not updated)
- Bug: Tesseract subprocess now has a 120-second timeout
- Bug: `useFileDrop` event listener leaked between file opens
- Bug: btoa stack overflow on large images (chunked processing with 8192-byte slices)
- Bug: text-edit undo did not restore hidden spans correctly
- Bug: watermark command crashed on non-ASCII characters

---

## [0.2.0] — 2025-04-xx

### Added
- **pdf-lib → harumi migration** — all PDF manipulation (annotations baking, merge, split, rotate, reorder, compress, metadata, sanitize, watermark, header/footer, page numbers) moved to Rust using lopdf + harumi; pdf-lib removed
- **Flatten PDF** — bake annotations into page content
- **Compress PDF** — image resampling (DCT/FlateDecode)
- **Watermark** — diagonal text overlay with custom font/color/opacity/rotation
- **Header / Footer** — 6-position page text with `{n}`/`{total}` macros
- **Page numbers** — insert at configurable position
- **Extract pages** — save a page range as a new PDF
- **Protect PDF** — AES-256 password protection via qpdf
- **Remove password** — decrypt PDF via qpdf
- **PDF Sanitize** — remove JS, OpenAction, embedded files
- **Signature verification** — display AcroForm /Sig field info
- **Metadata editor** — read/write title, author, subject, keywords
- **Image annotation** — insert JPEG/PNG onto page with resize handles
- **Pencil / Freehand** — stroke annotation baked to PDF
- **Callout annotation** — text box with draggable arrow tail
- **Sticky Note** — click-to-expand popup note
- **Annotation comments** foundation (`comment?` field)
- **Export/Import annotations** — `.annot` JSON format
- **AI PDF Translation** — DeepL / OpenAI / Claude API; results placed as TextBox annotations
- **OCR** — Tesseract text extraction and searchable PDF layer
- **PDF Scanner** — image → PDF conversion
- **LibreOffice integration** — Office ↔ PDF conversion with auto-detection
- **Export images** — PDF pages → JPEG/PNG
- **Save as Text** — full-text extraction to .txt
- **Print dialog** — page range, paper size, orientation
- **Reading mode** — hide toolbar/sidebar (Ctrl+Shift+H)
- **Recent files** — persistent Acrobat-style home screen
- **File explorer sidebar** — VS Code-style directory tree
- **10-language UI** — ja/en/zh-CN/zh-TW/ko/it/fr/de/es/pt
- Windows installer (NSIS + WiX) via GitHub Actions CI

---

## [0.1.0] — 2025-03-xx

### Added
- Initial release
- PDF viewer (continuous scroll, zoom, thumbnails, bookmarks, text search)
- TextBox, Highlight, Underline, Strikethrough, Signature, Stamp annotations
- Undo/Redo (unlimited)
- Save / Save As (annotation baking via harumi)
- Keyboard shortcuts: Ctrl+O, Ctrl+S, Ctrl+Z/Y
- File drag & drop
- Dark UI (Adobe Acrobat-inspired)
- i18n: Japanese and English
- macOS .app and Windows portable zip
