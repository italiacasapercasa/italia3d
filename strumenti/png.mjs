// Leitor/gravador de PNG mínimo (8 bits, RGB/RGBA), sem dependências.
import fs from 'node:fs';
import zlib from 'node:zlib';

export function lerPNG(buf) {
  let p = 8, w, h, ct, bd;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), tipo = buf.toString('ascii', p + 4, p + 8), dados = buf.subarray(p + 8, p + 8 + len);
    if (tipo === 'IHDR') { w = dados.readUInt32BE(0); h = dados.readUInt32BE(4); bd = dados[8]; ct = dados[9]; }
    else if (tipo === 'IDAT') idat.push(dados);
    else if (tipo === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`PNG não suportado (tipo ${ct}, ${bd} bits)`);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], lin = y * (stride + 1) + 1, o = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[o + i - bpp] : 0, b = y > 0 ? out[o - stride + i] : 0, c = i >= bpp && y > 0 ? out[o - stride + i - bpp] : 0;
      let v = raw[lin + i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[o + i] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function bloco(tipo, dados) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  len.writeUInt32BE(dados.length); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function gravarPNG(arq, w, h, rgb) {
  const stride = w * 3, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    const o = y * stride, d = y * (stride + 1);
    raw[d] = 4; // Paeth
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? rgb[o + i - 3] : 0, b = y > 0 ? rgb[o - stride + i] : 0, c = i >= 3 && y > 0 ? rgb[o - stride + i - 3] : 0;
      const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
      raw[d + 1 + i] = (rgb[o + i] - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(arq, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(raw, { level: 9 })), bloco('IEND', Buffer.alloc(0)),
  ]));
}
