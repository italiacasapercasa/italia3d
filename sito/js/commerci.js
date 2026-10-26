// Comércios no mapa: tipos de negócio, planos por tamanho de cidade e links (usado pelo site e por negozio.html).
export const TIPI = [
  ['pizzeria', '🍕', 'Pizzeria'],
  ['ristorante', '🍝', 'Ristorante / trattoria'],
  ['bar', '☕', 'Bar / caffetteria'],
  ['gelateria', '🍦', 'Gelateria / pasticceria'],
  ['alimentari', '🥖', 'Panificio / alimentari'],
  ['abbigliamento', '👕', 'Abbigliamento / scarpe'],
  ['parrucchiere', '💈', 'Parrucchiere / barbiere'],
  ['estetica', '💅', 'Estetica / benessere'],
  ['palestra', '🏋️', 'Palestra / sport'],
  ['fiori', '💐', 'Fiorista / regali'],
  ['servizi', '🧰', 'Servizi / professionisti'],
  ['altro', '🏪', 'Altro'],
];
export const tipoDi = k => TIPI.find(t => t[0] === k) ?? TIPI[TIPI.length - 1];

export const PRODOTTI = {
  negozio: { nome: 'Negozio in città', emoji: '🏪', descr: 'Un negozio 3D con il tuo nome, il tuo colore e il tuo logo, in città. Con un tocco i clienti ti scrivono su WhatsApp.' },
  cartellone: { nome: 'Cartellone pubblicitario', emoji: '📣', descr: 'Un cartellone gigante con il tuo nome, il tuo messaggio e il tuo logo, in città. Con un tocco i clienti ti scrivono su WhatsApp.' },
};

// plano pela população do comune (config em data/negozio.json)
export function pianoDi(cfg, pop) {
  return cfg.piani.find(p => pop >= p.da) ?? cfg.piani[cfg.piani.length - 1];
}
export const euro = c => (c / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

// WhatsApp: só dígitos; número italiano sem código ganha +39
export function linkWhatsapp(n, testo) {
  let d = String(n ?? '').replace(/\D/g, '');
  if (!/[1-9]/.test(d) || /^(\d)\1+$/.test(d)) return null;   // vazio ou falso (00000000000): sem botão
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.length <= 10) d = `39${d}`;   // 11+ dígitos: já vem com o código do país
  return `https://wa.me/${d}${testo ? `?text=${encodeURIComponent(testo)}` : ''}`;
}
