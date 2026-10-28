import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every hard-coded copy of a brand colour must equal the sRGB render of its oklch token.
 *
 * The tokens in src/styles.css are the source. Hex copies live where CSS variables cannot
 * reach: the favicon, the web manifest, the theme-color meta, the generated icons and social
 * cards, the auth email templates, and the comments beside the tokens. Those copies had drifted
 * to approximations
 * (#0E1B2C for a navy that renders #071725), so a colour taken from any of them was wrong.
 * A token change now fails here until every copy follows it.
 */

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

/** oklch to an sRGB hex string, by the OKLab matrices, clipped to gamut. */
function oklchToHex(l: number, c: number, h: number): string {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return (
    "#" +
    linear
      .map((v) => {
        const x = Math.min(Math.max(v, 0), 1);
        const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
        return Math.round(srgb * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
      .toUpperCase()
  );
}

const css = read("src/styles.css");
const rootBlock = /:root\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? "";
const TOKEN_LINE = /--([\w-]+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\);(?:\s*\/\*([^*]*)\*\/)?/g;
const tokens = [...rootBlock.matchAll(TOKEN_LINE)].map(([, name, l, c, h, comment]) => ({
  name,
  hex: oklchToHex(Number(l), Number(c), Number(h)),
  comment,
}));
const render = (name: string) => {
  const t = tokens.find((x) => x.name === name);
  if (!t) throw new Error(`no oklch token --${name} in :root`);
  return t.hex;
};

describe("brand colour copies", () => {
  it("converts oklch the way the browser renders it", () => {
    expect(oklchToHex(0.95, 0.013, 75)).toBe("#F4EDE5");
    expect(oklchToHex(0.2, 0.035, 245)).toBe("#071725");
  });

  it("finds the light tokens", () => {
    expect(tokens.map((t) => t.name)).toEqual(
      expect.arrayContaining(["background", "foreground", "signal", "hairline", "stone"]),
    );
  });

  it("gives each token's render in the hex comments beside the tokens", () => {
    const commented = tokens.filter((t) => /#[0-9A-Fa-f]{6}/.test(t.comment ?? ""));
    expect(commented.length).toBeGreaterThan(0);
    for (const t of commented) {
      expect(/#[0-9A-Fa-f]{6}/.exec(t.comment!)![0].toUpperCase(), `--${t.name}`).toBe(t.hex);
    }
  });

  it("draws the generated icons and social cards in the token colours", () => {
    const script = read("scripts/build-brand-assets.ts");
    const constants = [
      ...script.matchAll(/export const \w+ = "(#[0-9A-Fa-f]{6})"; \/\/ ([\w-]+)/g),
    ];
    expect(constants.length).toBeGreaterThanOrEqual(3);
    for (const [, hex, token] of constants) expect(hex.toUpperCase(), token).toBe(render(token));
  });

  it("colours the favicon with foreground and background only", () => {
    const fills = new Set(
      [...read("public/favicon.svg").matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) =>
        m[1].toUpperCase(),
      ),
    );
    expect(fills).toEqual(new Set([render("foreground"), render("background")]));
  });

  it("sets the manifest and theme-color from the tokens", () => {
    const manifest = JSON.parse(read("public/site.webmanifest"));
    expect(manifest.background_color.toUpperCase()).toBe(render("background"));
    expect(manifest.theme_color.toUpperCase()).toBe(render("foreground"));
    const meta = /name: "theme-color", content: "(#[0-9A-Fa-f]{6})"/.exec(
      read("src/routes/__root.tsx"),
    );
    expect(meta?.[1].toUpperCase()).toBe(render("background"));
  });

  it("colours the auth emails with token renders only", () => {
    const allowed = new Set(
      ["background", "foreground", "muted-foreground", "signal", "hairline"].map(render),
    );
    const dir = resolve(ROOT, "supabase/templates");
    const templates = readdirSync(dir).filter((f) => f.endsWith(".html"));
    expect(templates.length).toBe(4);
    for (const file of templates) {
      const hexes = [...read(`supabase/templates/${file}`).matchAll(/#[0-9A-Fa-f]{6}/g)];
      expect(hexes.length, file).toBeGreaterThan(0);
      for (const [hex] of hexes)
        expect(allowed.has(hex.toUpperCase()), `${file} ${hex}`).toBe(true);
    }
  });
});
