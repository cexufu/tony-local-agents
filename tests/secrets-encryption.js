const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const port = 17367;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tona-secret-test-'));
const secret = 'test-model-secret-never-store-as-plaintext';
const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, TONA_SECRETS_KEY: 'a-test-master-key-that-is-long-enough-123456789' }, stdio: ['ignore', 'pipe', 'pipe'] });
async function request(url, options = {}) {
  const response = await fetch('http://127.0.0.1:' + port + url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json(); if (!response.ok) throw new Error(response.status + ': ' + JSON.stringify(body)); return body;
}
async function ready() { for (let i = 0; i < 30; i += 1) { try { await request('/api/state'); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); } } throw new Error('Server did not start'); }
(async () => {
  try {
    await ready();
    const response = await request('/api/providers', { method: 'POST', body: JSON.stringify({ id: 'openai', name: 'OpenAI', type: 'openai_compatible', baseUrl: 'https://api.example.test/v1', apiKey: secret, defaultModel: 'test-model', models: ['test-model'], enabled: true }) });
    if (response.provider.apiKey === secret) throw new Error('API exposed an unmasked key');
    const stored = fs.readFileSync(path.join(dataDir, 'studio.json'), 'utf8');
    if (stored.includes(secret) || !stored.includes('enc:v1:')) throw new Error('Credential was not encrypted at rest');
    const state = await request('/api/state'); if (!state.providers.find(item => item.id === 'openai').apiKey.includes('...')) throw new Error('Masked provider state unavailable');
    console.log('Secret encryption test passed: encrypted at rest and masked in API');
  } finally { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
