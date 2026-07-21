const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const port = 17369;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tona-collaboration-test-'));
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
    const allIds = state.agents.map(agent => agent.id);
    const policy = await request('/api/collaboration-policy', { method: 'POST', body: JSON.stringify({
      enabled: true,
      coordinatorAgentId: allIds[0],
      writerAgentId: allIds[allIds.length - 1],
      participantAgentIds: allIds,
      maxMessages: 999,
      decisionMakerOpenIds: 'ou_test_one, ou_test_two',
      requireCollaborationKeyword: true,
      allowBotHandoffs: true,
      requireWriteConfirmation: true
    }) });
    if (policy.collaborationPolicy.participantAgentIds.length !== 5) throw new Error('Participant limit was not enforced');
    if (policy.collaborationPolicy.maxMessages !== 10) throw new Error('Message limit was not fixed at 10');
    if (policy.collaborationPolicy.decisionMakerOpenIds.length !== 2) throw new Error('Decision-maker IDs were not normalized');
    const publicState = await request('/api/state');
    if (publicState.settings.collaborationTasks !== undefined) throw new Error('Internal collaboration task ledger was exposed');
    console.log('Collaboration policy test passed: five-role cap, ten-message cap, and private task ledger');
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
