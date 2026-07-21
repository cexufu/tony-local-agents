const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { AsyncLocalStorage } = require("async_hooks");

const PORT = Number(process.env.PORT || 7357);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const ROOT_RUNS_DIR = path.join(DATA_DIR, "runs");
const ROOT_DB_PATH = path.join(DATA_DIR, "studio.json");
const WORKSPACES_DIR = path.join(DATA_DIR, "workspaces");
const workspaceContext = new AsyncLocalStorage();
const HUB_AUTH_REQUIRED = process.env.TONA_HUB_AUTH_REQUIRED === "true";
const TEAMFLOW_INTERNAL_PORT = Number(process.env.TEAMFLOW_INTERNAL_PORT || 7359);
const LEGACY_OWNER_ID = process.env.TONA_LEGACY_OWNER_ID || "usr_owner";
const ERROR_LOG_PATH = path.join(DATA_DIR, "tona-server-error.log");
function logServerError(error) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const message = error && error.stack ? error.stack : String(error);
    fs.appendFileSync(ERROR_LOG_PATH, `[${new Date().toISOString()}] ${message}\n\n`);
  } catch {}
}
process.on("uncaughtException", (error) => {
  logServerError(error);
  console.error(error);
});
process.on("unhandledRejection", (error) => {
  logServerError(error);
  console.error(error);
});

const DEFAULT_DB = {
  providers: [
    {
      id: "openai",
      name: "OpenAI",
      type: "openai_compatible",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      defaultModel: "gpt-4.1-mini",
      models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o"],
      enabled: false,
      notes: "Paste your OpenAI key to enable."
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      type: "openai_compatible",
      baseUrl: "https://api.deepseek.com",
      apiKey: "",
      defaultModel: "deepseek-chat",
      models: ["deepseek-chat", "deepseek-reasoner"],
      enabled: false,
      notes: "OpenAI-compatible endpoint."
    },
    {
      id: "kimi",
      name: "Kimi / Moonshot",
      type: "openai_compatible",
      baseUrl: "https://api.moonshot.cn/v1",
      apiKey: "",
      defaultModel: "kimi-k2",
      models: ["kimi-k2", "moonshot-v1-8k", "moonshot-v1-32k"],
      enabled: false,
      notes: "Set the exact model name you have access to."
    },
    {
      id: "doubao",
      name: "Doubao / Volcengine Ark",
      type: "openai_compatible",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      apiKey: "",
      defaultModel: "doubao-seed-1-6",
      models: ["doubao-seed-1-6", "doubao-seed-1-6-thinking"],
      enabled: false,
      notes: "Use your Ark endpoint model name if different."
    }
  ],
  agents: [
    {
      id: "researcher",
      name: "Researcher",
      role: "Academic and strategic research assistant.",
      style: "Clear, structured, evidence-aware, careful with uncertainty.",
      goals: "Summarize complex material, extract key claims, identify concepts, and find implications.",
      guardrails: "Do not invent citations. Mark uncertainty. Avoid vague advice.",
      outputFormat: "# Research Memo\n## 1. Core Question\n## 2. Main Points\n## 3. Key Concepts\n## 4. Important Evidence\n## 5. Implications\n## 6. Open Questions",
      providerId: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.3,
      skills: ["read_text", "summarize", "save_output"]
    },
    {
      id: "critic",
      name: "Critic",
      role: "Reviewer and red-team critic.",
      style: "Precise, direct, constructive, minimal drama.",
      goals: "Identify weak logic, unsupported claims, vague concepts, and execution risks.",
      guardrails: "Do not rewrite everything. Suggest minimal corrections.",
      outputFormat: "# Critical Review\n## 1. Biggest Weakness\n## 2. Unsupported Claims\n## 3. Conceptual Confusion\n## 4. Execution Risks\n## 5. Suggested Fixes",
      providerId: "deepseek",
      model: "deepseek-chat",
      temperature: 0.2,
      skills: ["critique", "save_output"]
    },
    {
      id: "editor",
      name: "Editor",
      role: "Editor for polished final output.",
      style: "Concise, coherent, useful, polished.",
      goals: "Rewrite for clarity, convert notes into structured writing, and produce final memos or content drafts.",
      guardrails: "Preserve important nuance. Do not over-market the result.",
      outputFormat: "# Final Memo\n## Summary\n## Key Takeaways\n## Recommended Next Steps",
      providerId: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.4,
      skills: ["rewrite", "finalize", "save_output"]
    }
  ],
  workflows: [
    {
      id: "material_to_memo",
      name: "Material to Memo",
      description: "Convert raw material into a structured research or strategy memo.",
      inputType: "text",
      steps: [
        { agentId: "researcher", task: "Summarize the material and extract the core argument." },
        { agentId: "critic", task: "Review the previous output and identify weak logic, unsupported claims, and risks." },
        { agentId: "editor", task: "Produce a polished final memo using the source material and previous agent outputs." }
      ],
      outputMode: "markdown"
    },
    {
      id: "material_to_content",
      name: "Material to Content",
      description: "Convert notes into title options, a short post, and a long-form outline.",
      inputType: "text",
      steps: [
        { agentId: "researcher", task: "Extract the strongest ideas and angles from the material." },
        { agentId: "critic", task: "Evaluate whether each angle is too vague, obvious, risky, or unsupported." },
        { agentId: "editor", task: "Generate 5 title options, 1 short post, and 1 long post outline." }
      ],
      outputMode: "markdown"
    }
  ],
  settings: {
    defaultProviderId: "openai",
    modelStrategy: "agent_default",
    saveInputs: false,
    requireWriteConfirmation: true
  }
};


const PERSONAL_AGENT_TEMPLATES = [
  {
    id: "daily_assistant",
    name: "日常助理",
    role: "你的日常主力助理，负责会议安排、日程协调、日历提醒、信息互动、任务拆解，并帮助协调和管理其他专业机器人。",
    style: "中文为主，自然、可靠、轻量、主动澄清。像一个长期协作的私人助理，不端着，不输出无谓报告。",
    goals: "快速理解用户意图；把模糊事项变成下一步行动；需要科研、数据、代码、职业、传播等专业能力时，建议交给对应角色。",
    guardrails: "不要编造日历或外部事实；没有接入真实日历时要说明只能帮用户整理和生成日程建议；涉及重要安排要复述确认。",
    outputFormat: "默认 1-3 段中文短回复；需要时给简短清单。",
    providerId: "deepseek",
    model: "deepseek-chat",
    temperature: 0.45,
    skills: ["daily", "chat"]
  },
  {
    id: "research_assistant",
    name: "科研助理",
    role: "你的科研讨论与研究分析助理，支持科学问题探讨、文献理解、研究设计、理论分析、论文想法打磨。",
    style: "中文为主，严谨、启发式、证据意识强，区分事实、推断和猜想。",
    goals: "帮助提出研究问题、拆解机制、比较理论、评估方法、识别创新点与风险，并生成可继续推进的研究计划。",
    guardrails: "不伪造文献和引用；信息不足时主动说明不确定性；不要把闲聊硬写成科研报告。",
    outputFormat: "日常讨论用自然中文；明确要求分析时使用：核心判断、依据、可能反例、下一步。",
    providerId: "deepseek",
    model: "deepseek-chat",
    temperature: 0.45,
    skills: ["research", "chat"]
  },
  {
    id: "data_assistant",
    name: "数据助理",
    role: "你的数据分析、数学计算、统计解释和建模助理。",
    style: "中文为主，步骤清楚，重视可复现和单位、假设、边界条件。",
    goals: "帮助做数学题、统计推断、数据清洗思路、可视化方案、指标设计、结果解释。",
    guardrails: "不能真实运行数据时要说明；计算题要展示关键步骤；不要把近似值说成精确事实。",
    outputFormat: "先给结论，再给关键步骤；复杂问题给公式/伪代码/表格。",
    providerId: "deepseek",
    model: "deepseek-chat",
    temperature: 0.25,
    skills: ["data", "chat"]
  },
  {
    id: "coding_assistant",
    name: "代码助理",
    role: "你的代码写作与编程学习助理，支持 debug、架构讨论、代码解释、编程教学和项目推进。",
    style: "中文为主，工程化、耐心、具体，能用例子教学。",
    goals: "帮助写代码、解释代码、定位 bug、设计模块、规划学习路径，并把复杂概念讲清楚。",
    guardrails: "不要假装看过未提供的代码；高风险命令要提醒；优先给可运行、可验证的方案。",
    outputFormat: "默认简洁说明 + 必要代码块；教学时按步骤解释。",
    providerId: "deepseek",
    model: "deepseek-chat",
    temperature: 0.25,
    skills: ["coding", "chat"]
  },
  {
    id: "fortune_assistant",
    name: "算命助理",
    role: "你的轻娱乐式命理、占星、八字、塔罗和人生叙事助理。",
    style: "中文为主，温和、有趣、富有象征感，但不制造恐惧。",
    goals: "用命理/占卜语言帮助用户做自我反思、情绪梳理和选择观察。",
    guardrails: "明确这是娱乐和反思，不作为医疗、法律、投资等重大决策依据；不做恐吓式断言。",
    outputFormat: "先给一句总体感觉，再给 3-5 点解读和一个现实建议。",
    providerId: "deepseek",
    model: "deepseek-chat",
    temperature: 0.65,
    skills: ["fortune", "chat"]
  },
  {
    id: "career_assistant",
    name: "职业助理",
    role: "你的创业、学业、职业发展和人生战略助理。",
    style: "中文为主，务实、战略性、鼓励但不鸡血。",
    goals: "支持博士规划、职业路径、创业想法、简历/申请材料、机会判断、长期定位和短期行动。",
    guardrails: "不做过度承诺；涉及重大选择时呈现权衡；区分事实、判断和建议。",
    outputFormat: "默认：判断、机会、风险、下一步行动。",
    providerId: "deepseek",
    model: "deepseek-chat",
    temperature: 0.45,
    skills: ["career", "chat"]
  },
  {
    id: "media_assistant",
    name: "传播助理",
    role: "你的小红书、公众号、短内容和个人 IP 传播助理。",
    style: "中文为主，有网感但不油腻，重视真实表达、标题张力和读者视角。",
    goals: "帮助做选题、标题、开头、结构、改写、系列内容规划和发布策略。",
    guardrails: "不编造经历；避免低质标题党；保留用户个人气质和学术可信度。",
    outputFormat: "默认给：选题角度、标题备选、开头、正文结构、发布建议。",
    providerId: "deepseek",
    model: "deepseek-chat",
    temperature: 0.65,
    skills: ["media", "chat"]
  }
];

const CUSTOMER_DEFAULT_AGENT_IDS = new Set(["daily_assistant", "research_assistant", "coding_assistant"]);
function createInitialDb() {
  const db = JSON.parse(JSON.stringify(DEFAULT_DB));
  const workspaceId = activeWorkspaceId();
  const isCustomerWorkspace = Boolean(workspaceId && workspaceId !== LEGACY_OWNER_ID);
  if (isCustomerWorkspace) {
    db.agents = PERSONAL_AGENT_TEMPLATES.filter((agent) => CUSTOMER_DEFAULT_AGENT_IDS.has(agent.id));
    db.workflows = [];
  } else {
    const existingIds = new Set(PERSONAL_AGENT_TEMPLATES.map((agent) => agent.id));
    db.agents = [...PERSONAL_AGENT_TEMPLATES, ...db.agents.filter((agent) => !existingIds.has(agent.id))];
  }
  db.settings = { ...db.settings, defaultProviderId: "deepseek", botConversationMaxRounds: 10, larkBots: [] };
  return db;
}

function activeWorkspaceId() {
  const workspaceId = workspaceContext.getStore()?.workspaceId || "";
  return /^[a-zA-Z0-9_-]{3,80}$/.test(workspaceId) ? workspaceId : "";
}

function storagePaths() {
  const workspaceId = activeWorkspaceId();
  if (!workspaceId) return { dbPath: ROOT_DB_PATH, runsDir: ROOT_RUNS_DIR };
  const directory = path.join(WORKSPACES_DIR, workspaceId);
  return { dbPath: path.join(directory, "studio.json"), runsDir: path.join(directory, "runs") };
}

function ensureStore() {
  const { dbPath, runsDir } = storagePaths();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(runsDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    const workspaceId = activeWorkspaceId();
    if (workspaceId === LEGACY_OWNER_ID && fs.existsSync(ROOT_DB_PATH)) {
      fs.copyFileSync(ROOT_DB_PATH, dbPath);
    } else {
      fs.writeFileSync(dbPath, JSON.stringify(createInitialDb(), null, 2));
    }
  }
}

// TONA_SECRETS_ENCRYPTION_V1: encrypt credentials at rest when the Render master key is configured.
const SECRET_FIELDS = new Set(['apiKey', 'larkWebhookSecret', 'larkAppSecret', 'larkVerificationToken', 'larkEncryptKey', 'appSecret', 'verificationToken', 'encryptKey']);
function secretsKey() {
  const source = String(process.env.TONA_SECRETS_KEY || '');
  return source.length >= 24 ? crypto.createHash('sha256').update(source).digest() : null;
}
function encryptSecretAtRest(value) {
  if (!value || String(value).startsWith('enc:v1:')) return value;
  const key = secretsKey(); if (!key) return value;
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]); const tag = cipher.getAuthTag();
  return 'enc:v1:' + Buffer.concat([iv, tag, data]).toString('base64');
}
function decryptSecretAtRest(value) {
  if (!String(value || '').startsWith('enc:v1:')) return value;
  const key = secretsKey(); if (!key) throw new Error('Encrypted credentials require TONA_SECRETS_KEY on this server.');
  const raw = Buffer.from(String(value).slice(7), 'base64'); const iv = raw.subarray(0, 12); const tag = raw.subarray(12, 28); const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
function transformSecrets(value, transform) {
  if (Array.isArray(value)) return value.map(item => transformSecrets(item, transform));
  if (!value || typeof value !== 'object') return value;
  const copy = {};
  for (const [key, item] of Object.entries(value)) copy[key] = SECRET_FIELDS.has(key) ? transform(item) : transformSecrets(item, transform);
  return copy;
}
function readDb() {
  ensureStore();
  return transformSecrets(JSON.parse(fs.readFileSync(storagePaths().dbPath, "utf8")), decryptSecretAtRest);
}
function writeDb(db) {
  ensureStore();
  fs.writeFileSync(storagePaths().dbPath, JSON.stringify(transformSecrets(db, encryptSecretAtRest), null, 2));
}

function publicDb(db) {
  return {
    ...db,
    providers: db.providers.map((provider) => ({
      ...provider,
      apiKey: provider.apiKey ? maskKey(provider.apiKey) : ""
    })),
    settings: {
      ...db.settings,
      larkWebhookSecret: db.settings?.larkWebhookSecret ? maskSecret(db.settings.larkWebhookSecret) : "",
      larkAppSecret: db.settings?.larkAppSecret ? maskSecret(db.settings.larkAppSecret) : "",
      larkVerificationToken: db.settings?.larkVerificationToken ? maskSecret(db.settings.larkVerificationToken) : "",
      larkEncryptKey: db.settings?.larkEncryptKey ? maskSecret(db.settings.larkEncryptKey) : "",
      larkBots: (db.settings?.larkBots || []).map((bot) => ({
        ...bot,
        appSecret: bot.appSecret ? maskSecret(bot.appSecret) : "",
        verificationToken: bot.verificationToken ? maskSecret(bot.verificationToken) : "",
        encryptKey: bot.encryptKey ? maskSecret(bot.encryptKey) : ""
      }))
    }
  };
}

function maskSecret(secret) {
  if (!secret) return "";
  if (secret.length <= 8) return "********";
  return secret.slice(0, 3) + "..." + secret.slice(-3);
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 8) return "********";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function coerceBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  if (value == null || value === "") return fallback;
  return Boolean(value);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store, max-age=0"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function upsertById(list, item) {
  const id = item.id || slug(item.name) || crypto.randomUUID();
  const normalized = { ...item, id };
  const index = list.findIndex((entry) => entry.id === id);
  if (index >= 0) list[index] = { ...list[index], ...normalized };
  else list.push(normalized);
  return normalized;
}

function agentSystemPrompt(agent) {
  return [
    `You are ${agent.name}.`,
    `Role: ${agent.role}`,
    `Style: ${agent.style}`,
    `Goals: ${agent.goals}`,
    `Guardrails: ${agent.guardrails}`,
    `Default output format:\n${agent.outputFormat}`,
    "Be useful, concrete, and honest about uncertainty."
  ].join("\n\n");
}

function buildStepPrompt({ workflow, step, sourceInput, previousOutputs }) {
  const prior = previousOutputs
    .map((output, index) => `Agent output ${index + 1} (${output.agentName}):\n${output.content}`)
    .join("\n\n---\n\n");

  return [
    `Workflow: ${workflow.name}`,
    `Workflow goal: ${workflow.description}`,
    `Current task: ${step.task}`,
    `Source material:\n${sourceInput}`,
    prior ? `Previous agent outputs:\n${prior}` : "",
    "Return the best possible output for the current task."
  ].filter(Boolean).join("\n\n");
}

async function callOpenAICompatible(provider, agent, messages) {
  if (!provider.apiKey) {
    throw new Error(`${provider.name} is missing an API key.`);
  }
  const childInput = JSON.stringify({ provider, agent, messages, timeoutMs: 45000 });
  const nodeArgs = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const hasProxyEnv = Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY);
  if (hasProxyEnv && nodeMajor >= 24) {
    nodeArgs.push("--use-env-proxy");
  }
  nodeArgs.push(path.join(ROOT, "llm_call.js"));
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, nodeArgs, {
      cwd: ROOT,
      timeout: 60000,
      maxBuffer: 2_000_000,
      env: process.env
    }, (error, stdout, stderr) => {
      if (error) {
        const message = (stderr || error.message || "LLM call failed").trim();
        reject(new Error(message.split("\n")[0]));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("LLM call returned invalid JSON."));
      }
    });
    child.stdin.end(childInput);
  });
}
function fallbackOutput(agent, task, input, previousOutputs) {
  const previousText = previousOutputs.map((output) => output.content).join("\n\n");
  const source = previousText || input;
  const excerpt = source.replace(/\s+/g, " ").slice(0, 800);
  return [
    `# ${agent.name} Draft`,
    "",
    `**Task:** ${task}`,
    "",
    "No enabled model with an API key was available for this agent, so TONA created a local draft placeholder.",
    "",
    "## Source Snapshot",
    excerpt || "No source text provided.",
    "",
    "## Next Step",
    "Add an API key in Model Providers, enable the provider, then run this workflow again."
  ].join("\n");
}

function diagnoseSetup(db) {
  const enabledProviders = db.providers.filter((provider) => provider.enabled && provider.apiKey);
  const researchWorkflows = db.workflows.filter((workflow) => ["research_intel_brief", "research_content_pipeline"].includes(workflow.id));
  const larkReady = Boolean(db.settings?.larkWebhookUrl);
  const larkAppReady = Boolean(db.settings?.larkAppId && db.settings?.larkAppSecret);
  const nextSteps = [];
  if (!enabledProviders.length) nextSteps.push("添加至少一个模型 API Key。推荐先用 DeepSeek，成本低，足够跑科研分析。");
  if (!larkReady) nextSteps.push("可选：添加飞书群机器人的 Webhook，这样结果可以一键发到飞书。");
  if (!researchWorkflows.length) nextSteps.push("初始化科研信息分析和研究型内容生产工作流。");
  if (!nextSteps.length) nextSteps.push("配置完成。可以在快速开始里粘贴材料并一键运行。");
  return {
    ready: enabledProviders.length > 0,
    providersReady: enabledProviders.map((provider) => ({ id: provider.id, name: provider.name, model: provider.defaultModel })),
    larkReady,
    larkAppReady,
    researchWorkflows: researchWorkflows.map((workflow) => ({ id: workflow.id, name: workflow.name, steps: workflow.steps.length })),
    nextSteps
  };
}

function applyQuickSetup(db, body) {
  const providerId = body.providerId || "deepseek";
  const provider = db.providers.find((item) => item.id === providerId);
  if (!provider) throw new Error("Selected provider was not found.");
  const apiKey = String(body.apiKey || "").trim();
  if (apiKey && !apiKey.includes("*")) {
    provider.apiKey = apiKey;
    provider.enabled = true;
  }
  if (body.baseUrl) provider.baseUrl = String(body.baseUrl).trim();
  if (body.model) {
    provider.defaultModel = String(body.model).trim();
    if (!provider.models.includes(provider.defaultModel)) provider.models.unshift(provider.defaultModel);
  }
  const researchAgentIds = ["research_intel_analyst", "research_content_producer", "critic", "editor"];
  for (const agent of db.agents) {
    if (researchAgentIds.includes(agent.id)) {
      agent.providerId = provider.id;
      agent.model = provider.defaultModel;
    }
  }
  db.settings ||= {};
  const webhookUrl = String(body.larkWebhookUrl || "").trim();
  if (webhookUrl) db.settings.larkWebhookUrl = webhookUrl;
  const webhookSecret = String(body.larkWebhookSecret || "").trim();
  if (webhookSecret && !webhookSecret.includes("*")) db.settings.larkWebhookSecret = webhookSecret;
  const appId = String(body.larkAppId || "").trim();
  if (appId) db.settings.larkAppId = appId;
  const appSecret = String(body.larkAppSecret || "").trim();
  if (appSecret && !appSecret.includes("*")) db.settings.larkAppSecret = appSecret;
  return provider;
}

async function runWorkflow(body) {
  const db = readDb();
  const workflow = db.workflows.find((item) => item.id === body.workflowId);
  if (!workflow) throw new Error("Workflow not found.");
  const sourceInput = String(body.input || "").trim();
  if (!sourceInput) throw new Error("Input text is required.");

  const startedAt = new Date();
  const previousOutputs = [];
  const stepResults = [];
  const errors = [];

  for (const step of workflow.steps) {
    const agent = db.agents.find((item) => item.id === step.agentId);
    if (!agent) {
      errors.push(`Agent not found: ${step.agentId}`);
      continue;
    }
    const provider = db.providers.find((item) => item.id === agent.providerId);
    const started = Date.now();
    let content;
    let model = agent.model;
    let status = "success";
    let usage = null;
    let error = null;

    try {
      if (!provider || !provider.enabled || !provider.apiKey) {
        content = fallbackOutput(agent, step.task, sourceInput, previousOutputs);
        status = "fallback";
      } else if (provider.type !== "openai_compatible") {
        throw new Error(`Provider type ${provider.type} is not implemented yet.`);
      } else {
        const result = await callOpenAICompatible(provider, agent, [
          { role: "system", content: agentSystemPrompt(agent) },
          { role: "user", content: buildStepPrompt({ workflow, step, sourceInput, previousOutputs }) }
        ]);
        content = result.content;
        model = result.model;
        usage = result.usage;
      }
    } catch (err) {
      status = "error";
      error = err.message;
      errors.push(`${agent.name}: ${err.message}`);
      content = fallbackOutput(agent, step.task, sourceInput, previousOutputs);
    }

    const stepResult = {
      agentId: agent.id,
      agentName: agent.name,
      providerId: provider?.id || null,
      providerName: provider?.name || "Not configured",
      model,
      task: step.task,
      status,
      durationMs: Date.now() - started,
      usage,
      error,
      content
    };
    stepResults.push(stepResult);
    previousOutputs.push({ agentName: agent.name, content });
  }

  const finalOutput = previousOutputs.at(-1)?.content || "";
  const runId = `${startedAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${workflow.id}_${crypto.randomUUID().slice(0, 8)}`;
  const run = {
    id: runId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    status: errors.length ? "completed_with_errors" : "success",
    inputPreview: sourceInput.slice(0, 300),
    input: db.settings.saveInputs ? sourceInput : null,
    steps: stepResults,
    finalOutput,
    errors
  };
  fs.writeFileSync(path.join(storagePaths().runsDir, `${runId}.json`), JSON.stringify(run, null, 2));
  return run;
}

function normalizeLarkBot(bot = {}) {
  return {
    id: bot.id || `bot_${crypto.randomUUID().slice(0, 8)}`,
    name: String(bot.name || "未命名机器人").trim(),
    agentId: String(bot.agentId || "daily_assistant").trim(),
    appId: String(bot.appId || "").trim(),
    appSecret: String(bot.appSecret || "").trim(),
    verificationToken: String(bot.verificationToken || "").trim(),
    encryptKey: String(bot.encryptKey || "").trim(),
    publicCallbackUrl: String(bot.publicCallbackUrl || "").trim(),
    callbackWorkspaceId: String(bot.callbackWorkspaceId || "").trim(),
    enabled: coerceBoolean(bot.enabled, true)
  };
}

function publicFeishuCallbackUrl(req) {
  const workspaceId = activeWorkspaceId();
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  if (!workspaceId || !host) return "";
  const proto = req.headers["x-forwarded-proto"] || (process.env.NODE_ENV === "production" ? "https" : "http");
  return proto + "://" + host + "/feishu/events/" + encodeURIComponent(workspaceId);
}

function larkEventLogDir() {
  return path.join(path.dirname(storagePaths().dbPath), "lark_events");
}

function larkBotToAppSettings(bot) {
  return {
    larkAppId: bot.appId,
    larkAppSecret: bot.appSecret,
    larkVerificationToken: bot.verificationToken,
    larkEncryptKey: bot.encryptKey,
    larkPublicCallbackUrl: bot.publicCallbackUrl
  };
}

function findLarkBotByAppId(db, appId) {
  return (db.settings?.larkBots || []).find((bot) => bot.enabled !== false && bot.appId && bot.appId === appId) || null;
}

function legacyLarkBot(db) {
  const settings = db.settings || {};
  if (!settings.larkAppId) return null;
  return {
    id: "legacy_lark_app",
    name: "默认飞书机器人",
    agentId: settings.larkAgentId || "daily_assistant",
    appId: settings.larkAppId,
    appSecret: settings.larkAppSecret || "",
    verificationToken: settings.larkVerificationToken || "",
    encryptKey: settings.larkEncryptKey || "",
    publicCallbackUrl: settings.larkPublicCallbackUrl || "",
    enabled: true
  };
}

function findLarkBotByVerificationToken(db, token) {
  if (!token) return null;
  return allLarkBots(db).find((bot) => bot.verificationToken && bot.verificationToken === token) || null;
}
function allLarkBots(db) {
  const bots = [...(db.settings?.larkBots || [])];
  const legacy = legacyLarkBot(db);
  if (legacy && !bots.some((bot) => bot.appId === legacy.appId)) bots.push(legacy);
  return bots.filter((bot) => bot.enabled !== false);
}

function decryptFeishuPayloadForAnyBot(encrypt, db) {
  const candidates = allLarkBots(db).filter((bot) => bot.encryptKey);
  let lastError = null;
  for (const bot of candidates) {
    try {
      return { eventBody: decryptFeishuPayload(encrypt, bot.encryptKey), bot };
    } catch (error) {
      lastError = error;
    }
  }
  if (!candidates.length) throw new Error("Encrypted Feishu event received, but no bot Encrypt Key is configured in TONA.");
  throw lastError || new Error("Failed to decrypt Feishu event with configured bot keys.");
}

async function runAgentReply(db, agentId, text) {
  const agent = db.agents.find((item) => item.id === agentId) || db.agents.find((item) => item.id === "daily_assistant") || db.agents[0];
  if (!agent) return "我还没有配置角色。请先在 TONA 的“角色”页创建一个角色。";
  const provider = db.providers.find((item) => item.id === agent.providerId) || firstReadyProvider(db);
  if (!provider || !provider.enabled || !provider.apiKey) return "我在，但这个角色还没有可用模型。请先在 TONA 的“模型”页启用一个模型，并在“角色”页绑定给我。";
  const result = await callOpenAICompatible(provider, agent, [
    { role: "system", content: agentSystemPrompt(agent) + "\n\n你正在飞书里和用户对话。除非用户明确要求其他语言，否则始终使用中文。普通聊天不要输出报告模板。" },
    { role: "user", content: text }
  ]);
  return result.content;
}
function firstReadyProvider(db) {
  return db.providers.find((provider) => provider.enabled && provider.apiKey && provider.type === "openai_compatible");
}

function classifyFeishuIntent(text) {
  const value = String(text || "").trim();
  if (/^(你好|在吗|hi|hello|hey|测试|收到|ping|现在呢|你是谁|你能做什么)[。！？!?.\s]*$/i.test(value)) return "daily";
  if (/写|内容|文章|标题|小红书|公众号|推文|帖子|润色|改写|大纲|选题|文案|开头|结尾/.test(value)) return "content";
  if (/论文|文献|摘要|abstract|paper|科研|研究|方法|实验|结果|趋势|情报|基金|课题|会议|征稿|call for papers|cfp|项目申请|综述|分析/.test(value)) return "research";
  return value.length < 80 ? "daily" : "research";
}

async function runDailyAssistant(db, text) {
  const provider = firstReadyProvider(db);
  if (!provider) return "我在，但现在还没有可用模型。先在 TONA 的“模型”页启用一个模型，我就能正常工作。";
  const agent = {
    name: "TONA 日常主力助手",
    role: "你是用户在飞书里的日常主力 AI 助手，同时兼具科研信息分析和研究型内容生产能力。",
    style: "中文、自然、简洁、可靠。像一个可以长期协作的个人助手，不要把普通聊天写成报告。",
    goals: "先理解用户真实意图。普通问候要自然回应；日常任务给出直接帮助；科研材料才进入结构化分析；内容创作请求才进入写作支持。",
    guardrails: "不要编造来源。不要对空输入做过度分析。信息不足时先问一个最关键的问题。",
    outputFormat: "默认用 1-3 段中文短回复。只有用户明确要求报告、清单或长文时才使用结构化格式。",
    model: provider.defaultModel,
    temperature: 0.5
  };
  const result = await callOpenAICompatible(provider, agent, [
    { role: "system", content: agentSystemPrompt(agent) },
    { role: "user", content: `用户在飞书里发来：${text}\n\n请作为日常主力助手直接回复。` }
  ]);
  return result.content;
}
async function testLarkApp(settings) {
  const appId = settings?.appId || settings?.larkAppId;
  const appSecret = settings?.appSecret || settings?.larkAppSecret;
  if (!appId || !appSecret) {
    throw new Error("Feishu App ID and App Secret are required.");
  }
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || payload.message || "Feishu app token test failed.");
  }
  return { ok: true, expire: payload.expire };
}

async function sendLarkWebhook(settings, text) {
  const webhookUrl = settings?.larkWebhookUrl;
  if (!webhookUrl) throw new Error("Feishu webhook is not configured.");
  const body = { msg_type: "text", content: { text } };
  const secret = settings?.larkWebhookSecret;
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signString = timestamp + "\n" + secret;
    body.timestamp = timestamp;
    body.sign = crypto.createHmac("sha256", signString).update("").digest("base64");
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payloadText = await response.text();
  let payload;
  try { payload = JSON.parse(payloadText); } catch { payload = { raw: payloadText }; }
  if (!response.ok || (payload.code && payload.code !== 0)) {
    throw new Error(payload.msg || payload.message || payloadText || "Feishu webhook failed: " + response.status);
  }
  return payload;
}

function listRuns() {
  ensureStore();
  return fs.readdirSync(storagePaths().runsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const run = JSON.parse(fs.readFileSync(path.join(storagePaths().runsDir, file), "utf8"));
      return {
        id: run.id,
        workflowName: run.workflowName,
        startedAt: run.startedAt,
        status: run.status,
        finalPreview: (run.finalOutput || "").replace(/\s+/g, " ").slice(0, 180)
      };
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Forbidden");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendText(res, 404, "Not found");
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };
  sendText(res, 200, fs.readFileSync(filePath), contentTypes[ext] || "application/octet-stream");
}

function parseFeishuDecryptedBuffer(buffer) {
  const candidates = [buffer, buffer.subarray(16)];
  for (const candidate of candidates) {
    const text = candidate.toString("utf8").trim();
    try { return JSON.parse(text); } catch {}
    const jsonStart = text.indexOf('{"schema"');
    if (jsonStart >= 0) {
      try { return JSON.parse(text.slice(jsonStart)); } catch {}
    }
  }
  throw new Error("Decrypted Feishu event is not valid JSON.");
}

function decryptFeishuPayload(encrypt, encryptKey) {
  if (!encryptKey) throw new Error("Encrypted Feishu event received, but Encrypt Key is not configured in TONA.");
  const key = crypto.createHash("sha256").update(encryptKey).digest();
  const encrypted = Buffer.from(encrypt, "base64");
  if (encrypted.length <= 16) throw new Error("Encrypted Feishu event payload is too short.");
  const iv = encrypted.subarray(0, 16);
  const ciphertext = encrypted.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return parseFeishuDecryptedBuffer(decrypted);
}

async function getFeishuTenantToken(settings) {
  const appId = settings?.appId || settings?.larkAppId;
  const appSecret = settings?.appSecret || settings?.larkAppSecret;
  if (!appId || !appSecret) {
    throw new Error("Feishu App ID / App Secret are not configured in TONA.");
  }
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(payload.msg || payload.message || "Failed to get Feishu tenant access token.");
  }
  return payload.tenant_access_token;
}

const DEFAULT_BOT_CONVERSATION_MAX_ROUNDS = 10;

function botConversationMaxRounds(db) {
  const value = Number(db.settings?.botConversationMaxRounds || DEFAULT_BOT_CONVERSATION_MAX_ROUNDS);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 12) : DEFAULT_BOT_CONVERSATION_MAX_ROUNDS;
}

function parseBotConversationMarker(text) {
  const match = String(text || "").match(/\[TONA协作:thread=([^;\]]+);round=(\d+)\/(\d+);bot=([^\]]+)\]/);
  if (!match) return null;
  return {
    threadId: match[1],
    round: Number(match[2]),
    maxRounds: Number(match[3]),
    botId: match[4]
  };
}

function stripBotConversationMarker(text) {
  return String(text || "").replace(/\n?\s*\[TONA协作:thread=[^\]]+\]\s*/g, "").trim();
}

function appendBotConversationMarker(text, context) {
  return `${String(text || "").trim()}\n\n[TONA协作:thread=${context.threadId};round=${context.round}/${context.maxRounds};bot=${context.botId}]`;
}

function makeConversationThreadId(message) {
  const seed = message.messageId || `${message.chatId || "chat"}:${message.rawText || message.text || Date.now()}`;
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12);
}
function extractFeishuMessage(eventBody) {
  const event = eventBody.event || eventBody;
  const message = event.message || {};
  const eventType = eventBody.header?.event_type || eventBody.event_type || "";
  const messageId = message.message_id;
  const chatId = message.chat_id;
  const chatType = message.chat_type || "";
  const senderType = event.sender?.sender_type || "";
  let rawText = "";
  let text = "";
  if (message.content) {
    try {
      const content = typeof message.content === "string" ? JSON.parse(message.content) : message.content;
      rawText = content.text || content.content || "";
      text = rawText;
    } catch {
      rawText = String(message.content || "");
      text = rawText;
    }
  }
  const isAtAll = /@_all|<at[^>]*(?:all|all_user)[^>]*>/i.test(rawText);
  const hasDirectMention = !isAtAll && (/<at[^>]*>.*?<\/at>/i.test(rawText) || /@_user_\d+/i.test(rawText) || Array.isArray(message.mentions) && message.mentions.length > 0);
  text = text.replace(/<at[^>]*>.*?<\/at>/g, "").replace(/@_user_\d+/g, "").replace(/@_all/g, "").trim();
  const botConversation = parseBotConversationMarker(rawText);
  text = stripBotConversationMarker(text);
  return { eventType, messageId, chatId, chatType, senderType, rawText, text, isAtAll, hasDirectMention, botConversation, messageType: message.message_type };
}

async function replyFeishuMessage(settings, messageId, text) {
  if (!messageId) throw new Error("Cannot reply: missing Feishu message_id.");
  const token = await getFeishuTenantToken(settings);
  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/messages/" + encodeURIComponent(messageId) + "/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      msg_type: "text",
      content: JSON.stringify({ text: text.slice(0, 6000) })
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || payload.message || "Failed to reply to Feishu message.");
  }
  return payload;
}

async function processFeishuMessageEvent(eventBody, botConfig = null) {
  const db = readDb();
  const appId = eventBody.header?.app_id || eventBody.app_id || "";
  const bot = botConfig || findLarkBotByAppId(db, appId) || legacyLarkBot(db);
  const message = extractFeishuMessage(eventBody);
  if (!message.messageId || !message.text) return;
  const shouldHandle = message.eventType.includes("im.message") || message.eventType.includes("message");
  if (!shouldHandle) return;

  const maxRounds = botConversationMaxRounds(db);
  let conversation = null;
  if (message.senderType === "bot") {
    conversation = message.botConversation;
    if (!conversation) return;
    if (conversation.botId === bot?.id) return;
    if (conversation.round >= Math.min(conversation.maxRounds || maxRounds, maxRounds)) return;
    conversation = {
      threadId: conversation.threadId,
      round: conversation.round + 1,
      maxRounds: Math.min(conversation.maxRounds || maxRounds, maxRounds),
      botId: bot?.id || "unknown_bot"
    };
  } else if (message.senderType && message.senderType !== "user") {
    return;
  } else {
    if (message.chatType === "group" && !message.isAtAll && !message.hasDirectMention) return;
    conversation = {
      threadId: makeConversationThreadId(message),
      round: 1,
      maxRounds,
      botId: bot?.id || "unknown_bot"
    };
  }

  let replyText = "";
  try {
    const promptText = message.senderType === "bot"
      ? `这是同一飞书群内另一个 AI 角色的发言。请只在有新增价值时回应，避免重复寒暄。当前是机器人协作第 ${conversation.round}/${conversation.maxRounds} 轮，达到上限后系统会强制停止。\n\n对方发言：${message.text}`
      : message.text;
    replyText = await runAgentReply(db, bot?.agentId || "daily_assistant", promptText);
  } catch (error) {
    replyText = "我这边处理失败了：" + error.message;
  }
  await replyFeishuMessage(bot ? larkBotToAppSettings(bot) : (db.settings || {}), message.messageId, appendBotConversationMarker(replyText, conversation));
}

function summarizeFeishuEventLog(entry, errorText = "") {
  const body = entry.body || {};
  const event = body.event || body;
  const message = event.message || {};
  let text = "";
  if (message.content) {
    try {
      const content = typeof message.content === "string" ? JSON.parse(message.content) : message.content;
      text = content.text || content.content || "";
    } catch {
      text = String(message.content || "");
    }
  }
  return {
    receivedAt: entry.receivedAt || "",
    decryptError: entry.decryptError || "",
    botId: entry.botId || "",
    agentId: entry.agentId || "",
    eventType: body.header?.event_type || body.event_type || "",
    appId: body.header?.app_id || body.app_id || "",
    senderType: event.sender?.sender_type || "",
    chatType: message.chat_type || "",
    messageType: message.message_type || "",
    messageId: message.message_id || "",
    textPreview: String(text).replace(/<at[^>]*>.*?<\/at>/g, "@ ").replace(/\s+/g, " ").slice(0, 160),
    replyError: String(errorText || "").split("\n")[0].slice(0, 240)
  };
}

function listLarkEventLogs(limit = 30) {
  const eventLogDir = larkEventLogDir();
  if (!fs.existsSync(eventLogDir)) return [];
  return fs.readdirSync(eventLogDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, Math.max(1, Math.min(Number(limit) || 30, 100)))
    .map((file) => {
      const id = file.replace(/\.json$/, "");
      let entry = {};
      try { entry = JSON.parse(fs.readFileSync(path.join(eventLogDir, file), "utf8")); } catch {}
      let errorText = "";
      const errorPath = path.join(eventLogDir, id + ".reply-error.txt");
      if (fs.existsSync(errorPath)) errorText = fs.readFileSync(errorPath, "utf8");
      return { id, ...summarizeFeishuEventLog(entry, errorText) };
    });
}

function larkAppDiagnosis(db, req) {
  const settings = db.settings || {};
  const host = req.headers.host || `localhost:${PORT}`;
  const localCallbackUrl = `http://${host}/feishu/events`;
  const publicCallbackUrl = settings.larkPublicCallbackUrl || "";
  const permissions = [
    { id: "im:message", name: "接收消息事件", why: "让机器人收到群里的 @ 消息。" },
    { id: "im:message:send_as_bot", name: "以机器人身份发送消息", why: "让机器人回复群消息。" },
    { id: "im:chat", name: "读取群聊基础信息", why: "用于判断消息来自哪个群。" }
  ];
  const steps = [
    "在飞书开放平台创建企业自建应用，并启用机器人能力。",
    "把 App ID / App Secret 填到本页并保存，点测试 App 凭证。",
    "在事件订阅里填写公网回调 URL。localhost 只能本机访问，飞书后台不能访问。",
    "把 Verification Token 和 Encrypt Key 填回本页。",
    "订阅消息事件，例如接收群聊消息 / 机器人被 @。",
    "申请并开通消息发送权限，然后安装应用到你的个人飞书群。"
  ];
  return {
    appConfigured: Boolean(settings.larkAppId && settings.larkAppSecret),
    tokenConfigured: Boolean(settings.larkVerificationToken),
    encryptKeyConfigured: Boolean(settings.larkEncryptKey),
    localCallbackUrl,
    publicCallbackUrl,
    effectiveCallbackUrl: publicCallbackUrl || localCallbackUrl,
    permissions,
    steps
  };
}

async function handleFeishuEvent(req, res) {
  let logId = null;
  try {
    const body = await readBody(req);
    const db = readDb();
    const settings = db.settings || {};
    let eventBody = body;
    let botConfig = null;
    let decryptError = null;
    if (body.encrypt) {
      try {
        const decrypted = decryptFeishuPayloadForAnyBot(body.encrypt, db);
        eventBody = decrypted.eventBody;
        botConfig = decrypted.bot;
      }
      catch (error) { decryptError = error.message; }
    } else {
      botConfig = findLarkBotByAppId(db, body.header?.app_id || body.app_id || "") || legacyLarkBot(db);
    }
    if (!decryptError && (eventBody.type === "url_verification" || eventBody.challenge)) {
      const tokenBot = findLarkBotByVerificationToken(db, eventBody.token);
      const expectedToken = tokenBot?.verificationToken || botConfig?.verificationToken || settings.larkVerificationToken;
      if (expectedToken && eventBody.token && eventBody.token !== expectedToken) {
        return sendJson(res, 403, { error: "Verification token mismatch." });
      }
      return sendJson(res, 200, { challenge: eventBody.challenge });
    }
    const eventLogDir = larkEventLogDir();
    fs.mkdirSync(eventLogDir, { recursive: true });
    logId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "_" + crypto.randomUUID().slice(0, 8);
    fs.writeFileSync(path.join(eventLogDir, logId + ".json"), JSON.stringify({
      receivedAt: new Date().toISOString(),
      decryptError,
      botId: botConfig?.id || null,
      agentId: botConfig?.agentId || null,
      body: decryptError ? body : eventBody
    }, null, 2));
    sendJson(res, 200, { ok: true });
    if (!decryptError) {
      processFeishuMessageEvent(eventBody, botConfig).catch((error) => {
        logServerError(error);
        if (logId) fs.writeFileSync(path.join(eventLogDir, logId + ".reply-error.txt"), error.stack || error.message || String(error));
      });
    }
  } catch (error) {
    logServerError(error);
    return sendJson(res, 400, { error: error.message });
  }
}

async function resolveHubUser(req) {
  if (!HUB_AUTH_REQUIRED) return null;
  const cookie = String(req.headers.cookie || "");
  if (!cookie) return null;
  try {
    const response = await fetch("http://127.0.0.1:" + TEAMFLOW_INTERNAL_PORT + "/api/me", { headers: { Cookie: cookie } });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.user || null;
  } catch {
    return null;
  }
}

async function handleApi(req, res, pathname) {
  const hubUser = await resolveHubUser(req);
  if (HUB_AUTH_REQUIRED && !hubUser) return sendJson(res, 401, { error: "Sign in to Tona AI Hub first." });
  const workspaceId = hubUser?.id || "";
  return workspaceContext.run({ workspaceId }, () => handleApiInWorkspace(req, res, pathname));
}

async function handleApiInWorkspace(req, res, pathname) {
  try {

    if (req.method === "GET" && pathname === "/api/diagnose") {
      return sendJson(res, 200, diagnoseSetup(readDb()));
    }
    if (req.method === "POST" && pathname === "/api/quick-setup") {
      const body = await readBody(req);
      const db = readDb();
      const provider = applyQuickSetup(db, body);
      writeDb(db);
      return sendJson(res, 200, {
        provider: { ...provider, apiKey: maskKey(provider.apiKey) },
        settings: publicDb(db).settings,
        diagnosis: diagnoseSetup(db)
      });
    }
    if (req.method === "GET" && pathname === "/api/state") {
      return sendJson(res, 200, publicDb(readDb()));
    }
    if (req.method === "GET" && pathname === "/api/runs") {
      return sendJson(res, 200, listRuns());
    }
    if (req.method === "POST" && pathname === "/api/providers") {
      const body = await readBody(req);
      const db = readDb();
      const existing = db.providers.find((item) => item.id === body.id);
      const hasNewApiKey = Boolean(body.apiKey && !body.apiKey.includes("*"));
      const provider = upsertById(db.providers, {
        ...body,
        enabled: hasNewApiKey ? true : coerceBoolean(body.enabled, existing?.enabled || false),
        apiKey: hasNewApiKey ? body.apiKey : existing?.apiKey || "",
        models: Array.isArray(body.models) ? body.models : String(body.models || "").split(",").map((m) => m.trim()).filter(Boolean)
      });
      writeDb(db);
      return sendJson(res, 200, { provider: { ...provider, apiKey: maskKey(provider.apiKey) } });
    }
    if (req.method === "POST" && pathname === "/api/agents") {
      const body = await readBody(req);
      const db = readDb();
      const agent = upsertById(db.agents, body);
      writeDb(db);
      return sendJson(res, 200, { agent });
    }
    if (req.method === "POST" && pathname === "/api/workflows") {
      const body = await readBody(req);
      const db = readDb();
      const workflow = upsertById(db.workflows, body);
      writeDb(db);
      return sendJson(res, 200, { workflow });
    }
    if (req.method === "POST" && pathname === "/api/run") {
      const body = await readBody(req);
      const run = await runWorkflow(body);
      return sendJson(res, 200, run);
    }

    if (req.method === "POST" && pathname === "/api/lark-bots") {
      const body = await readBody(req);
      const db = readDb();
      db.settings ||= {};
      db.settings.larkBots ||= [];
      const incomingAppId = String(body.appId || "").trim();
      const existingByApp = incomingAppId ? db.settings.larkBots.find((item) => item.appId === incomingAppId) : null;
      const existingById = body.id ? db.settings.larkBots.find((item) => item.id === body.id) : null;
      const existing = existingByApp || (existingById && (!incomingAppId || existingById.appId === incomingAppId) ? existingById : null);
      const source = existing ? { ...existing, ...body } : { ...body, id: "" };
      const bot = normalizeLarkBot({
        ...source,
        callbackWorkspaceId: activeWorkspaceId(),
        publicCallbackUrl: (() => { const submitted = String(body.publicCallbackUrl || existing?.publicCallbackUrl || "").trim(); const generated = publicFeishuCallbackUrl(req); return generated && /\/feishu\/events\/?$/.test(submitted) ? generated : (submitted || generated); })(),
        appSecret: body.appSecret && !String(body.appSecret).includes("*") ? body.appSecret : existing?.appSecret || "",
        verificationToken: body.verificationToken && !String(body.verificationToken).includes("*") ? body.verificationToken : existing?.verificationToken || "",
        encryptKey: body.encryptKey && !String(body.encryptKey).includes("*") ? body.encryptKey : existing?.encryptKey || ""
      });
      if (!bot.appId) throw new Error("App ID is required.");
      if (!bot.agentId) throw new Error("Agent is required.");
      if (existing) Object.assign(existing, bot);
      else db.settings.larkBots.push(bot);
      writeDb(db);
      return sendJson(res, 200, { bot: publicDb(db).settings.larkBots.find((item) => item.id === bot.id), settings: publicDb(db).settings });
    }
    if (req.method === "POST" && pathname === "/api/lark-bot-test") {
      const body = await readBody(req);
      const db = readDb();
      const bot = (db.settings?.larkBots || []).find((item) => item.id === body.id || item.appId === body.appId);
      if (!bot) throw new Error("Bot config was not found.");
      const result = await testLarkApp(larkBotToAppSettings(bot));
      return sendJson(res, 200, result);
    }
    if (req.method === "POST" && pathname === "/api/lark-settings") {
      const body = await readBody(req);
      const db = readDb();
      db.settings ||= {};
      db.settings.larkWebhookUrl = body.larkWebhookUrl || "";
      db.settings.larkAppId = body.larkAppId || db.settings.larkAppId || "";
      db.settings.larkPublicCallbackUrl = body.larkPublicCallbackUrl || db.settings.larkPublicCallbackUrl || "";
      db.settings.larkVerificationToken = body.larkVerificationToken || db.settings.larkVerificationToken || "";
      if (body.larkEncryptKey && !body.larkEncryptKey.includes("*")) db.settings.larkEncryptKey = body.larkEncryptKey;
      if (body.larkAppSecret && !body.larkAppSecret.includes("*")) {
        db.settings.larkAppSecret = body.larkAppSecret;
      } else if (!body.larkAppSecret && body.clearLarkAppSecret) {
        db.settings.larkAppSecret = "";
      }
      if (body.larkWebhookSecret && !body.larkWebhookSecret.includes("*")) {
        db.settings.larkWebhookSecret = body.larkWebhookSecret;
      } else if (!body.larkWebhookSecret) {
        db.settings.larkWebhookSecret = "";
      }
      writeDb(db);
      return sendJson(res, 200, { settings: publicDb(db).settings });
    }


    if (req.method === "GET" && pathname === "/api/lark-events") {
      const limit = new URL(req.url, `http://${req.headers.host}`).searchParams.get("limit") || 30;
      return sendJson(res, 200, { events: listLarkEventLogs(limit) });
    }
    if (req.method === "GET" && pathname === "/api/lark-app-diagnose") {
      return sendJson(res, 200, larkAppDiagnosis(readDb(), req));
    }
    if (req.method === "POST" && pathname === "/api/lark-app-test") {
      const db = readDb();
      const result = await testLarkApp(db.settings);
      return sendJson(res, 200, result);
    }
    if (req.method === "POST" && pathname === "/api/lark-test") {
      const db = readDb();
      await sendLarkWebhook(db.settings, "TONA Agent Studio 飞书连接测试成功。");
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "POST" && pathname === "/api/lark-send") {
      const body = await readBody(req);
      const db = readDb();
      const text = String(body.text || "").trim();
      if (!text) throw new Error("Text is required.");
      await sendLarkWebhook(db.settings, text.slice(0, 18000));
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === "POST" && pathname === "/api/test-provider") {
      const body = await readBody(req);
      const db = readDb();
      const provider = db.providers.find((item) => item.id === body.providerId);
      if (!provider) throw new Error("Provider not found.");
      const agent = { model: provider.defaultModel, temperature: 0 };
      const result = await callOpenAICompatible(provider, agent, [
        { role: "system", content: "You are a connection test. Reply with one short sentence." },
        { role: "user", content: "Say TONA connection OK." }
      ]);
      return sendJson(res, 200, { ok: true, message: result.content, model: result.model });
    }
    sendJson(res, 404, { error: "API route not found." });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

ensureStore();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "GET" && (url.pathname === "/gateway/health" || url.pathname === "/api/health")) {
    return sendJson(res, 200, { ok: true, service: "tona-agent-studio" });
  }
  const scopedEvent = url.pathname.match(/^\/feishu\/events\/([A-Za-z0-9_-]{3,80})$/);
  if (scopedEvent) {
    return workspaceContext.run({ workspaceId: scopedEvent[1] }, () => handleFeishuEvent(req, res));
  }
  // FEISHU_LEGACY_OWNER_CALLBACK_V1: keep the original shared URL working for the owner's pre-migration bots.
  if (url.pathname === "/feishu/events") {
    workspaceContext.run({ workspaceId: LEGACY_OWNER_ID }, () => handleFeishuEvent(req, res));
  } else if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url.pathname);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`TONA Agent Studio is running at http://localhost:${PORT}`);
});



