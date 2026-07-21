const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const port = 17368;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tona-lark-secret-test-'));
const credentials = {
  appSecret: 'app-secret-do-not-replace',
  verificationToken: 'verify-token-do-not-replace',
  encryptKey: 'encrypt-key-do-not-replace'
};
const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });

async function request(url, options = {}) {
  const response = await fetch('http://127.0.0.1:' + port + url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(response.status + ': ' + JSON.stringify(body));
  return body;
}
async function ready() {
  for (let i = 0; i < 30; i += 1) {
    try { await request('/api/state'); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error('Server did not start');
}

(async () => {
  try {
    await ready();
    const created = await request('/api/lark-bots', { method: 'POST', body: JSON.stringify({
      name: 'Test bot', agentId: 'daily_assistant', appId: 'cli_test_lark_secret', enabled: true, ...credentials
    }) });
    if (!created.bot.encryptKey.includes('...')) throw new Error('Expected masked bot credential in API response');
    await request('/api/lark-bots', { method: 'POST', body: JSON.stringify({
      id: created.bot.id, name: 'Test bot renamed', agentId: 'daily_assistant', appId: 'cli_test_lark_secret', enabled: true,
      appSecret: created.bot.appSecret, verificationToken: created.bot.verificationToken, encryptKey: created.bot.encryptKey
    }) });
    const stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'studio.json'), 'utf8'));
    const bot = stored.settings.larkBots.find(item => item.appId === 'cli_test_lark_secret');
    for (const [key, value] of Object.entries(credentials)) if (bot[key] !== value) throw new Error(key + ' was overwritten by its masked value');
    console.log('Lark secret preservation test passed: masked credentials do not overwrite stored values');
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
