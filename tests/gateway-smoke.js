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
    const hubLogin = await fetch(`http://127.0.0.1:${port}/`);
    if (!hubLogin.ok || !(await hubLogin.text()).includes('TONA AI Hub')) throw new Error('Hub login route failed');
    const redirect = await fetch(`http://127.0.0.1:${port}/teamflow/`, { redirect: 'manual' });
    if (redirect.status !== 302 || redirect.headers.get('location') !== '/') throw new Error('Unauthenticated TeamFlow gate failed');
    const login = await fetch(`http://127.0.0.1:${port}/teamflow/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@team.local', password: 'test-password' }) });
    if (!login.ok) throw new Error(`TeamFlow login failed: ${login.status}`);
    const cookieHeader = login.headers.get('set-cookie') || '';
    if (!/Path=\//i.test(cookieHeader)) throw new Error(`Hub session cookie was not shared: ${cookieHeader}`);
    const cookie = cookieHeader.split(';')[0];
    const page = await fetch(`http://127.0.0.1:${port}/teamflow/`, { headers: { Cookie: cookie } });
    const html = await page.text();
    if (!page.ok || !html.includes('manifest.webmanifest') || !html.includes('pwa.js')) throw new Error('Authenticated TeamFlow page failed');
    const manifest = await (await fetch(`http://127.0.0.1:${port}/teamflow/manifest.webmanifest`, { headers: { Cookie: cookie } })).json();
    if (manifest.scope !== '.' || manifest.start_url !== '?source=pwa') throw new Error('PWA subpath manifest invalid');
    const me = await fetch(`http://127.0.0.1:${port}/teamflow/api/me`, { headers: { Cookie: cookie } });
    if (!me.ok || (await me.json()).user.role !== 'owner') throw new Error('TeamFlow authenticated proxy failed');
    const studioUnauthed = await fetch(`http://127.0.0.1:${port}/api/state`);
    if (studioUnauthed.status !== 401) throw new Error('AI Studio allowed an unauthenticated request');
    const studio = await fetch(`http://127.0.0.1:${port}/api/state`, { headers: { Cookie: cookie } });
    if (!studio.ok || !(await studio.json()).agents) throw new Error('AI Studio Hub authentication failed');
    if (!fs.existsSync(path.join(dataDir, 'workspaces', 'usr_owner', 'studio.json'))) throw new Error('AI Studio workspace data was not created');
    if (!fs.existsSync(path.join(dataDir, 'teamflow', 'teamflow.json'))) throw new Error('TeamFlow data was not isolated');
    console.log('Gateway test passed: Tona AI Hub session, TeamFlow subpath, AI Studio auth and separate workspace data');
  } finally {
    gateway.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 500));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
