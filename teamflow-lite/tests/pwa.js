const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const port = 17365;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-pwa-'));
const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, INITIAL_ADMIN_PASSWORD: 'test-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
async function ready() { for (let i = 0; i < 30; i += 1) { try { const response = await fetch(`http://127.0.0.1:${port}/api/health`); if (response.ok) return; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('server timeout'); }
(async () => {
  try {
    await ready();
    const manifestResponse = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
    if (!manifestResponse.headers.get('content-type').includes('application/manifest+json')) throw new Error('manifest MIME type invalid');
    const manifest = await manifestResponse.json();
    if (manifest.display !== 'standalone' || !manifest.icons.some(icon => icon.sizes === '512x512')) throw new Error('manifest is not installable');
    const required = ['/sw.js','/offline.html','/pwa.js','/pwa.css','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png'];
    for (const asset of required) { const response = await fetch(`http://127.0.0.1:${port}${asset}`); if (!response.ok || !(await response.arrayBuffer()).byteLength) throw new Error(`missing PWA asset ${asset}`); }
    const index = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    if (!index.includes('manifest.webmanifest') || !index.includes('apple-touch-icon') || !index.includes('pwa.js')) throw new Error('PWA metadata not connected');
    const worker = await (await fetch(`http://127.0.0.1:${port}/sw.js`)).text();
    if (!worker.includes("self.addEventListener('push'") || !worker.includes("self.addEventListener('fetch'")) throw new Error('service worker capabilities missing');
    console.log('PWA test passed: install manifest, app icons, offline shell, service worker, push hooks');
  } finally { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
