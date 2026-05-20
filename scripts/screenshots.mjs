/**
 * Automated screenshot & GIF generator for pdforte.
 *
 * Starts the Vite dev server, launches Playwright Chromium, injects Tauri API
 * mocks, then captures PNG screenshots and GIF animations for each feature.
 *
 * Usage:  node scripts/screenshots.mjs
 * Output: docs/screenshots/
 */

import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { execSync, execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "docs", "screenshots");
const FRAMES = resolve(OUT, "_frames");

mkdirSync(OUT, { recursive: true });
mkdirSync(FRAMES, { recursive: true });

// ── Tauri mock injected before the page scripts run ──────────────────────────

const TAURI_MOCK = /* js */ `
(function () {
  let _listenerId = 100;
  window.__TAURI_INTERNALS__ = {
    invoke: async function(cmd, args) {
      if (cmd === 'plugin:event|listen')   return _listenerId++;
      if (cmd === 'plugin:event|unlisten') return null;
      if (cmd === 'read_settings')          return '{"recentFiles":[]}';
      if (cmd === 'write_settings')         return null;
      if (cmd === 'open_file_dialog')       return null;
      if (cmd === 'save_file_dialog')       return null;
      if (cmd === 'open_pdf') {
        var res = await fetch('/sample.pdf');
        var buf = await res.arrayBuffer();
        return { bytes: Array.from(new Uint8Array(buf)), file_path: '/sample.pdf', sidecar: null };
      }
      console.log('[mock tauri] unhandled:', cmd, args);
      return null;
    },
    transformCallback: function() { return 0; },
    convertFileSrc:    function(src) { return src; },
    metadata: {
      currentWindow:  { label: 'main' },
      currentWebview: { label: 'main', windowLabel: 'main' }
    }
  };
})();
`;

// ── helpers ───────────────────────────────────────────────────────────────────

let _viteServer;

async function startVite() {
  console.log("▶ Starting Vite dev server…");
  _viteServer = await createServer({ root: ROOT });
  await _viteServer.listen(1420);
  console.log("  Vite running at http://localhost:1420");
}

async function stopVite() {
  if (_viteServer) await _viteServer.close();
}

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: opts.scale ?? 2,
  });
  const page = await ctx.newPage();
  await page.addInitScript(TAURI_MOCK);
  return page;
}

async function goto(page) {
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  // Wait for test helpers to be set up
  await page.waitForFunction(() => !!window.__TEST__, { timeout: 10_000 });
}

/** Inject mock annotations for demo purposes */
async function addDemoAnnotations(page) {
  await page.evaluate(() => {
    const ann = window.__TEST__.useAnnotationStore.getState();
    ann.clearAnnotations();

    // Text box near top of page 1
    ann.addAnnotation({
      type: "textbox",
      pageIndex: 0,
      pdfRect: { x: 56, y: 590, width: 380, height: 60 },
      content: "This is a text annotation!",
      fontSize: 14,
      fontColor: "#1a1a2e",
      bgColor: "#fffde7",
      bold: false,
      italic: false,
      lang: "en",
    });

    // Highlight rect near top of page 1
    ann.addAnnotation({
      type: "highlight",
      pageIndex: 0,
      pdfRect: { x: 56, y: 735, width: 420, height: 16 },
      color: "#ffd600",
      rects: [{ x: 56, y: 735, width: 420, height: 16 }],
    });

    // Rectangle shape on page 1
    ann.addAnnotation({
      type: "shape",
      shape: "rect",
      pageIndex: 0,
      pdfRect: { x: 56, y: 470, width: 220, height: 60 },
      strokeColor: "#1565c0",
      fillColor: "#e3f2fd",
      strokeWidth: 2,
      opacity: 0.85,
    });

    // Sticky note on page 1
    ann.addAnnotation({
      type: "stickynote",
      pageIndex: 0,
      pdfRect: { x: 460, y: 680, width: 32, height: 32 },
      content: "Review this section.",
      color: "#fff9c4",
    });
  });
}

/** Load sample PDF via the window.__TEST__ helper */
async function loadPdf(page) {
  await page.evaluate(async () => {
    await window.__TEST__.loadPdfFromUrl("/sample.pdf", "/tmp/sample.pdf");
  });
  // Wait until pdfDoc is populated
  await page.waitForFunction(
    () => window.__TEST__.usePdfStore.getState().numPages > 0,
    { timeout: 15_000 }
  );
  // Extra wait for initial render
  await page.waitForTimeout(1200);
}

/** Open a dialog by name */
async function openDialog(page, name) {
  await page.evaluate((n) => {
    window.__TEST__.useUiStore.getState().setDialogOpen(n);
  }, name);
  await page.waitForTimeout(400);
}

/** Close the open dialog */
async function closeDialog(page) {
  await page.evaluate(() => {
    window.__TEST__.useUiStore.getState().setDialogOpen(null);
  });
  await page.waitForTimeout(200);
}

/** Switch sidebar tab */
async function setSidebarTab(page, tab) {
  await page.evaluate((t) => {
    window.__TEST__.useUiStore.getState().setSidebarTab(t);
  }, tab);
  await page.waitForTimeout(300);
}

/** Save a screenshot to OUT/<name>.png */
async function shot(page, name) {
  const file = resolve(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  📸 ${name}.png`);
  return file;
}

/** Save a GIF frame to FRAMES/<prefix>_<n>.png */
async function frame(page, prefix, n) {
  const file = resolve(FRAMES, `${prefix}_${String(n).padStart(3, "0")}.png`);
  await page.screenshot({ path: file });
  return file;
}

/** Build a GIF from FRAMES/<prefix>_*.png using ffmpeg */
function makeGif(prefix, fps = 2, scale = 900) {
  const inputPattern = resolve(FRAMES, `${prefix}_*.png`);
  const output = resolve(OUT, `${prefix}.gif`);
  try {
    execFileSync("ffmpeg", [
      "-y",
      "-framerate", String(fps),
      "-pattern_type", "glob",
      "-i", inputPattern,
      "-vf", `fps=${fps},scale=${scale}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      output,
    ], { stdio: "pipe" });
    console.log(`  🎞  ${prefix}.gif`);
  } catch (e) {
    console.warn(`  ⚠ ffmpeg failed for ${prefix}:`, e.message.slice(0, 120));
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  await startVite();

  const browser = await chromium.launch({ headless: true });

  try {
    // ── Still screenshots ────────────────────────────────────────────────────

    console.log("\n─── Still screenshots ───────────────────────────────────────");

    // 01 – home screen (no PDF)
    {
      const p = await newPage(browser);
      await goto(p);
      await shot(p, "01-home");
      await p.close();
    }

    // 02 – viewer: default thumbnail sidebar
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "thumbnails");
      await shot(p, "02-viewer");
      await p.close();
    }

    // 03 – thumbnails sidebar close-up
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "thumbnails");
      // Wait for thumbnails to render
      await p.waitForTimeout(1500);
      await shot(p, "03-thumbnails");
      await p.close();
    }

    // 04 – search panel
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "search");
      // Type a search query
      const input = p.locator('input[placeholder], input[type="text"]').first();
      if (await input.count()) {
        await input.click();
        await input.fill("features");
        await input.press("Enter");
        await p.waitForTimeout(800);
      }
      await shot(p, "04-search");
      await p.close();
    }

    // 05 – bookmarks panel
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "bookmarks");
      await p.waitForTimeout(600);
      await shot(p, "05-bookmarks");
      await p.close();
    }

    // 06 – annotations panel
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await addDemoAnnotations(p);
      await setSidebarTab(p, "annotations");
      await p.waitForTimeout(400);
      await shot(p, "06-annotations-panel");
      await p.close();
    }

    // 07 – text box annotation selected
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "thumbnails");
      await addDemoAnnotations(p);
      await p.waitForTimeout(400);
      // Select the text box annotation
      await p.evaluate(() => {
        const annStore = window.__TEST__.useAnnotationStore.getState();
        const anns = annStore.annotations.get(0) ?? [];
        const tb = anns.find((a) => a.type === "textbox");
        if (tb) annStore.setSelectedId(tb.id);
      });
      await p.waitForTimeout(300);
      await shot(p, "07-textbox");
      await p.close();
    }

    // 08 – highlight + shape annotations
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "thumbnails");
      await addDemoAnnotations(p);
      await p.waitForTimeout(400);
      await shot(p, "08-annotations-on-page");
      await p.close();
    }

    // 09 – shape selected
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "thumbnails");
      await addDemoAnnotations(p);
      await p.evaluate(() => {
        const annStore = window.__TEST__.useAnnotationStore.getState();
        const anns = annStore.annotations.get(0) ?? [];
        const shape = anns.find((a) => a.type === "shape");
        if (shape) annStore.setSelectedId(shape.id);
      });
      await p.waitForTimeout(300);
      await shot(p, "09-shape");
      await p.close();
    }

    // 10 – signature dialog
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await openDialog(p, "signature");
      await shot(p, "10-signature-dialog");
      await p.close();
    }

    // 11 – merge dialog
    {
      const p = await newPage(browser);
      await goto(p);
      await openDialog(p, "merge");
      await shot(p, "11-merge-dialog");
      await p.close();
    }

    // 12 – translate dialog
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await openDialog(p, "translate");
      await shot(p, "12-translate-dialog");
      await p.close();
    }

    // 13 – protect dialog
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await openDialog(p, "protect");
      await shot(p, "13-protect-dialog");
      await p.close();
    }

    // 14 – settings dialog
    {
      const p = await newPage(browser);
      await goto(p);
      await openDialog(p, "settings");
      await shot(p, "14-settings-dialog");
      await p.close();
    }

    // 15 – watermark dialog
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await openDialog(p, "watermark");
      await shot(p, "15-watermark-dialog");
      await p.close();
    }

    // 16 – OCR dialog
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await openDialog(p, "ocr");
      await shot(p, "16-ocr-dialog");
      await p.close();
    }

    // 17 – metadata dialog
    {
      const p = await newPage(browser);
      await goto(p);
      await loadPdf(p);
      await openDialog(p, "metadata");
      await shot(p, "17-metadata-dialog");
      await p.close();
    }

    // ── GIF animations ───────────────────────────────────────────────────────

    console.log("\n─── GIF animations ─────────────────────────────────────────");

    // demo-open: home → load PDF → scroll through pages
    {
      const p = await newPage(browser, { scale: 1 });
      await goto(p);

      let n = 0;
      // Home screen
      await frame(p, "demo-open", n++);
      await p.waitForTimeout(600);
      await frame(p, "demo-open", n++);

      // Load PDF
      await p.evaluate(async () => {
        await window.__TEST__.loadPdfFromUrl("/sample.pdf", "/tmp/sample.pdf");
      });
      await p.waitForFunction(
        () => window.__TEST__.usePdfStore.getState().numPages > 0,
        { timeout: 15_000 }
      );
      await p.waitForTimeout(800);
      await frame(p, "demo-open", n++);

      // Scroll down
      const viewer = p.locator(".pdf-viewer-scroll, [data-testid='pdf-viewer'], main, .viewer-scroll").first();
      for (let i = 0; i < 4; i++) {
        await p.evaluate(() => {
          const el = document.querySelector('[style*="overflow"]') || document.body;
          el.scrollTop += 300;
        });
        await p.waitForTimeout(400);
        await frame(p, "demo-open", n++);
      }

      await p.close();
      makeGif("demo-open", 2, 960);
    }

    // demo-annotate: add a text box annotation
    {
      const p = await newPage(browser, { scale: 1 });
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "thumbnails");

      let n = 0;
      // Base state – no annotations
      await frame(p, "demo-annotate", n++);

      // Add textbox annotation
      await p.evaluate(() => {
        window.__TEST__.useAnnotationStore.getState().addAnnotation({
          type: "textbox",
          pageIndex: 0,
          pdfRect: { x: 56, y: 590, width: 380, height: 60 },
          content: "",
          fontSize: 14,
          fontColor: "#1a1a2e",
          bgColor: "#fffde7",
          bold: false,
          italic: false,
          lang: "en",
        });
      });
      await p.waitForTimeout(400);
      await frame(p, "demo-annotate", n++);

      // Update text
      await p.evaluate(() => {
        const ann = window.__TEST__.useAnnotationStore.getState();
        const anns = ann.annotations.get(0) ?? [];
        const tb = anns.find((a) => a.type === "textbox");
        if (tb) ann.updateAnnotation(tb.id, { content: "This is a note." });
      });
      await p.waitForTimeout(300);
      await frame(p, "demo-annotate", n++);
      await p.waitForTimeout(300);
      await frame(p, "demo-annotate", n++);

      // Add highlight
      await p.evaluate(() => {
        window.__TEST__.useAnnotationStore.getState().addAnnotation({
          type: "highlight",
          pageIndex: 0,
          pdfRect: { x: 56, y: 735, width: 420, height: 16 },
          color: "#ffd600",
          rects: [{ x: 56, y: 735, width: 420, height: 16 }],
        });
      });
      await p.waitForTimeout(400);
      await frame(p, "demo-annotate", n++);
      await p.waitForTimeout(300);
      await frame(p, "demo-annotate", n++);

      await p.close();
      makeGif("demo-annotate", 2, 960);
    }

    // demo-tools: quick tour of dialogs
    {
      const p = await newPage(browser, { scale: 1 });
      await goto(p);
      await loadPdf(p);
      await setSidebarTab(p, "thumbnails");

      let n = 0;
      await frame(p, "demo-tools", n++);

      const dialogs = ["signature", "merge", "translate", "protect", "watermark", "settings"];
      for (const d of dialogs) {
        await openDialog(p, d);
        await frame(p, "demo-tools", n++);
        await frame(p, "demo-tools", n++);
        await closeDialog(p);
        await frame(p, "demo-tools", n++);
      }

      await p.close();
      makeGif("demo-tools", 3, 960);
    }

    console.log(`\n✅ Done! Screenshots saved to:\n   ${OUT}\n`);

  } finally {
    await browser.close();
    await stopVite();
    // Clean up frame temp files
    try {
      for (const f of readdirSync(FRAMES)) {
        rmSync(resolve(FRAMES, f));
      }
      rmSync(FRAMES, { recursive: true });
    } catch {}
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
