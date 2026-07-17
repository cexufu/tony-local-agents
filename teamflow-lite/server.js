const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { handleFeatureApi } = require('./feature-api');
const { createReminderEngine } = require('./reminder-engine');

const PORT = Number(process.env.PORT || 7360);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'teamflow.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const sessions = new Map();

const ROLE_PERMISSIONS = {
  owner: ['team.manage', 'settings.manage', 'requirement.manage', 'task.manage', 'comment.create'],
  admin: ['team.manage', 'requirement.manage', 'task.manage', 'comment.create'],
  member: ['requirement.create', 'requirement.edit_own', 'task.manage_assigned', 'comment.create'],
  viewer: ['comment.create']
};

const now = () => new Date().toISOString();
const id = prefix => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
const clean = value => String(value ?? '').trim();
const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '';

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

function seedDatabase() {
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'teamflow123';
  const ownerId = 'usr_owner';
  const productId = 'usr_product';
  const devId = 'usr_dev';
  return {
    meta: { version: 1, createdAt: now() },
    settings: { teamName: '我们的小团队', reminderDays: 2 },
    users: [
      { id: ownerId, name: '林岚', email: 'admin@team.local', role: 'owner', title: '负责人', status: 'active', passwordHash: hashPassword(adminPassword), createdAt: now() },
      { id: productId, name: '陈默', email: 'product@team.local', role: 'admin', title: '产品经理', status: 'active', passwordHash: hashPassword('product123'), createdAt: now() },
      { id: devId, name: '周野', email: 'dev@team.local', role: 'member', title: '研发', status: 'active', passwordHash: hashPassword('dev12345'), createdAt: now() }
    ],
    requirements: [
      { id: 'req_demo', title: '上线团队内部需求管理工具', summary: '统一需求提出、评审、拆解、排期和跟进，减少信息散落。', type: 'feature', priority: 'P0', status: 'in_progress', ownerId: productId, proposerId: ownerId, targetDate: futureDate(12), progress: 45, createdAt: now(), updatedAt: now() }
    ],
    tasks: [
      { id: 'task_demo_1', requirementId: 'req_demo', title: '确定权限角色与操作边界', description: '确认负责人、管理员、成员和只读成员权限。', status: 'done', priority: 'P0', assigneeId: productId, dueDate: futureDate(-1), estimate: 4, createdBy: ownerId, createdAt: now(), updatedAt: now() },
      { id: 'task_demo_2', requirementId: 'req_demo', title: '完成需求看板与提醒列表', description: '交付可用的内部版本。', status: 'in_progress', priority: 'P0', assigneeId: devId, dueDate: futureDate(3), estimate: 12, createdBy: ownerId, createdAt: now(), updatedAt: now() }
    ],
    milestones: [
      { id: 'mile_demo', requirementId: 'req_demo', title: '内部试用', dueDate: futureDate(7), status: 'pending', createdAt: now() }
    ],
    comments: [],
    activities: [{ id: id('act'), actorId: ownerId, action: '创建了示例需求', targetType: 'requirement', targetId: 'req_demo', createdAt: now() }]
  };
}

function futureDate(offset) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seeded = seedDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2));
    return seeded;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

let db = loadDb();
function saveDb() {
  const temp = `${DB_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, `${DB_FILE}.bak`);
  fs.renameSync(temp, DB_FILE);
}

const reminderEngine = createReminderEngine({ getDb: () => db, saveDb });

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim().split('=')).filter(v => v.length === 2));
}

function getUser(req) {
  const token = parseCookies(req).teamflow_session || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) return null;
  return db.users.find(user => user.id === session.userId && user.status === 'active') || null;
}

function can(user, permission) {
  if (!user) return false;
  return (ROLE_PERMISSIONS[user.role] || []).includes(permission);
}

function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return { ...safe, permissions: ROLE_PERMISSIONS[user.role] || [] };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('请求内容过大'));
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON 格式不正确')); }
    });
  });
}

function logActivity(actorId, action, targetType, targetId) {
  db.activities.unshift({ id: id('act'), actorId, action, targetType, targetId, createdAt: now() });
  db.activities = db.activities.slice(0, 200);
}

function enrichRequirement(requirement) {
  const tasks = db.tasks.filter(task => task.requirementId === requirement.id);
  const done = tasks.filter(task => task.status === 'done').length;
  return { ...requirement, taskCount: tasks.length, completedTaskCount: done, computedProgress: tasks.length ? Math.round(done / tasks.length * 100) : requirement.progress || 0 };
}

function dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const soon = futureDate(Number(db.settings.reminderDays || 2));
  const activeRequirements = db.requirements.filter(item => !['done', 'cancelled'].includes(item.status));
  const openTasks = db.tasks.filter(item => item.status !== 'done');
  const reminders = openTasks.filter(item => item.dueDate && item.dueDate <= soon).map(item => ({ ...item, kind: item.dueDate < today ? 'overdue' : 'due_soon' }));
  const milestoneReminders = db.milestones.filter(item => item.status !== 'done' && item.dueDate <= soon).map(item => ({ ...item, kind: item.dueDate < today ? 'overdue' : 'due_soon', isMilestone: true }));
  return {
    stats: { activeRequirements: activeRequirements.length, openTasks: openTasks.length, overdue: [...reminders, ...milestoneReminders].filter(i => i.kind === 'overdue').length, teamMembers: db.users.filter(u => u.status === 'active').length },
    priorityRequirements: activeRequirements.sort((a, b) => a.targetDate.localeCompare(b.targetDate)).slice(0, 5).map(enrichRequirement),
    reminders: [...reminders, ...milestoneReminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8),
    activities: db.activities.slice(0, 8)
  };
}

function validateRequirement(body) {
  if (!clean(body.title)) return '请填写需求标题';
  if (!['P0', 'P1', 'P2', 'P3'].includes(body.priority)) return '优先级无效';
  return '';
}

function decomposeRequirement(requirement, actorId) {
  const owner = requirement.ownerId || actorId;
  const templates = [
    ['澄清需求范围与验收标准', 'todo', 4],
    ['完成方案设计与评审', 'todo', 8],
    ['开发实现与自测', 'todo', 16],
    ['联调、验收与发布', 'todo', 8]
  ];
  const base = requirement.targetDate ? new Date(`${requirement.targetDate}T12:00:00`) : new Date(Date.now() + 14 * 86400000);
  return templates.map(([title, status, estimate], index) => {
    const due = new Date(base);
    due.setDate(due.getDate() - (templates.length - 1 - index) * 2);
    return { id: id('task'), requirementId: requirement.id, title, description: `由“${requirement.title}”自动拆解，可按实际情况调整。`, status, priority: requirement.priority, assigneeId: owner, dueDate: due.toISOString().slice(0, 10), estimate, createdBy: actorId, createdAt: now(), updatedAt: now() };
  });
}

async function api(req, res, pathname) {
  if (pathname === '/api/health') return json(res, 200, { ok: true, service: 'teamflow-lite', dataWritable: fs.existsSync(DATA_DIR), reminder: reminderEngine.status() });
  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const user = db.users.find(item => item.email.toLowerCase() === clean(body.email).toLowerCase());
    if (!user || user.status !== 'active' || !verifyPassword(String(body.password || ''), user.passwordHash)) return json(res, 401, { error: '邮箱或密码不正确' });
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { userId: user.id, expiresAt: Date.now() + 7 * 86400000 });
    return json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': `teamflow_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
  }
  if (pathname === '/api/logout' && req.method === 'POST') {
    sessions.delete(parseCookies(req).teamflow_session);
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'teamflow_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  const user = getUser(req);
  if (!user) return json(res, 401, { error: '请先登录' });
  if (pathname === '/api/me') return json(res, 200, { user: publicUser(user), settings: db.settings });
  if (pathname === '/api/hub') return json(res, 200, {
    user: publicUser(user),
    aiStudioUrl: process.env.AI_STUDIO_PUBLIC_URL || '/',
    teamflowUrl: process.env.APP_PUBLIC_URL || '/teamflow/',
    teamKeyRequired: Boolean(db.settings.teamKey)
  });
  if (pathname === '/api/hub/team-access' && req.method === 'POST') {
    const body = await readBody(req);
    const supplied = clean(body.teamKey);
    const expected = String(db.settings.teamKey || '');
    if (expected && (supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))) {
      return json(res, 403, { error: 'Team Key invalid.' });
    }
    const token = parseCookies(req).teamflow_session;
    const session = sessions.get(token);
    if (session) session.teamAccess = true;
    return json(res, 200, { ok: true });
  }
  if (pathname === '/api/dashboard') return json(res, 200, dashboard());
  const featureHandled = await handleFeatureApi({ req, res, pathname, user, db, json, readBody, can, clean, id, now, dateOnly, hashPassword, publicUser, enrichRequirement, logActivity, saveDb, reminderEngine });
  if (featureHandled) return;
  if (pathname === '/api/users' && req.method === 'GET') return json(res, 200, { users: db.users.map(publicUser) });
  if (pathname === '/api/users' && req.method === 'POST') {
    if (!can(user, 'team.manage')) return json(res, 403, { error: '没有成员管理权限' });
    const body = await readBody(req);
    if (!clean(body.name) || !/^\S+@\S+\.\S+$/.test(clean(body.email))) return json(res, 400, { error: '请填写姓名和有效邮箱' });
    if (db.users.some(item => item.email.toLowerCase() === clean(body.email).toLowerCase())) return json(res, 409, { error: '邮箱已存在' });
    if (!['admin', 'member', 'viewer'].includes(body.role)) return json(res, 400, { error: '角色无效' });
    const member = { id: id('usr'), name: clean(body.name), email: clean(body.email).toLowerCase(), title: clean(body.title), role: body.role, status: 'active', passwordHash: hashPassword(String(body.password || 'welcome123')), createdAt: now() };
    db.users.push(member); logActivity(user.id, `添加了成员 ${member.name}`, 'user', member.id); saveDb();
    return json(res, 201, { user: publicUser(member), temporaryPassword: body.password ? undefined : 'welcome123' });
  }
  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && req.method === 'PATCH') {
    if (!can(user, 'team.manage')) return json(res, 403, { error: '没有成员管理权限' });
    const member = db.users.find(item => item.id === userMatch[1]);
    if (!member) return json(res, 404, { error: '成员不存在' });
    const body = await readBody(req);
    if (member.role === 'owner' && body.role && body.role !== 'owner') return json(res, 400, { error: '负责人角色不能直接降级' });
    if (body.role && ['admin', 'member', 'viewer'].includes(body.role)) member.role = body.role;
    if (body.status && ['active', 'disabled'].includes(body.status) && member.id !== user.id) member.status = body.status;
    if (body.title !== undefined) member.title = clean(body.title);
    logActivity(user.id, `更新了成员 ${member.name} 的权限`, 'user', member.id); saveDb();
    return json(res, 200, { user: publicUser(member) });
  }

  if (pathname === '/api/requirements' && req.method === 'GET') return json(res, 200, { requirements: db.requirements.map(enrichRequirement) });
  if (pathname === '/api/requirements' && req.method === 'POST') {
    if (!can(user, 'requirement.manage') && !can(user, 'requirement.create')) return json(res, 403, { error: '没有创建需求权限' });
    const body = await readBody(req); const error = validateRequirement(body);
    if (error) return json(res, 400, { error });
    const item = { id: id('req'), title: clean(body.title), summary: clean(body.summary), type: body.type || 'feature', priority: body.priority, status: body.status || 'draft', ownerId: body.ownerId || user.id, proposerId: user.id, targetDate: dateOnly(body.targetDate), progress: 0, createdAt: now(), updatedAt: now() };
    db.requirements.unshift(item); logActivity(user.id, `提出了需求“${item.title}”`, 'requirement', item.id); saveDb();
    return json(res, 201, { requirement: enrichRequirement(item) });
  }
  const reqMatch = pathname.match(/^\/api\/requirements\/([^/]+)$/);
  if (reqMatch && req.method === 'GET') {
    const item = db.requirements.find(r => r.id === reqMatch[1]);
    if (!item) return json(res, 404, { error: '需求不存在' });
    return json(res, 200, { requirement: enrichRequirement(item), tasks: db.tasks.filter(t => t.requirementId === item.id), milestones: db.milestones.filter(m => m.requirementId === item.id), comments: db.comments.filter(c => c.targetId === item.id) });
  }
  if (reqMatch && req.method === 'PATCH') {
    const item = db.requirements.find(r => r.id === reqMatch[1]);
    if (!item) return json(res, 404, { error: '需求不存在' });
    if (!can(user, 'requirement.manage') && !(can(user, 'requirement.edit_own') && item.proposerId === user.id)) return json(res, 403, { error: '没有编辑该需求的权限' });
    const body = await readBody(req);
    ['title', 'summary', 'type', 'priority', 'status', 'ownerId'].forEach(key => { if (body[key] !== undefined) item[key] = clean(body[key]); });
    if (body.targetDate !== undefined) item.targetDate = dateOnly(body.targetDate);
    item.updatedAt = now(); logActivity(user.id, `更新了需求“${item.title}”`, 'requirement', item.id); saveDb();
    return json(res, 200, { requirement: enrichRequirement(item) });
  }
  const decomposeMatch = pathname.match(/^\/api\/requirements\/([^/]+)\/decompose$/);
  if (decomposeMatch && req.method === 'POST') {
    if (!can(user, 'requirement.manage')) return json(res, 403, { error: '仅管理员可以自动拆解' });
    const requirement = db.requirements.find(r => r.id === decomposeMatch[1]);
    if (!requirement) return json(res, 404, { error: '需求不存在' });
    if (db.tasks.some(t => t.requirementId === requirement.id)) return json(res, 409, { error: '该需求已有任务，请先手动调整' });
    const tasks = decomposeRequirement(requirement, user.id); db.tasks.push(...tasks); requirement.status = 'planned'; requirement.updatedAt = now();
    logActivity(user.id, `自动拆解了需求“${requirement.title}”`, 'requirement', requirement.id); saveDb();
    return json(res, 201, { tasks });
  }

  if (pathname === '/api/tasks' && req.method === 'GET') return json(res, 200, { tasks: db.tasks });
  if (pathname === '/api/tasks' && req.method === 'POST') {
    if (!can(user, 'task.manage')) return json(res, 403, { error: '没有创建任务权限' });
    const body = await readBody(req);
    if (!clean(body.title)) return json(res, 400, { error: '请填写任务标题' });
    const task = { id: id('task'), requirementId: body.requirementId || '', title: clean(body.title), description: clean(body.description), status: body.status || 'todo', priority: body.priority || 'P2', assigneeId: body.assigneeId || '', dueDate: dateOnly(body.dueDate), estimate: Number(body.estimate || 0), createdBy: user.id, createdAt: now(), updatedAt: now() };
    db.tasks.unshift(task); logActivity(user.id, `创建了任务“${task.title}”`, 'task', task.id); saveDb(); return json(res, 201, { task });
  }
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PATCH') {
    const task = db.tasks.find(t => t.id === taskMatch[1]);
    if (!task) return json(res, 404, { error: '任务不存在' });
    if (!can(user, 'task.manage') && !(can(user, 'task.manage_assigned') && task.assigneeId === user.id)) return json(res, 403, { error: '只能更新分配给自己的任务' });
    const body = await readBody(req);
    ['title', 'description', 'status', 'priority', 'assigneeId', 'requirementId'].forEach(key => { if (body[key] !== undefined) task[key] = clean(body[key]); });
    if (body.dueDate !== undefined) task.dueDate = dateOnly(body.dueDate);
    if (body.estimate !== undefined) task.estimate = Number(body.estimate || 0);
    task.updatedAt = now(); logActivity(user.id, `${task.status === 'done' ? '完成' : '更新'}了任务“${task.title}”`, 'task', task.id); saveDb(); return json(res, 200, { task });
  }

  if (pathname === '/api/milestones' && req.method === 'POST') {
    if (!can(user, 'requirement.manage')) return json(res, 403, { error: '没有节点管理权限' });
    const body = await readBody(req);
    if (!clean(body.title) || !dateOnly(body.dueDate)) return json(res, 400, { error: '请填写节点名称和日期' });
    const milestone = { id: id('mile'), requirementId: clean(body.requirementId), title: clean(body.title), dueDate: body.dueDate, status: 'pending', createdAt: now() };
    db.milestones.push(milestone); logActivity(user.id, `创建了节点“${milestone.title}”`, 'milestone', milestone.id); saveDb(); return json(res, 201, { milestone });
  }
  if (pathname === '/api/settings' && req.method === 'PATCH') {
    if (!can(user, 'settings.manage')) return json(res, 403, { error: '仅负责人可以修改设置' });
    const body = await readBody(req);
    if (body.teamName) db.settings.teamName = clean(body.teamName);
    if (body.reminderDays !== undefined) db.settings.reminderDays = Math.max(1, Math.min(30, Number(body.reminderDays) || 2));
    if (body.teamKey !== undefined) db.settings.teamKey = clean(body.teamKey);
    saveDb(); return json(res, 200, { settings: db.settings });
  }
  return json(res, 404, { error: '接口不存在' });
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const filePath = path.resolve(PUBLIC_DIR, requested);
  if (!filePath.startsWith(path.resolve(PUBLIC_DIR)) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  try {
    if (pathname.startsWith('/api/')) await api(req, res, pathname);
    else serveStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: error.message || '服务器错误' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  reminderEngine.start();
  console.log(`TeamFlow Lite running at http://localhost:${PORT}`);
});

function shutdown() {
  reminderEngine.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { server };