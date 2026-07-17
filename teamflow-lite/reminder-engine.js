function todayInZone(timeZone) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}

function hourInZone(timeZone) {
  try { return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(new Date())); }
  catch { return new Date().getUTCHours(); }
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function createReminderEngine({ getDb, saveDb }) {
  const timeZone = process.env.REMINDER_TIMEZONE || 'Asia/Shanghai';
  const reminderHour = Math.max(0, Math.min(23, Number(process.env.REMINDER_HOUR || 9)));
  let timer = null;
  let running = false;
  let lastCheckAt = null;
  let lastError = '';

  function collect() {
    const db = getDb();
    const today = todayInZone(timeZone);
    const soon = addDays(today, Number(db.settings.reminderDays || 2));
    const requirementsById = Object.fromEntries(db.requirements.map(item => [item.id, item]));
    const tasks = db.tasks.filter(item => item.status !== 'done' && item.dueDate && item.dueDate <= soon).map(item => ({ id: item.id, type: 'task', title: item.title, dueDate: item.dueDate, ownerId: item.assigneeId, requirementTitle: requirementsById[item.requirementId]?.title || '', state: item.dueDate < today ? 'overdue' : 'due_soon' }));
    const milestones = db.milestones.filter(item => item.status !== 'done' && item.dueDate && item.dueDate <= soon).map(item => ({ id: item.id, type: 'milestone', title: item.title, dueDate: item.dueDate, ownerId: requirementsById[item.requirementId]?.ownerId || '', requirementTitle: requirementsById[item.requirementId]?.title || '', state: item.dueDate < today ? 'overdue' : 'due_soon' }));
    return [...tasks, ...milestones].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  function deliveryConfig() {
    return { feishu: Boolean(process.env.FEISHU_REMINDER_WEBHOOK), generic: Boolean(process.env.REMINDER_WEBHOOK_URL), publicUrl: process.env.APP_PUBLIC_URL || '', timeZone, reminderHour };
  }

  function buildMessage(items) {
    const db = getDb();
    const users = Object.fromEntries(db.users.map(user => [user.id, user]));
    const overdue = items.filter(item => item.state === 'overdue').length;
    const lines = items.slice(0, 15).map(item => {
      const flag = item.state === 'overdue' ? '[OVERDUE]' : '[DUE]';
      const owner = users[item.ownerId]?.name || 'Unassigned';
      return `${flag} ${item.title} | ${item.dueDate} | ${owner}${item.requirementTitle ? ` | ${item.requirementTitle}` : ''}`;
    });
    const link = process.env.APP_PUBLIC_URL ? `\nOpen TeamFlow: ${process.env.APP_PUBLIC_URL}` : '';
    return `TeamFlow reminder: ${items.length} items (${overdue} overdue)\n${lines.join('\n')}${items.length > 15 ? `\n...and ${items.length - 15} more` : ''}${link}`;
  }

  async function post(url, body) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`webhook HTTP ${response.status}`);
    const text = await response.text();
    if (text) {
      try { const payload = JSON.parse(text); if (payload.code && payload.code !== 0) throw new Error(payload.msg || `webhook code ${payload.code}`); } catch (error) { if (!error.message.startsWith('Unexpected token')) throw error; }
    }
  }

  async function run({ force = false, actorId = 'system' } = {}) {
    if (running) return { ok: false, skipped: 'already_running', items: collect() };
    running = true; lastCheckAt = new Date().toISOString();
    try {
      const db = getDb(); db.reminderDeliveries ||= [];
      const config = deliveryConfig();
      const today = todayInZone(timeZone);
      const pending = collect();
      const fresh = pending.filter(item => !db.reminderDeliveries.some(log => log.deliveryKey === `${today}:${item.type}:${item.id}` && log.status === 'sent'));
      if (!force && hourInZone(timeZone) !== reminderHour) return { ok: true, skipped: 'outside_schedule', items: pending, fresh: fresh.length };
      if (!fresh.length) return { ok: true, skipped: 'nothing_new', items: pending, fresh: 0 };
      const channels = [];
      const errors = [];
      const text = buildMessage(fresh);
      if (config.feishu) {
        try { await post(process.env.FEISHU_REMINDER_WEBHOOK, { msg_type: 'text', content: { text } }); channels.push('feishu'); }
        catch (error) { errors.push(`feishu: ${error.message}`); }
      }
      if (config.generic) {
        try { await post(process.env.REMINDER_WEBHOOK_URL, { event: 'teamflow.reminder', text, items: fresh, generatedAt: lastCheckAt }); channels.push('webhook'); }
        catch (error) { errors.push(`webhook: ${error.message}`); }
      }
      if (!channels.length) {
        lastError = errors.join('; ') || 'No reminder webhook configured';
        db.reminderDeliveries.unshift({ id: `delivery_${Date.now()}`, createdAt: lastCheckAt, actorId, status: 'failed', channels: [], itemCount: fresh.length, error: lastError, deliveryKeys: [] });
        db.reminderDeliveries = db.reminderDeliveries.slice(0, 200); saveDb();
        return { ok: false, error: lastError, items: pending, fresh: fresh.length };
      }
      const deliveryKeys = fresh.map(item => `${today}:${item.type}:${item.id}`);
      db.reminderDeliveries.unshift({ id: `delivery_${Date.now()}`, createdAt: lastCheckAt, actorId, status: errors.length ? 'partial' : 'sent', channels, itemCount: fresh.length, error: errors.join('; '), deliveryKeys });
      deliveryKeys.forEach(deliveryKey => db.reminderDeliveries.push({ id: `item_${Math.random().toString(16).slice(2)}`, createdAt: lastCheckAt, status: 'sent', deliveryKey, hidden: true }));
      db.reminderDeliveries = db.reminderDeliveries.slice(0, 400); lastError = errors.join('; '); saveDb();
      return { ok: true, channels, sent: fresh.length, items: pending, errors };
    } finally { running = false; }
  }

  function status() { return { running, lastCheckAt, lastError, ...deliveryConfig() }; }
  function start() {
    if (timer) return;
    const check = () => run().catch(error => { lastError = error.message; console.error('Reminder scheduler:', error); });
    const initial = setTimeout(check, 15000); initial.unref?.();
    timer = setInterval(check, 15 * 60 * 1000); timer.unref?.();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return { collect, run, status, start, stop };
}

module.exports = { createReminderEngine };
