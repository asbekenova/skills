// Хелперы анимации для render(t). t в секундах, всё детерминировано (одинаковый кадр при повторном рендере).
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// Прогресс 0..1 на отрезке [start, start+dur]
export const prog = (t, start, dur) => clamp((t - start) / dur);
export const lerp = (a, b, p) => a + (b - a) * p;
export const easeOut = (p) => 1 - Math.pow(1 - p, 3);
export const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
// Пружинка с перелётом: «шлёп» карточки
export const backOut = (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
// Затухающая пружина, для покачивания после удара
export const spring = (p, freq = 3, damp = 5) => 1 - Math.exp(-damp * p) * Math.cos(freq * 2 * Math.PI * p);
// «Дышащая» линия rough.js: seed меняется N раз в секунду
export const boilSeed = (t, perSec = 8, base = 1) => base + Math.floor(t * perSec);
// Псевдослучайное по seed (для лёгкого дрожания стоп-моушна)
export const rand = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
// Стоп-моушн: квантует время до n кадров в секунду (12 даёт «ручной» вид)
export const stepTime = (t, fps = 12) => Math.floor(t * fps) / fps;
