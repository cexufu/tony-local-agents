const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 17366;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-tenant-test-'));
const child = spawn(process.execPath, ['server.js'], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, INITIAL_ADMIN_PASSWORD: 'test-password' },
  stdio: ['ignore', 'pipe', 'pipe']
});

function client() {
  let cookie = '';
  return async (url, options = {}) => {
    const response = await fetch('http://127.0.0.1:' + port + url, { ...options, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const body = await response.json();
    if (!response.ok) throw new Error(response.status + ': ' + JSON.stringify(body));
    return body;
  };
}

async function waitUntilReady(request) {
  for (let i = 0; i < 30; i += 1) {
    try { await request('/api/health'); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error('Server did not become ready');
}

(async () => {
  const first = client(); const second = client();
  try {
    await waitUntilReady(first);
    await first('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Alice', email: 'alice@example.test', password: 'password-1', teamName: 'Alice Team' }) });
    await second('/api/register', { method: 'POST', body: JSON.stringify({ name: 'Bob', email: 'bob@example.test', password: 'password-2', teamName: 'Bob Team' }) });
    await first('/api/requirements', { method: 'POST', body: JSON.stringify({ title: 'Alice private requirement', summary: 'must not leak', priority: 'P1', type: 'feature', targetDate: '2030-01-01' }) });
    const bobView = await second('/api/requirements');
    if (bobView.requirements.some(item => item.title === 'Alice private requirement')) throw new Error('Tenant data leaked into another team');
    const aliceMembers = await first('/api/users'); const bobMembers = await second('/api/users');
    if (aliceMembers.users.some(user => user.email === 'bob@example.test') || bobMembers.users.some(user => user.email === 'alice@example.test')) throw new Error('Tenant member list leaked');
    console.log('Tenant isolation test passed: separate data files and member lists');
  } finally { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
