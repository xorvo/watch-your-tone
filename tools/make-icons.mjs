// Rasterize tools/icon.svg into the extension PNG icons at crisp, exact sizes.
// Uses @resvg/resvg-js (real SVG renderer with anti-aliasing).
//
// Setup:  cd tools && npm install
// Run:    node tools/make-icons.mjs   (from repo root, after install)

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(__dirname, "icon.svg"), "utf8");
const OUT = join(__dirname, "..", "icons");
mkdirSync(OUT, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  const png = resvg.render().asPng();
  writeFileSync(join(OUT, `icon${size}.png`), png);
  console.log(`wrote icons/icon${size}.png (${png.length} bytes)`);
}
