const message = {
  forbidden: '\u6ca1\u6709\u6210\u5458\u7ba1\u7406\u6743\u9650',
  missing: '\u6210\u5458\u4e0d\u5b58\u5728',
  email: '\u90ae\u7bb1\u683c\u5f0f\u4e0d\u6b63\u786e',
  duplicate: '\u90ae\u7bb1\u5df2\u88ab\u5176\u4ed6\u6210\u5458\u4f7f\u7528',
  ownerRole: '\u8d1f\u8d23\u4eba\u89d2\u8272\u4e0d\u80fd\u76f4\u63a5\u8c03\u6574',
  selfDelete: '\u4e0d\u80fd\u5220\u9664\u5f53\u524d\u767b\u5f55\u8d26\u53f7',
  ownerDelete: '\u4e0d\u80fd\u5220\u9664\u56e2\u961f\u8d1f\u8d23\u4eba',
  analysisForbidden: '\u6ca1\u6709\u9700\u6c42\u5206\u6790\u6743\u9650',
  rawShort: '\u8bf7\u81f3\u5c11\u8f93\u5165 10 \u4e2a\u5b57\u7684\u539f\u59cb\u9700\u6c42',
  analysisMissing: '\u5206\u6790\u7ed3\u679c\u7f3a\u5c11\u9700\u6c42\u6807\u9898'
};

function localAnalysis(rawText, clean) {
  const text = clean(rawText).replace(/\r/g, '');
  const lines = text.split('\n').map(clean).filter(Boolean);
  const title = clean(lines[0] || text).replace(/^[#\-\d.\s]+/, '').slice(0, 60) || '\u672a\u547d\u540d\u9700\u6c42';
  const asks = lines.filter(line => /\u9700\u8981|\u5e0c\u671b|\u652f\u6301|\u5b9e\u73b0|\u589e\u52a0|\u53ef\u4ee5|\u80fd\u591f|\u5fc5\u987b/.test(line)).slice(0, 5);
  const goals = asks.length ? asks : [`\u5b8c\u6210\u201c${title}\u201d\u7684\u53ef\u7528\u7248\u672c`, '\u5f62\u6210\u53ef\u9a8c\u8bc1\u3001\u53ef\u8ddf\u8e2a\u7684\u4ea4\u4ed8\u95ed\u73af'];
  const hasPermission = /\u6743\u9650|\u89d2\u8272|\u7ba1\u7406\u5458|\u6210\u5458/.test(text);
  const hasExternal = /\u98de\u4e66|\u5fae\u4fe1|\u90ae\u4ef6|\u7b2c\u4e09\u65b9|\u63a5\u53e3|API/i.test(text);
  const hasDeadline = /\u622a\u6b62|\u4e0a\u7ebf|\u65e5\u671f|\u65f6\u95f4|\u672c\u5468|\u4e0b\u5468|\u6708\u5e95/.test(text);
  return {
    title,
    problem: lines.slice(0, 3).join('\uff1b').slice(0, 500),
    goals,
    nonGoals: ['\u672c\u671f\u4e0d\u5305\u542b\u672a\u660e\u786e\u63d0\u51fa\u7684\u590d\u6742\u5b9a\u5236\u80fd\u529b', '\u9996\u7248\u4e0d\u5f15\u5165\u975e\u5fc5\u8981\u7684\u67b6\u6784\u5347\u7ea7'],
    userStories: goals.slice(0, 4).map(goal => `\u4f5c\u4e3a\u76ee\u6807\u7528\u6237\uff0c\u6211\u5e0c\u671b${goal.replace(/[\u3002\uff1b]$/, '')}\uff0c\u4ece\u800c\u66f4\u9ad8\u6548\u5730\u5b8c\u6210\u5de5\u4f5c\u3002`),
    acceptanceCriteria: goals.slice(0, 5).map((goal, i) => `${i + 1}. \u53ef\u5b8c\u6210\uff1a${goal.replace(/[\u3002\uff1b]$/, '')}\uff0c\u5e76\u6709\u660e\u786e\u7684\u6210\u529f\u6216\u5931\u8d25\u53cd\u9988\u3002`),
    risks: [...(hasPermission ? ['\u6743\u9650\u8fb9\u754c\u9700\u8981\u8986\u76d6\u8d8a\u6743\u3001\u89d2\u8272\u8c03\u6574\u548c\u6210\u5458\u505c\u7528\u573a\u666f\u3002'] : []), ...(hasExternal ? ['\u9700\u8981\u786e\u8ba4\u5916\u90e8\u7cfb\u7edf\u7684\u63a5\u53e3\u6743\u9650\u3001\u7a33\u5b9a\u6027\u4e0e\u5931\u8d25\u91cd\u8bd5\u3002'] : []), ...(hasDeadline ? ['\u9700\u8981\u786e\u8ba4\u5404\u65f6\u95f4\u8282\u70b9\u8d1f\u8d23\u4eba\u548c\u7f13\u51b2\u65f6\u95f4\u3002'] : []), '\u8bc4\u5ba1\u65f6\u4ecd\u9700\u786e\u8ba4\u8303\u56f4\uff0c\u907f\u514d\u9a8c\u6536\u6807\u51c6\u4e0e\u9884\u671f\u4e0d\u4e00\u81f4\u3002'],
    questions: ['\u8fd9\u4e2a\u9700\u6c42\u6700\u6838\u5fc3\u7684\u6210\u529f\u6307\u6807\u662f\u4ec0\u4e48\uff1f', '\u9996\u7248\u5fc5\u987b\u5305\u542b\u4ec0\u4e48\uff0c\u54ea\u4e9b\u53ef\u4ee5\u540e\u7eed\u8fed\u4ee3\uff1f', '\u8c01\u8d1f\u8d23\u6700\u7ec8\u9a8c\u6536\uff0c\u9a8c\u6536\u573a\u666f\u662f\u4ec0\u4e48\uff1f'],
    milestones: ['\u9700\u6c42\u6f84\u6e05\u4e0e\u8bc4\u5ba1', '\u65b9\u6848\u786e\u8ba4', '\u5f00\u53d1\u5b8c\u6210', '\u5185\u90e8\u9a8c\u6536\u4e0e\u53d1\u5e03'],
    tasks: ['\u8865\u5145\u8303\u56f4\u4e0e\u9a8c\u6536\u6807\u51c6', '\u5b8c\u6210\u4ea7\u54c1/\u6280\u672f\u65b9\u6848\u8bc4\u5ba1', '\u5f00\u53d1\u5b9e\u73b0\u4e0e\u81ea\u6d4b', '\u8054\u8c03\u9a8c\u6536\u5e76\u53d1\u5e03'],
    suggestedPriority: /\u7d27\u6025|\u7acb\u5373|\u5fc5\u987b|\u963b\u585e|P0/i.test(text) ? 'P0' : /\u91cd\u8981|\u5c3d\u5feb|P1/i.test(text) ? 'P1' : 'P2',
    source: 'local'
  };
}

async function analyze(rawText, clean) {
  const fallback = localAnalysis(rawText, clean);
  if (!process.env.ANALYSIS_API_KEY) return fallback;
  try {
    const base = (process.env.ANALYSIS_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ANALYSIS_API_KEY}` }, body: JSON.stringify({ model: process.env.ANALYSIS_MODEL || 'gpt-4.1-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Analyze product requirement. Return JSON only with title, problem, goals, nonGoals, userStories, acceptanceCriteria, risks, questions, milestones, tasks, suggestedPriority. All except title/problem/suggestedPriority are string arrays. Priority is P0-P3. Use Chinese.' }, { role: 'user', content: String(rawText).slice(0, 12000) }] }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`provider ${response.status}`);
    const payload = await response.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
    const fields = ['goals','nonGoals','userStories','acceptanceCriteria','risks','questions','milestones','tasks'];
    if (!clean(parsed.title)) throw new Error('invalid result');
    fields.forEach(key => { if (!Array.isArray(parsed[key])) parsed[key] = fallback[key]; });
    return { ...fallback, ...parsed, suggestedPriority: ['P0','P1','P2','P3'].includes(parsed.suggestedPriority) ? parsed.suggestedPriority : fallback.suggestedPriority, source: 'model' };
  } catch (error) {
    console.warn('Requirement analysis fallback:', error.message);
    return fallback;
  }
}

async function handleFeatureApi(ctx) {
  const { req, res, pathname, user, db, json, readBody, can, clean, id, now, dateOnly, hashPassword, publicUser, enrichRequirement, logActivity, saveDb, reminderEngine } = ctx;
  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && req.method === 'PATCH') {
    if (!can(user, 'team.manage')) { json(res, 403, { error: message.forbidden }); return true; }
    const member = db.users.find(item => item.id === userMatch[1]);
    if (!member) { json(res, 404, { error: message.missing }); return true; }
    const body = await readBody(req);
    if (member.role === 'owner' && body.role && body.role !== 'owner') { json(res, 400, { error: message.ownerRole }); return true; }
    if (body.name !== undefined && clean(body.name)) member.name = clean(body.name);
    if (body.email !== undefined) {
      const email = clean(body.email).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) { json(res, 400, { error: message.email }); return true; }
      if (db.users.some(item => item.id !== member.id && item.email.toLowerCase() === email)) { json(res, 409, { error: message.duplicate }); return true; }
      member.email = email;
    }
    if (body.role && ['admin','member','viewer'].includes(body.role)) member.role = body.role;
    if (body.status && ['active','disabled'].includes(body.status) && member.id !== user.id && member.role !== 'owner') member.status = body.status;
    if (body.title !== undefined) member.title = clean(body.title);
    if (clean(body.password) && String(body.password).length < 8) { json(res, 400, { error: '\u65b0\u5bc6\u7801\u81f3\u5c11 8 \u4f4d' }); return true; }
    if (clean(body.password)) member.passwordHash = hashPassword(String(body.password));
    logActivity(user.id, `Updated member ${member.name}`, 'user', member.id); saveDb();
    json(res, 200, { user: publicUser(member) }); return true;
  }
  if (userMatch && req.method === 'DELETE') {
    if (!can(user, 'team.manage')) { json(res, 403, { error: message.forbidden }); return true; }
    const member = db.users.find(item => item.id === userMatch[1]);
    if (!member) { json(res, 404, { error: message.missing }); return true; }
    if (member.id === user.id) { json(res, 400, { error: message.selfDelete }); return true; }
    if (member.role === 'owner') { json(res, 400, { error: message.ownerDelete }); return true; }
    const body = await readBody(req);
    const requirements = db.requirements.filter(item => item.ownerId === member.id);
    const tasks = db.tasks.filter(item => item.assigneeId === member.id);
    if (requirements.length || tasks.length) {
      const replacement = db.users.find(item => item.id === body.transferToUserId && item.status === 'active' && item.id !== member.id);
      if (!replacement) { json(res, 409, { error: `\u8be5\u6210\u5458\u4ecd\u8d1f\u8d23 ${requirements.length} \u4e2a\u9700\u6c42\u548c ${tasks.length} \u4e2a\u4efb\u52a1\uff0c\u8bf7\u9009\u62e9\u63a5\u624b\u6210\u5458`, linkedRequirements: requirements.length, linkedTasks: tasks.length }); return true; }
      requirements.forEach(item => { item.ownerId = replacement.id; item.updatedAt = now(); });
      tasks.forEach(item => { item.assigneeId = replacement.id; item.updatedAt = now(); });
    }
    db.users = db.users.filter(item => item.id !== member.id);
    logActivity(user.id, `Deleted member ${member.name}`, 'user', member.id); saveDb();
    json(res, 200, { ok: true }); return true;
  }
  if (pathname === '/api/requirement-analysis' && req.method === 'POST') {
    if (!can(user, 'requirement.manage') && !can(user, 'requirement.create')) { json(res, 403, { error: message.analysisForbidden }); return true; }
    const body = await readBody(req);
    if (clean(body.rawText).length < 10) { json(res, 400, { error: message.rawShort }); return true; }
    json(res, 200, { analysis: await analyze(body.rawText, clean) }); return true;
  }
  if (pathname === '/api/requirement-analysis/convert' && req.method === 'POST') {
    if (!can(user, 'requirement.manage') && !can(user, 'requirement.create')) { json(res, 403, { error: message.analysisForbidden }); return true; }
    const body = await readBody(req); const result = body.analysis || {};
    if (!clean(result.title)) { json(res, 400, { error: message.analysisMissing }); return true; }
    const summary = [clean(result.problem), ...(Array.isArray(result.goals) ? result.goals.map(v => `\u76ee\u6807\uff1a${clean(v)}`) : []), ...(Array.isArray(result.acceptanceCriteria) ? result.acceptanceCriteria.map(v => `\u9a8c\u6536\uff1a${clean(v)}`) : [])].filter(Boolean).join('\n');
    const requirement = { id: id('req'), title: clean(result.title), summary, type: clean(body.type) || 'feature', priority: ['P0','P1','P2','P3'].includes(body.priority) ? body.priority : 'P2', status: 'draft', ownerId: body.ownerId || user.id, proposerId: user.id, targetDate: dateOnly(body.targetDate), progress: 0, createdAt: now(), updatedAt: now() };
    db.requirements.unshift(requirement);
    const tasks = (Array.isArray(result.tasks) ? result.tasks.slice(0, 10) : []).map(title => ({ id: id('task'), requirementId: requirement.id, title: clean(title), description: '\u7531\u9700\u6c42\u5206\u6790\u751f\u6210\uff0c\u8bf7\u5728\u8bc4\u5ba1\u540e\u8865\u5145\u7ec6\u8282\u3002', status: 'todo', priority: requirement.priority, assigneeId: requirement.ownerId, dueDate: requirement.targetDate || '', estimate: 0, createdBy: user.id, createdAt: now(), updatedAt: now() }));
    db.tasks.push(...tasks); logActivity(user.id, `Converted analysis ${requirement.title}`, 'requirement', requirement.id); saveDb();
    json(res, 201, { requirement: enrichRequirement(requirement), tasks }); return true;
  }
  if (pathname === '/api/reminders/tracking' && req.method === 'GET') {
    const deliveries = (db.reminderDeliveries || []).filter(item => !item.hidden).slice(0, 50);
    json(res, 200, { pending: reminderEngine.collect(), deliveries, scheduler: reminderEngine.status() }); return true;
  }
  if (pathname === '/api/reminders/run' && req.method === 'POST') {
    if (!can(user, 'settings.manage')) { json(res, 403, { error: '\u4ec5\u56e2\u961f\u8d1f\u8d23\u4eba\u53ef\u4ee5\u624b\u52a8\u6267\u884c\u63d0\u9192' }); return true; }
    const result = await reminderEngine.run({ force: true, actorId: user.id });
    json(res, result.ok ? 200 : 503, result); return true;
  }
  return false;
}

module.exports = { handleFeatureApi };
