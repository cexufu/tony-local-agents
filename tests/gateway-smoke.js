const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 17400;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tona-teamflow-gateway-'));
const gateway = spawn(process.execPath, ['gateway.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, NODE_ENV: 'development', PORT: String(port), DATA_DIR: dataDir, TEAMFLOW_DATA_DIR: path.join(dataDir, 'teamflow'), TEAMFLOW_INITIAL_ADMIN_PASSWORD: 'test-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
gateway.stdout.on('data', chunk => logs += chunk);
gateway.stderr.on('data', chunk => logs += chunk);

async function waitForHealth() {
  for (let i = 0; i < 60; i += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/gateway/health`); if (response.ok) return response.json(); } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`gateway did not become healthy\n${logs}`);
}

(async () => {
  try {
    const health = await waitForHealth();
    if (!health.tona || !health.teamflow) throw new Error('child health missing');
    const tona = await fetch(`http://127.0.0.1:${port}/`);
    if (!tona.ok || !(await tona.text()).includes('TONA')) throw new Error('TONA root route failed');
    const redirect = await fetch(`http://127.0.0.1:${port}/teamflow`, { redirect: 'manual' });
    if (redirect.status !== 308 || redirect.headers.get('location') !== '/teamflow/') throw new Error('TeamFlow slash redirect failed');
    const page = await fetch(`http://127.0.0.1:${port}/teamflow/`);
    const html = await page.text();
    if (!page.ok || !html.includes('manifest.webmanifest') || !html.includes('pwa.js')) throw new Error('TeamFlow page failed');
    const manifest = await (await fetch(`http://127.0.0.1:${port}/teamflow/manifest.webmanifest`)).json();
    if (manifest.scope !== '.' || manifest.start_url !== '?source=pwa') throw new Error('PWA subpath manifest invalid');
    const login = await fetch(`http://127.0.0.1:${port}/teamflow/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@team.local', password: 'test-password' }) });
    if (!login.ok) throw new Error(`TeamFlow login failed: ${login.status}`);
    const cookieHeader = login.headers.get('set-cookie') || '';
    if (!/Path=\/teamflow\//i.test(cookieHeader)) throw new Error(`cookie path was not isolated: ${cookieHeader}`);
    const cookie = cookieHeader.split(';')[0];
    const me = await fetch(`http://127.0.0.1:${port}/teamflow/api/me`, { headers: { Cookie: cookie } });
    if (!me.ok || (await me.json()).user.role !== 'owner') throw new Error('TeamFlow authenticated proxy failed');
    if (!fs.existsSync(path.join(dataDir, 'studio.json'))) throw new Error('TONA data was not stored in original data root');
    if (!fs.existsSync(path.join(dataDir, 'teamflow', 'teamflow.json'))) throw new Error('TeamFlow data was not isolated');
    console.log('Gateway test passed: TONA root, TeamFlow subpath, isolated cookie, auth, PWA and separate data');
  } finally {
    gateway.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 500));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
