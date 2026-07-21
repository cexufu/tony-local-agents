const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const port = 17370;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tona-kimi-migration-test-'));
const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });

async function request(url, options = {}) {
  const response = await fetch('http://127.0.0.1:' + port + url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(response.status + ': ' + JSON.stringify(body));
  return body;
}
async function ready() {
  for (let i = 0; i < 30; i += 1) {
    try { return await request('/api/state'); } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error('Server did not start');
}

(async () => {
  try {
    const state = await ready();
    const kimi = state.providers.find((provider) => provider.id === 'kimi');
    const coding = state.agents.find((agent) => agent.id === 'coding_assistant');
    await request('/api/providers', { method: 'POST', body: JSON.stringify({ ...kimi, apiKey: 'test-key', enabled: true, defaultModel: 'kimi-k2', models: ['kimi-k2'] }) });
    await request('/api/agents', { method: 'POST', body: JSON.stringify({ ...coding, providerId: 'kimi', model: 'kimi-k2' }) });
    const migrated = await request('/api/state');
    const migratedKimi = migrated.providers.find((provider) => provider.id === 'kimi');
    const migratedCoding = migrated.agents.find((agent) => agent.id === 'coding_assistant');
    if (migratedKimi.defaultModel !== 'kimi-k3' || !migratedKimi.models.includes('kimi-k2.7-code')) throw new Error('Retired Kimi provider model was not migrated');
    if (migratedCoding.model !== 'kimi-k3') throw new Error('Retired Kimi agent model was not migrated');
    console.log('Kimi migration test passed: retired model IDs upgrade to supported Kimi defaults');
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
