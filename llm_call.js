const fs = require("fs");

async function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const provider = input.provider;
  const agent = input.agent;
  if (!provider.apiKey) throw new Error(`${provider.name} is missing an API key.`);
  const model = agent.model || provider.defaultModel;
  const url = `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(input.timeoutMs || 45000));
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: Number(agent.temperature ?? 0.3),
        stream: false
      })
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
    if (!response.ok) {
      const message = payload.error?.message || payload.message || text || `HTTP ${response.status}`;
      throw new Error(`${provider.name} request failed: ${message}`);
    }
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${provider.name} returned no message content.`);
    process.stdout.write(JSON.stringify({ content, model, usage: payload.usage || null }));
  } finally {
    clearTimeout(timer);
  }
}

main().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
