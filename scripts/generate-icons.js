const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const png = new PNG({ width: size, height: size });
  // fill blue background (#3b82f6)
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0x3b;
    png.data[i + 1] = 0x82;
    png.data[i + 2] = 0xf6;
    png.data[i + 3] = 0xff;
  }
  // simple white shopping list icon in center
  const margin = Math.round(size * 0.2);
  const inner = size - margin * 2;
  const lineW = Math.round(size * 0.04);
  const r = Math.round(size * 0.05);
  // draw a rounded rectangle (clipboard shape)
  for (let y = margin; y < size - margin; y++) {
    for (let x = margin + Math.round(inner * 0.1); x < size - margin - Math.round(inner * 0.1); x++) {
      const dx = x - (margin + Math.round(inner * 0.1));
      const dy = y - margin;
      const w = inner - Math.round(inner * 0.2);
      const h = inner;
      if (dx >= 0 && dx < w && dy >= 0 && dy < h) {
        const corner = r;
        if ((dx < corner && dy < corner && Math.sqrt((corner - dx) ** 2 + (corner - dy) ** 2) > corner) ||
            (dx > w - corner && dy < corner && Math.sqrt((dx - (w - corner)) ** 2 + (corner - dy) ** 2) > corner) ||
            (dx < corner && dy > h - corner && Math.sqrt((corner - dx) ** 2 + (dy - (h - corner)) ** 2) > corner) ||
            (dx > w - corner && dy > h - corner && Math.sqrt((dx - (w - corner)) ** 2 + (dy - (h - corner)) ** 2) > corner)) {
          continue;
        }
        const idx = (y * size + x) * 4;
        png.data[idx] = 0xff;
        png.data[idx + 1] = 0xff;
        png.data[idx + 2] = 0xff;
        png.data[idx + 3] = 0xff;
      }
    }
  }
  // horizontal lines inside clipboard
  const lineY = [inner * 0.32, inner * 0.55, inner * 0.78];
  for (const ly of lineY) {
    const yy = margin + Math.round(ly);
    for (let x = margin + Math.round(inner * 0.2); x < size - margin - Math.round(inner * 0.15); x++) {
      for (let l = 0; l < lineW; l++) {
        if (yy + l < size) {
          const idx = ((yy + l) * size + x) * 4;
          png.data[idx] = 0xff;
          png.data[idx + 1] = 0xff;
          png.data[idx + 2] = 0xff;
          png.data[idx + 3] = 0xff;
        }
      }
    }
  }
  // checkmark on last line
  const cx = size - margin - Math.round(inner * 0.35);
  const cy = margin + Math.round(inner * 0.72);
  const checkSize = Math.round(inner * 0.12);
  for (let i = 0; i < checkSize; i++) {
    for (let j = 0; j < lineW; j++) {
      const idx = ((cy + i) * size + (cx - Math.round(i * 0.5) + j)) * 4;
      if (idx < png.data.length) {
        png.data[idx] = 0xff;
        png.data[idx + 1] = 0xff;
        png.data[idx + 2] = 0xff;
        png.data[idx + 3] = 0xff;
      }
    }
  }
  return PNG.sync.write(png);
}

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generateIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generateIcon(512));
console.log('icons generated');
