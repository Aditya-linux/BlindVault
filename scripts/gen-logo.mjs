import sharp from "sharp";
import fs from "node:fs";

/**
 * Source is 1536×1024 landscape on a black plate — that caused circular
 * letterbox bars in the browser tab. Crop square, flood-clear background
 * black only (keep blindfold), emit transparent mark + filled navy disc icons.
 */
const SRC =
  "C:/Users/Aditya/OneDrive/Desktop/images/Blindfolded Red Octopus Mascot.png";

const meta = await sharp(SRC).metadata();
const side = Math.min(meta.width, meta.height);
const left = Math.floor((meta.width - side) / 2);
const top = Math.floor((meta.height - side) / 2);

const { data, info } = await sharp(SRC)
  .extract({ left, top, width: side, height: side })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const w = info.width;
const h = info.height;
const isBg = (i) => {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  return r < 28 && g < 28 && b < 28 && data[i + 3] > 0;
};

const seen = new Uint8Array(w * h);
const stack = [];
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const idx = y * w + x;
  if (seen[idx]) return;
  const i = idx * 4;
  if (!isBg(i)) return;
  seen[idx] = 1;
  stack.push(idx);
};

for (let x = 0; x < w; x++) {
  push(x, 0);
  push(x, h - 1);
}
for (let y = 0; y < h; y++) {
  push(0, y);
  push(w - 1, y);
}

while (stack.length) {
  const idx = stack.pop();
  data[idx * 4 + 3] = 0;
  const x = idx % w;
  const y = (idx / w) | 0;
  push(x + 1, y);
  push(x - 1, y);
  push(x, y + 1);
  push(x, y - 1);
}

const clearedPng = await sharp(data, {
  raw: { width: w, height: h, channels: 4 },
})
  .trim({ threshold: 4 })
  .png()
  .toBuffer();

async function writeTransparent(size, out) {
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(clearedPng)
          .resize(Math.round(size * 0.88), Math.round(size * 0.88), {
            fit: "inside",
            kernel: "lanczos3",
          })
          .png()
          .toBuffer(),
        gravity: "centre",
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("OK", out);
}

/** Solid navy disc with octopus — no letterbox bars in browser tabs. */
async function writeDisc(size, out) {
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;
  const mark = await sharp(clearedPng)
    .resize(inner, inner, { fit: "inside", kernel: "lanczos3" })
    .png()
    .toBuffer();
  const circle = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#071428"/>
    </svg>`,
  );
  await sharp(circle)
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(out);
  console.log("OK disc", out);
}

fs.mkdirSync("app/public/brand", { recursive: true });
fs.mkdirSync("docs/assets", { recursive: true });

await writeTransparent(512, "app/public/brand/logo.png");
await writeTransparent(192, "app/public/brand/logo-192.png");
await writeTransparent(512, "app/public/brand/logo-512.png");
await writeTransparent(512, "docs/assets/logo.png");
await writeDisc(180, "app/public/brand/logo-mark.png");
await writeDisc(64, "app/public/favicon-32.png");
await writeDisc(180, "app/public/apple-touch-icon.png");
await writeDisc(48, "app/src/app/icon.png");
await writeDisc(180, "app/src/app/apple-icon.png");

console.log("done");
