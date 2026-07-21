
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const port = 17370;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tona-skill-card-test-"));
const child = spawn(process.execPath, ["server.js"], {
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, PORT: String(port), DATA_DIR: dataDir },
  stdio: ["ignore", "pipe", "pipe"]
});

async function request(url, options = {}) {
  const response = await fetch("http://127.0.0.1:" + port + url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(response.status + ": " + JSON.stringify(body));
  return body;
}
async function ready() {
  for (let i = 0; i < 30; i += 1) {
    try { return await request("/api/state"); } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw new Error("Server did not start");
}
function storedDb() {
  return JSON.parse(fs.readFileSync(path.join(dataDir, "workspaces", "usr_owner", "studio.json"), "utf8"));
}

(async () => {
  try {
    const state = await ready();
    await request("/api/lark-bots", {
      method: "POST",
      body: JSON.stringify({
        name: "测试机器人",
        appId: "cli_skill_card",
        appSecret: "fake_secret",
        agentId: state.agents[0].id,
        openId: "ou_skill_bot",
        enabled: true
      })
    });

    await request("/feishu/events/usr_owner", {
      method: "POST",
      body: JSON.stringify({
        header: { event_type: "im.message.receive_v1", app_id: "cli_skill_card" },
        event: {
          sender: { sender_type: "user", sender_id: { open_id: "ou_requester" } },
          message: {
            message_id: "skill_request_message",
            chat_id: "chat_skill",
            chat_type: "group",
            message_type: "text",
            mentions: [{ name: "测试机器人", id: { open_id: "ou_skill_bot" } }],
            content: JSON.stringify({ text: "@_user_1 申请权限：读取群消息作为知识上下文" })
          }
        }
      })
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    let db = storedDb();
    const skillRequest = (db.settings.skillRequests || []).find((item) => item.requestedMessageId === "skill_request_message");
    if (!skillRequest || skillRequest.capabilityId !== "group_knowledge" || skillRequest.status !== "pending") throw new Error("Feishu capability request was not saved");
    const publicState = await request("/api/state");
    if (publicState.settings.skillRequests !== undefined) throw new Error("Capability request ledger was exposed in public state");

    const response = await request("/feishu/events/usr_owner", {
      method: "POST",
      body: JSON.stringify({
        header: { event_type: "card.action.trigger", app_id: "cli_skill_card" },
        event: {
          operator: { open_id: "ou_requester" },
          action: { value: { source: "tona_skill_request", requestId: skillRequest.id, action: "approve" } }
        }
      })
    });
    if (response.toast?.type !== "warning") throw new Error("App-level scope approval should warn that admin approval is still required");
    db = storedDb();
    const updated = (db.settings.skillRequests || []).find((item) => item.id === skillRequest.id);
    if (updated?.status !== "needs_admin") throw new Error("App-level capability request was marked as granted");

    const unauthorized = await request("/feishu/events/usr_owner", {
      method: "POST",
      body: JSON.stringify({
        header: { event_type: "card.action.trigger", app_id: "cli_skill_card" },
        event: {
          operator: { open_id: "ou_other_user" },
          action: { value: { source: "tona_skill_request", requestId: skillRequest.id, action: "reject" } }
        }
      })
    });
    if (unauthorized.toast?.type !== "warning") throw new Error("A different user was allowed to act on the request");
    console.log("Feishu skill request card test passed: private ledger, requester-only confirmation, and app-permission escalation.");
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
