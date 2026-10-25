// Projeção usada em todo o projeto: equiretangular centrada na Itália, em km.
// x cresce para leste, z cresce para sul (norte = -z, como no three.js visto de cima).
export const PROJ = { LON0: 12.5, LAT0: 42.0, KX: 111.32 * Math.cos(42 * Math.PI / 180), KZ: 110.57 };
export const BBOX = { x0: -496, x1: 506, z0: -570, z1: 730 };
export const proj = (lon, lat) => [(lon - PROJ.LON0) * PROJ.KX, (PROJ.LAT0 - lat) * PROJ.KZ];
export const desproj = (x, z) => [x / PROJ.KX + PROJ.LON0, PROJ.LAT0 - z / PROJ.KZ];
