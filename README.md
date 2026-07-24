# TONA Agent Studio

TONA Agent Studio is a local, no-code multi-agent workspace for personal AI workflows.

The first MVP focuses on:

- managing multiple model providers, including OpenAI-compatible APIs
- creating and editing AI roles from a web page
- creating reusable multi-agent skills in Skill Center
- running skills from pasted text
- saving local run logs

It is intentionally local-first. Your API keys are stored in `data/studio.json` on this machine and are only shown as masked values in the UI.

## Quickstart

```bash
npm start
```

Open:

```text
http://localhost:7357
```

## Model Providers

Open the **模型** page and add or edit providers.

Built-in presets include:

- OpenAI
- DeepSeek
- Kimi / Moonshot
- Doubao / Volcengine Ark

Each provider uses this shape:

```json
{
  "name": "OpenAI",
  "type": "openai_compatible",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "defaultModel": "gpt-4.1-mini",
  "enabled": true
}
```

For Doubao or Kimi, set the exact model name you have access to.

## Agents

Open the **角色** page to create or edit agents.

Each agent has:

- role
- style
- goals
- guardrails
- output format
- provider and model
- skill labels

The current MVP turns these fields into a system prompt. It does not require prompt-file editing.

## Skill Center

Open **Skill Center** to define a reusable capability with trigger examples, an input type, enabled state, and ordered role steps.

Use one step per line:

```text
researcher | Summarize the material and extract the core argument.
critic | Identify weak logic and unsupported claims.
editor | Produce a polished final memo.
```

## Run Logs

Every Skill run is saved under:

```text
data/runs/
```

Inputs are not saved in full by default. The run log stores an input preview, step outputs, model metadata, status, and errors.

## Current Limits

- Feishu/Lark integration is not implemented yet.
- Only OpenAI-compatible chat completion APIs are implemented.
- Skill steps are sequential. The legacy `/api/workflows` endpoint remains available for compatibility.
- There is no user account system.
- API keys are stored locally but are not encrypted yet.

## Suggested Next Milestones

1. Add Feishu/Lark document read.
2. Add write-back with explicit confirmation.
3. Add provider-level cost, speed, and quality tags.
4. Add workflow templates for research, content, career, and governance work.
5. Add local key encryption.

## One-Click Daily Use

On Windows, double-click:

```text
Start-TONA.bat
```

This starts the local server and opens:

```text
http://localhost:7357
```

Use the **快速开始** page for the normal workflow:

1. Choose a provider, usually DeepSeek for low-cost research work.
2. Paste an API key. Saving automatically enables the provider.
3. Optionally paste a Feishu custom bot webhook.
4. Choose **科研信息分析** or **研究型内容生产**.
5. Paste research material and click **保存并运行**.
6. Click **发送结果到飞书** when you want to push the result to your Feishu group.

The advanced pages, **模型 / 角色 / Skill Center / 飞书 / 记录**, are still available when you want to customize details.

## Feishu App Bot Wizard

The **飞书** page now supports two modes:

- **方式 A：群自定义机器人 Webhook** for immediate result push to a Feishu group.
- **方式 B：开放平台应用机器人** for a future @-able bot.

For App Bot mode, TONA generates and handles:

- callback endpoint: `/feishu/events`
- URL verification challenge response
- local event logging under `data/lark_events/`
- App ID / App Secret storage and token test
- recommended permission checklist

Feishu cannot call `localhost`, so event subscription requires a public callback URL from a tunnel or deployment, for example `https://your-domain/feishu/events`.
