#!/usr/bin/env node
// Рендер сцены PR_OS в mp4.
//   node kit/render.mjs <scene.html> [--out out.mp4] [--fps 30] [--preview] [--at 0.5,1.5,3]
// --preview снимает только ключевые кадры (PNG) для проверки: наложения, одинокие слова, безопасная зона.
// Требует: Playwright с Chromium (в облачной сессии уже стоит), ffmpeg, npm i в pr-os/kit.
import { createServer } from 'node:http';
import { readFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // папка pr-os
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const scene = args.find((a) => a.endsWith('.html'));
if (!scene) { console.error('Укажите сцену: node kit/render.mjs library/<папка>/scene.html'); process.exit(1); }

const sceneAbs = path.resolve(scene);
if (!sceneAbs.startsWith(ROOT + path.sep)) { console.error('Сцена должна лежать внутри pr-os/'); process.exit(1); }
const sceneUrlPath = '/' + path.relative(ROOT, sceneAbs).split(path.sep).join('/');
const fps = Number(opt('--fps', 30));
const preview = args.includes('--preview');
const outDir = path.dirname(sceneAbs);
const out = path.resolve(opt('--out', path.join(outDir, 'preview.mp4')));

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const server = createServer(async (req, res) => {
  try {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT)) throw new Error('outside');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('Ошибка в сцене:', e.message));
await page.goto(base + sceneUrlPath + (preview ? '?guides=1' : ''));
await page.waitForFunction(() => typeof window.render === 'function' && window.SCENE_READY);
await page.evaluate(() => window.SCENE_READY);
const duration = await page.evaluate(() => window.DURATION || 4);
const stage = page.locator('#stage');

try {
  if (preview) {
    const at = (opt('--at') || [0.15, 0.4, 0.7, 0.98].map((k) => (k * duration).toFixed(2)).join(',')).split(',').map(Number);
    const dir = path.join(outDir, 'keyframes');
    await mkdir(dir, { recursive: true });
    for (const t of at) {
      await page.evaluate((tt) => window.render(tt), t);
      const f = path.join(dir, `t${t.toFixed(2)}.png`);
      await stage.screenshot({ path: f });
      console.log('кадр', f);
    }
  } else {
    const frames = path.join(outDir, '.frames');
    await rm(frames, { recursive: true, force: true });
    await mkdir(frames, { recursive: true });
    const n = Math.round(duration * fps);
    for (let i = 0; i < n; i++) {
      await page.evaluate((tt) => window.render(tt), i / fps);
      await stage.screenshot({ path: path.join(frames, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(frames, 'f%05d.jpg'),
      '-c:v', 'libx264', '-crf', '18', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
    await rm(frames, { recursive: true, force: true });
    const { size } = await stat(out);
    console.log(`готово: ${out} · ${n} кадров · ${(size / 1e6).toFixed(1)} МБ`);
  }
} finally {
  await browser.close();
  server.close();
}
