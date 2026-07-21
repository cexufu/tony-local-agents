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
    const selectedIds = allIds.slice(0, 3);
    const selectedAgents = selectedIds.map((id) => state.agents.find((agent) => agent.id === id));
    await request('/api/lark-bots', { method: 'POST', body: JSON.stringify({ name: 'test coordinator', appId: 'cli_test_coordinator', appSecret: '', agentId: selectedIds[0], openId: 'ou_test_coordinator', enabled: true }) });
    await request('/api/lark-bots', { method: 'POST', body: JSON.stringify({ name: 'test bystander', appId: 'cli_test_bystander', appSecret: '', agentId: selectedIds[1], openId: 'ou_test_bystander', enabled: true }) });
    const taskText = "@_user_1 \u534f\u4f5c\u4efb\u52a1\uff1a\u534f\u8c03\uff1a" + selectedAgents[0].name + "\uff1b\u53c2\u4e0e\uff1a" + selectedAgents.map((agent) => agent.name).join("\u3001") + "\uff1b\u6267\u7b14\uff1a" + selectedAgents[2].name + "\uff1b\u8f6e\u6b21\uff1a10\uff1b\u4efb\u52a1\uff1a\u6d4b\u8bd5\u4e34\u65f6\u7f16\u7ec4";
    await request('/feishu/events/usr_owner', { method: 'POST', body: JSON.stringify({
      header: { event_type: 'im.message.receive_v1', app_id: 'cli_test_bystander' },
      event: { sender: { sender_type: 'user', sender_id: { open_id: 'ou_test_one' } }, message: { message_id: 'message_wrong_mention', chat_id: 'chat_dynamic_plan', chat_type: 'group', message_type: 'text', mentions: [{ key: '@_user_1', name: 'Feishu display name', id: { open_id: 'ou_test_coordinator' } }], content: JSON.stringify({ text: taskText }) } }
    }) });
    await new Promise((resolve) => setTimeout(resolve, 80));
    let stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'workspaces', 'usr_owner', 'studio.json'), 'utf8'));
    if ((stored.settings.collaborationTasks || []).some((item) => item.sourceMessageId === 'message_wrong_mention')) throw new Error('Unmentioned bot started a group task');
    await request('/feishu/events/usr_owner', { method: 'POST', body: JSON.stringify({
      header: { event_type: 'im.message.receive_v1', app_id: 'cli_test_coordinator' },
      event: { sender: { sender_type: 'user', sender_id: { open_id: 'ou_test_one' } }, message: { message_id: 'message_dynamic_plan', chat_id: 'chat_dynamic_plan', chat_type: 'group', message_type: 'text', mentions: [{ key: '@_user_1', name: 'Feishu display name', id: { open_id: 'ou_test_coordinator' } }], content: JSON.stringify({ text: taskText }) } }
    }) });
    await new Promise((resolve) => setTimeout(resolve, 120));
    stored = JSON.parse(fs.readFileSync(path.join(dataDir, 'workspaces', 'usr_owner', 'studio.json'), 'utf8'));
    const task = (stored.settings.collaborationTasks || []).find((item) => item.sourceMessageId === 'message_dynamic_plan');
    if (!task) throw new Error('Feishu task directive did not create a collaboration task');
    if (task.coordinatorAgentId !== selectedIds[0] || task.writerAgentId !== selectedIds[2]) throw new Error('Coordinator or writer was not parsed from Feishu task directive');
    if (task.participantAgentIds.length !== 3 || task.rounds !== 10) throw new Error('Participants or rounds were not parsed from Feishu task directive');
    if (task.sequence.length !== 10 || task.sequence.at(-1) !== selectedIds[2]) throw new Error('Feishu task directive did not create a controlled sequence');
    console.log('Collaboration policy test passed: five-role cap, ten-message cap, private task ledger, Feishu task directives, and exact open-id mention routing');
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
