// Ícones SVG dos 15 níveis (traço escuro, telhado de telha, persianas verdes).
const S = 'stroke="#152033" stroke-width="2.6" stroke-linejoin="round"';
const MURO = '#FBF3E2', TETTO = '#E2703F', VERDE = '#3E8E4E', PORTA = '#7A4B2A', ORO = '#F2C230', VETRO = '#7FB7D9', PIETRA = '#E2D3B5';
const r = (x, y, w, h, f = MURO) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${S}/>`;
const p = (pts, f = TETTO) => `<polygon points="${pts}" fill="${f}" ${S}/>`;
const fin = (x, y, w = 6, h = 6, f = VERDE) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" stroke="#152033" stroke-width="1.8"/>`;
const porta = (x, y, w = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${56 - y}" fill="${PORTA}" stroke="#152033" stroke-width="1.8"/>`;
const albero = (x, f = '#5CB64E') => `<rect x="${x - 1.5}" y="42" width="3" height="14" fill="${PORTA}" stroke="#152033" stroke-width="1.8"/><circle cx="${x}" cy="38" r="8" fill="${f}" ${S}/>`;
const cipresso = x => `<rect x="${x - 1.2}" y="48" width="2.4" height="8" fill="${PORTA}"/><ellipse cx="${x}" cy="36" rx="5" ry="13" fill="#2F6B3A" ${S}/>`;
const chao = '<line x1="2" y1="56" x2="62" y2="56" stroke="#152033" stroke-width="3" stroke-linecap="round"/>';

const ICONE = [
  () => r(24, 38, 16, 18) + p('21,39 32,28 43,39') + porta(29.5, 47, 5),
  () => r(17, 32, 30, 24) + p('13,33 32,18 51,33') + porta(29, 43) + fin(21, 37) + fin(37, 37),
  () => r(8, 32, 28, 24) + p('4,33 22,19 40,33') + porta(19, 44) + fin(11, 37) + fin(27, 37) + albero(50) + '<path d="M38 50 H62 M42 46 V56 M50 46 V56 M58 46 V56" stroke="#152033" stroke-width="2"/>',
  () => r(18, 24, 28, 32) + p('14,25 32,11 50,25') + porta(29, 45) + fin(21, 29) + fin(37, 29) + fin(21, 39) + fin(37, 39),
  () => r(8, 24, 26, 32) + p('4,25 21,12 38,25') + porta(18, 45) + fin(11, 29) + fin(25, 29) + fin(11, 39) + r(36, 38, 22, 18, '#C9CED6') + '<path d="M38 43 H56 M38 48 H56 M38 53 H56" stroke="#152033" stroke-width="1.6"/>',
  () => r(22, 32, 34, 24, PIETRA) + p('18,33 39,19 60,33') + r(6, 18, 14, 38, PIETRA) + p('4,19 13,9 22,19') + porta(36, 44) + fin(26, 38) + fin(46, 38) + fin(10, 26),
  () => r(10, 24, 26, 32) + p('6,25 23,12 40,25') + porta(20, 45) + fin(13, 29) + fin(27, 29) + fin(13, 39) + r(38, 48, 22, 8, VETRO),
  () => r(6, 22, 52, 34) + p('2,23 32,10 62,23') + '<line x1="6" y1="38" x2="58" y2="38" stroke="#152033" stroke-width="2.2"/>' + porta(29, 45) + fin(11, 27) + fin(23, 27) + fin(35, 27) + fin(47, 27) + fin(11, 43) + fin(47, 43),
  () => r(6, 22, 30, 34) + p('2,23 21,10 40,23') + r(34, 34, 22, 22) + p('31,35 45,25 59,35') + porta(18, 45) + fin(10, 27) + fin(26, 27) + fin(10, 39) + fin(41, 40) + cipresso(60),
  () => r(10, 14, 40, 42) + p('6,15 30,3 54,15') + fin(15, 19) + fin(27, 19) + fin(39, 19) + fin(15, 30) + fin(39, 30) + '<path d="M16 42 V56 M24 42 V56 M36 42 V56 M44 42 V56" stroke="#152033" stroke-width="2.4"/><line x1="12" y1="41" x2="48" y2="41" stroke="#152033" stroke-width="2.4"/>' + cipresso(6) + cipresso(58),
  () => r(22, 8, 18, 48, PIETRA) + '<path d="M22 8 v-4 h4 v4 M29 8 v-4 h4 v4 M36 8 v-4 h4 v4" fill="none" stroke="#152033" stroke-width="2.2"/>' + fin(29, 16, 4, 7, '#3A3F4A') + fin(29, 30, 4, 7, '#3A3F4A') + r(40, 38, 16, 18) + p('38,39 48,31 58,39'),
  () => r(20, 6, 24, 50, VETRO) + '<path d="M20 14 H44 M20 22 H44 M20 30 H44 M20 38 H44 M20 46 H44" stroke="#FFFFFF" stroke-width="2.4"/><rect x="20" y="6" width="24" height="50" fill="none" ' + S + '/><line x1="32" y1="6" x2="32" y2="0" stroke="#152033" stroke-width="2"/>',
  () => '<path d="M4 56 V40 H60 V56" fill="#FFFFFF" ' + S + '/>' + r(10, 26, 26, 30, '#FFFFFF') + r(38, 18, 12, 38, '#FFFFFF') + '<path d="M38 18 A6 6 0 0 1 50 18 Z" fill="#FFFFFF" ' + S + '/>' + porta(20, 44) + albero(56, '#8FA36A'),
  () => r(6, 26, 52, 30, '#F2C98A') + '<rect x="4" y="24" width="56" height="4" fill="#FFFFFF" ' + S + '/>' + '<path d="M22 24 V18 H42 V24" fill="#F2C98A" ' + S + '/><path d="M22 18 A10 10 0 0 1 42 18 Z" fill="' + TETTO + '" ' + S + '/>' + '<path d="M18 40 V56 M26 40 V56 M38 40 V56 M46 40 V56" stroke="#152033" stroke-width="2.4"/>' + fin(10, 31) + fin(48, 31),
  () => r(22, 14, 20, 42, ORO) + '<path d="M18 14 L22 4 L27 11 L32 2 L37 11 L42 4 L46 14 Z" fill="' + ORO + '" ' + S + '/><circle cx="32" cy="9" r="2.5" fill="#E0473C"/>' + '<path d="M22 24 H42 M22 34 H42 M22 44 H42" stroke="#152033" stroke-width="1.8"/>',
];

export const iconaLivello = n => `<svg viewBox="0 0 64 64" aria-hidden="true">${(ICONE[n] ?? ICONE[0])()}${chao}</svg>`;
