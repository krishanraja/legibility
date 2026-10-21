/**
 * Generate the favicon set and the social cards from one definition of the mark.
 *
 * The previous public/favicon.png and apple-touch-icon.png were the same 2000x2000 file
 * (52 KB served for a 16 pixel tab icon), and public/og.png still carried the dead "plinth"
 * wordmark and the dead onplinth.io host. Both are generated here instead, so the mark is
 * drawn once and every size is derived from it.
 *
 * The mark is the brand icon in src/assets/legibility-icon-and-favicon.png (three bars on a
 * base), redrawn on a 32 unit grid. The bars are thickened relative to the 2000 pixel
 * original so they survive at 16 pixels, where the original proportions render as a blur.
 *
 * Rendering needs a Chromium binary, so this is a maintenance script, not a build or CI step.
 * The outputs are committed. Re-run only when the mark or a card changes:
 *
 *   CHROME=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
 *   FONT_CSS=/path/to/local-google-fonts.css \
 *   bun scripts/build-brand-assets.ts
 *
 * Use the headless shell rather than full Chromium: full Chromium in headless mode reserves
 * part of the window for browser chrome, so a 16x16 screenshot comes back clipped.
 *
 * FONT_CSS is optional: a stylesheet with @font-face rules for Instrument Serif and JetBrains
 * Mono pointing at local files, so the render needs no network. Without it the cards fall
 * back to the system serif and monospace.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const PUBLIC = resolve(ROOT, "public");

export const NAVY = "#0E1B2C";
export const CREAM = "#F4EFE6";
export const SIGNAL = "#C2532A";

/** The glyph on a 32 unit grid: three bars, the middle one tallest, on a base. */
function glyph(fill: string): string {
  return [
    `<rect x="8.75" y="9.5" width="3.5" height="13.5" rx="1.75" fill="${fill}"/>`,
    `<rect x="14.25" y="5" width="3.5" height="18" rx="1.75" fill="${fill}"/>`,
    `<rect x="19.75" y="9.5" width="3.5" height="13.5" rx="1.75" fill="${fill}"/>`,
    `<rect x="7.5" y="24.5" width="17" height="2.5" rx="1.25" fill="${fill}"/>`,
  ].join("");
}

/**
 * The mark as an SVG.
 *  - "tab": rounded square, for browser tabs (favicon.svg, ico, 16/32 png).
 *  - "full": full-bleed square, for apple-touch and manifest "any" icons (the OS rounds it).
 *  - "maskable": full-bleed with the glyph inside the central safe zone (80 percent).
 */
export function markSvg(kind: "tab" | "full" | "maskable"): string {
  const bg =
    kind === "tab"
      ? `<rect width="32" height="32" rx="7" fill="${NAVY}"/>`
      : `<rect width="32" height="32" fill="${NAVY}"/>`;
  const inner =
    kind === "maskable"
      ? `<g transform="translate(16 16) scale(0.72) translate(-16 -16)">${glyph(CREAM)}</g>`
      : kind === "full"
        ? `<g transform="translate(16 16) scale(0.86) translate(-16 -16)">${glyph(CREAM)}</g>`
        : glyph(CREAM);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${bg}${inner}</svg>\n`;
}

/** An ICO container holding PNG payloads (supported by every current browser). */
export function icoFromPngs(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach((p, i) => {
    const o = i * 16;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, o);
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(p.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += p.data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

type Card = {
  file: string;
  eyebrow: string;
  headline: string;
  italic: string;
  body: string;
  chips: string[];
};

const CARDS: Card[] = [
  {
    file: "og.png",
    eyebrow: "Machine readability, measured",
    headline: "Can a machine",
    italic: "read your website?",
    body: "Legibility shows what an AI crawler sees, and records why when it cannot read a page. The same engine is an API that agents call over REST and MCP.",
    chips: ["REST + MCP", "pay per call over x402"],
  },
  {
    file: "og-answers.png",
    eyebrow: "Answers",
    headline: "Straight answers",
    italic: "for agent builders.",
    body: "How agents discover tools over MCP, pay per call in USDC with x402, and read typed product data with a calibrated confidence.",
    chips: ["MCP", "x402", "typed product data"],
  },
];

function cardHtml(c: Card, fontCss: string): string {
  const mark = markSvg("tab").replace("<svg ", '<svg width="64" height="64" ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;background:${CREAM};color:${NAVY}}
body{padding:58px 72px 54px;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif;position:relative}
body::before{content:"";position:absolute;inset:24px;border:1px solid #D9D0C1;border-radius:6px}
.top{display:flex;align-items:center;gap:20px}
.word{font-family:"Instrument Serif",Georgia,serif;font-size:52px;letter-spacing:-0.5px}
.eyebrow{margin-top:34px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:20px;letter-spacing:5px;text-transform:uppercase;color:${SIGNAL}}
h1{margin-top:14px;font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:84px;line-height:0.98;letter-spacing:-1.5px}
h1 em{display:block;color:#5B6676}
p{margin-top:20px;max-width:900px;font-size:23px;line-height:1.4;color:#3A4757}
.foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between}
.host{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:22px;color:#3A4757}
.chips{display:flex;gap:12px}
.chip{background:${NAVY};color:${CREAM};font-family:"JetBrains Mono",ui-monospace,monospace;font-size:19px;padding:10px 18px;border-radius:6px}
</style></head><body>
<div class="top">${mark}<span class="word">Legibility</span></div>
<div class="eyebrow">${c.eyebrow}</div>
<h1>${c.headline}<em>${c.italic}</em></h1>
<p>${c.body}</p>
<div class="foot"><span class="host">legibility.io</span><span class="chips">${c.chips
    .map((t) => `<span class="chip">${t}</span>`)
    .join("")}</span></div>
</body></html>`;
}

function main() {
  const chrome = process.env.CHROME;
  if (!chrome || !existsSync(chrome)) {
    console.error(
      "Set CHROME to a Chromium binary, for example /opt/pw-browsers/.../headless_shell",
    );
    process.exit(1);
  }
  const fontCss = process.env.FONT_CSS ? readFileSync(process.env.FONT_CSS, "utf8") : "";
  const fontBase = process.env.FONT_CSS ? resolve(process.env.FONT_CSS, "..") : "";
  const work = mkdtempSync(join(tmpdir(), "brand-"));

  const shoot = (html: string, w: number, h: number, out: string, transparent: boolean) => {
    const page = join(fontBase || work, `render-${w}x${h}-${Date.now()}.html`);
    writeFileSync(page, html);
    execFileSync(chrome, [
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      ...(transparent ? ["--default-background-color=00000000"] : []),
      `--window-size=${w},${h}`,
      `--screenshot=${out}`,
      `file://${page}`,
    ]);
    return readFileSync(out);
  };

  const svgPage = (svg: string, size: number) =>
    `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style></head><body>${svg}</body></html>`;

  // Tab icons.
  writeFileSync(resolve(PUBLIC, "favicon.svg"), markSvg("tab"));
  const tab = (size: number) =>
    shoot(svgPage(markSvg("tab"), size), size, size, join(work, `tab-${size}.png`), true);
  const p16 = tab(16);
  const p32 = tab(32);
  const p48 = tab(48);
  writeFileSync(resolve(PUBLIC, "favicon-16x16.png"), p16);
  writeFileSync(resolve(PUBLIC, "favicon-32x32.png"), p32);
  writeFileSync(resolve(PUBLIC, "favicon.png"), p32);
  writeFileSync(
    resolve(PUBLIC, "favicon.ico"),
    icoFromPngs([
      { size: 16, data: p16 },
      { size: 32, data: p32 },
      { size: 48, data: p48 },
    ]),
  );

  // Home-screen and manifest icons.
  const full = (size: number, kind: "full" | "maskable", name: string) =>
    writeFileSync(
      resolve(PUBLIC, name),
      shoot(svgPage(markSvg(kind), size), size, size, join(work, name), false),
    );
  full(180, "full", "apple-touch-icon.png");
  full(192, "full", "icon-192.png");
  full(512, "full", "icon-512.png");
  full(512, "maskable", "icon-maskable-512.png");

  // Social cards, 1200x630.
  for (const c of CARDS) {
    writeFileSync(
      resolve(PUBLIC, c.file),
      shoot(cardHtml(c, fontCss), 1200, 630, join(work, c.file), false),
    );
  }
  console.log("Wrote favicon set, manifest icons and social cards to public/.");
}

if (import.meta.main) main();
