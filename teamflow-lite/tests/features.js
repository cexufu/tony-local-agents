const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 17361;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-features-'));
const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, INITIAL_ADMIN_PASSWORD: 'test-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
let cookie = '';
async function raw(url, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, { ...options, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } });
  if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
  return { status: response.status, body: await response.json().catch(() => ({})) };
}
async function ok(url, options) { const result = await raw(url, options); if (result.status < 200 || result.status >= 300) throw new Error(`${url} ${result.status}: ${JSON.stringify(result.body)}`); return result.body; }
async function ready() { for (let i = 0; i < 30; i += 1) { try { await ok('/api/health'); return; } catch { await new Promise(r => setTimeout(r, 100)); } } throw new Error('server timeout'); }

(async () => {
  try {
    await ready();
    await ok('/api/login', { method: 'POST', body: JSON.stringify({ email: 'admin@team.local', password: 'test-password' }) });
    const created = await ok('/api/users', { method: 'POST', body: JSON.stringify({ name: 'QA Member', email: 'qa@example.com', title: 'QA', role: 'member', password: 'quality123' }) });
    const memberId = created.user.id;
    const edited = await ok(`/api/users/${memberId}`, { method: 'PATCH', body: JSON.stringify({ name: 'QA Lead', email: 'qa-lead@example.com', title: 'Quality Lead', role: 'viewer', status: 'active' }) });
    if (edited.user.name !== 'QA Lead' || edited.user.role !== 'viewer') throw new Error('member edit failed');
    const analyzed = await ok('/api/requirement-analysis', { method: 'POST', body: JSON.stringify({ rawText: 'We need an internal permission workflow with a deadline and API integration. It must track tasks and acceptance.' }) });
    if (!analyzed.analysis.tasks.length || !analyzed.analysis.acceptanceCriteria.length) throw new Error('analysis incomplete');
    const converted = await ok('/api/requirement-analysis/convert', { method: 'POST', body: JSON.stringify({ analysis: analyzed.analysis, ownerId: memberId, priority: 'P1', type: 'feature', targetDate: '2030-01-01' }) });
    if (!converted.tasks.length || converted.requirement.ownerId !== memberId) throw new Error('conversion failed');
    const blocked = await raw(`/api/users/${memberId}`, { method: 'DELETE', body: '{}' });
    if (blocked.status !== 409 || !blocked.body.linkedTasks) throw new Error('delete protection failed');
    await ok(`/api/users/${memberId}`, { method: 'DELETE', body: JSON.stringify({ transferToUserId: 'usr_owner' }) });
    const users = await ok('/api/users');
    if (users.users.some(user => user.id === memberId)) throw new Error('member delete failed');
    const asset = await fetch(`http://127.0.0.1:${port}/enhancements.js`);
    if (!asset.ok || !(await asset.text()).includes('renderRequirementAnalysis')) throw new Error('enhancement asset missing');
    console.log('Feature test passed: member edit, analysis, conversion, delete protection, ownership transfer');
  } finally { child.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
