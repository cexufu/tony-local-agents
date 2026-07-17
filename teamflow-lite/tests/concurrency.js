const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const port = 17364;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-concurrency-'));
const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, INITIAL_ADMIN_PASSWORD: 'test-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
function client() { let cookie = ''; return async (url, options = {}) => { const response = await fetch(`http://127.0.0.1:${port}${url}`, { ...options, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } }); if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]; const body = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`); return body; }; }
async function ready(request) { for (let i = 0; i < 30; i += 1) { try { await request('/api/health'); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } } throw new Error('server timeout'); }
(async () => {
  const owner = client();
  try {
    await ready(owner); await owner('/api/login', { method: 'POST', body: JSON.stringify({ email: 'admin@team.local', password: 'test-password' }) });
    for (let i = 1; i <= 3; i += 1) await owner('/api/users', { method: 'POST', body: JSON.stringify({ name: `Concurrent ${i}`, email: `concurrent${i}@example.com`, role: 'admin', password: 'quality123' }) });
    const clients = [owner, client(), client(), client()];
    await Promise.all(clients.slice(1).map((request, i) => request('/api/login', { method: 'POST', body: JSON.stringify({ email: `concurrent${i + 1}@example.com`, password: 'quality123' }) })));
    const writes = clients.flatMap((request, userIndex) => Array.from({ length: 10 }, (_, itemIndex) => request('/api/requirements', { method: 'POST', body: JSON.stringify({ title: `Concurrent requirement ${userIndex}-${itemIndex}`, summary: 'Concurrent persistence test', priority: 'P2', type: 'feature' }) })));
    await Promise.all(writes);
    const result = await owner('/api/requirements');
    const count = result.requirements.filter(item => item.title.startsWith('Concurrent requirement')).length;
    if (count !== 40) throw new Error(`expected 40 concurrent writes, found ${count}`);
    JSON.parse(fs.readFileSync(path.join(dataDir, 'teamflow.json'), 'utf8'));
    console.log('Concurrency test passed: four authenticated users, 40 parallel writes, valid persistent database');
  } finally { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
