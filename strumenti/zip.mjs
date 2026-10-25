// Gravador de ZIP mínimo (deflate), com caminhos em "/" para extrair certo no Linux da hospedagem.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

// arquivos: [{ nome: 'pasta/arquivo.ext', dados: Buffer }]
export function criarZip(arq, arquivos) {
  const partes = [], central = [];
  let pos = 0;
  const agora = new Date(), hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  for (const { nome, dados } of arquivos) {
    const n = Buffer.from(nome, 'utf8'), comp = zlib.deflateRawSync(dados, { level: 9 }), crc = crc32(dados);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(8, 8);
    loc.writeUInt16LE(hora, 10); loc.writeUInt16LE(data, 12); loc.writeUInt32LE(crc, 14);
    loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(dados.length, 22); loc.writeUInt16LE(n.length, 26);
    partes.push(loc, n, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(0x031e, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(hora, 12); cen.writeUInt16LE(data, 14); cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(dados.length, 24); cen.writeUInt16LE(n.length, 28);
    cen.writeUInt32LE((0o100644 << 16) >>> 0, 38); cen.writeUInt32LE(pos, 42);
    central.push(cen, n);
    pos += loc.length + n.length + comp.length;
  }
  const cd = Buffer.concat(central), fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(pos, 16);
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, Buffer.concat([...partes, cd, fim]));
}

export function listarPasta(raiz, prefixo = '', ignorar = () => false) {
  const out = [];
  for (const e of fs.readdirSync(raiz, { withFileTypes: true })) {
    const rel = prefixo ? `${prefixo}/${e.name}` : e.name;
    if (ignorar(rel)) continue;
    if (e.isDirectory()) out.push(...listarPasta(path.join(raiz, e.name), rel, ignorar));
    else out.push({ nome: rel, dados: fs.readFileSync(path.join(raiz, e.name)) });
  }
  return out;
}
