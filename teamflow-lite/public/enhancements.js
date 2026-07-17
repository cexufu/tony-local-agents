let requirementAnalysisResult = null;

(function installEnhancements() {
  const requirementButton = document.querySelector('#nav [data-page="requirements"]');
  if (requirementButton && !document.querySelector('#nav [data-page="analysis"]')) {
    const button = document.createElement('button');
    button.dataset.page = 'analysis';
    button.innerHTML = '<span data-icon="search"></span><span>\u9700\u6c42\u5206\u6790</span>';
    requirementButton.insertAdjacentElement('afterend', button);
    hydrateIcons(button);
  }
  const taskButton = document.querySelector('#nav [data-page="tasks"]');
  if (taskButton && !document.querySelector('#nav [data-page="tracking"]')) {
    const button = document.createElement('button');
    button.dataset.page = 'tracking';
    button.innerHTML = '<span data-icon="bell"></span><span>\u63d0\u9192\u8ffd\u8e2a</span>';
    taskButton.insertAdjacentElement('afterend', button);
    hydrateIcons(button);
  }
  const baseNavigate = navigate;
  navigate = function enhancedNavigate(page) {
    if (page === 'tracking') {
      state.page = page;
      document.querySelector('.sidebar').classList.remove('open');
      document.querySelectorAll('#nav button').forEach(button => button.classList.toggle('active', button.dataset.page === page));
      document.querySelector('#pageTitle').textContent = '\u63d0\u9192\u8ffd\u8e2a';
      renderReminderTracking();
      return;
    }
    if (page !== 'analysis') return baseNavigate(page);
    state.page = page;
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelectorAll('#nav button').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    document.querySelector('#pageTitle').textContent = '\u9700\u6c42\u5206\u6790';
    renderRequirementAnalysis();
  };

  renderTeam = function enhancedTeam() {
    const editable = can('team.manage');
    $('#content').innerHTML = `<div class="section-head"><div><h2>\u56e2\u961f\u6210\u5458</h2><p>\u7ba1\u7406\u6210\u5458\u8d44\u6599\u3001\u8d26\u53f7\u72b6\u6001\u548c\u8bbf\u95ee\u6743\u9650\u3002</p></div>${editable ? '<button class="btn primary" id="newMember"><span>+</span> \u6dfb\u52a0\u6210\u5458</button>' : ''}</div>
      <div class="member-summary"><span><b>${state.users.filter(u => u.status === 'active').length}</b> \u4f4d\u6d3b\u8dc3\u6210\u5458</span><span><b>${state.users.filter(u => ['owner','admin'].includes(u.role)).length}</b> \u4f4d\u7ba1\u7406\u8005</span><span><b>${state.users.filter(u => u.status === 'disabled').length}</b> \u4e2a\u5df2\u505c\u7528\u8d26\u53f7</span></div>
      <div class="member-grid">${state.users.map(member => `<article class="member-card ${member.status === 'disabled' ? 'member-disabled' : ''}"><div class="member-card-head">${avatar(member.name)}<div class="member-card-actions">${member.status === 'disabled' ? '<span class="status-pill">\u5df2\u505c\u7528</span>' : '<span class="status-pill in_progress">\u6b63\u5e38</span>'}${editable ? `<button class="more-btn" data-edit-member="${member.id}" title="\u7f16\u8f91">...</button>` : ''}</div></div><h3>${escapeHtml(member.name)}</h3><p>${escapeHtml(member.title || '\u672a\u8bbe\u7f6e\u5c97\u4f4d')}</p><div class="member-contact">${escapeHtml(member.email)}</div><div class="member-meta"><span class="role-select">${labels.role[member.role]}</span><small>${member.role === 'owner' ? '\u6700\u9ad8\u6743\u9650' : member.role === 'admin' ? '\u6210\u5458\u3001\u9700\u6c42\u4e0e\u4efb\u52a1\u7ba1\u7406' : member.role === 'member' ? '\u63d0\u9700\u6c42\u4e0e\u66f4\u65b0\u672c\u4eba\u4efb\u52a1' : '\u4ec5\u67e5\u770b'}</small></div></article>`).join('')}</div>`;
    if ($('#newMember')) $('#newMember').onclick = openMemberForm;
    $$('[data-edit-member]').forEach(button => button.onclick = () => openMemberEditor(button.dataset.editMember));
  };
})();

function openMemberEditor(memberId) {
  const member = state.users.find(item => item.id === memberId);
  if (!member) return;
  const isOwner = member.role === 'owner';
  openModal(`<p class="eyebrow">Member profile</p><h2>\u7f16\u8f91\u6210\u5458</h2><p class="modal-desc">\u4fee\u6539\u8d44\u6599\u3001\u89d2\u8272\u6216\u8d26\u53f7\u72b6\u6001\u3002</p><form id="memberEditForm" class="form-grid"><label>\u59d3\u540d<input name="name" value="${escapeHtml(member.name)}" required></label><label>\u5c97\u4f4d<input name="title" value="${escapeHtml(member.title || '')}"></label><label class="full">\u5de5\u4f5c\u90ae\u7bb1<input type="email" name="email" value="${escapeHtml(member.email)}" required></label><label>\u89d2\u8272<select name="role" ${isOwner ? 'disabled' : ''}>${options([['owner','\u8d1f\u8d23\u4eba'],['admin','\u7ba1\u7406\u5458'],['member','\u6210\u5458'],['viewer','\u53ea\u8bfb\u6210\u5458']], member.role)}</select></label><label>\u8d26\u53f7\u72b6\u6001<select name="status" ${(member.id === state.me.id || isOwner) ? 'disabled' : ''}>${options([['active','\u6b63\u5e38'],['disabled','\u505c\u7528']], member.status)}</select></label><label class="full">\u91cd\u7f6e\u5bc6\u7801<input type="password" name="password" placeholder="\u4e0d\u4fee\u6539\u8bf7\u7559\u7a7a\uff0c\u81f3\u5c11 8 \u4f4d"></label><div class="modal-actions full member-edit-actions">${!isOwner && member.id !== state.me.id ? `<button type="button" class="btn danger" id="deleteMember">\u5220\u9664\u6210\u5458</button>` : '<span></span>'}<div><button type="button" class="btn secondary" data-close>\u53d6\u6d88</button> <button class="btn primary">\u4fdd\u5b58\u4fee\u6539</button></div></div></form>`);
  $('[data-close]').onclick = closeModal;
  $('#memberEditForm').onsubmit = async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (body.password && body.password.length < 8) return toast('\u65b0\u5bc6\u7801\u81f3\u5c11 8 \u4f4d');
    if (isOwner) delete body.role;
    if (member.id === state.me.id || isOwner) delete body.status;
    try { await api(`/api/users/${member.id}`, { method: 'PATCH', body: JSON.stringify(body) }); closeModal(); await refresh('team'); toast('\u6210\u5458\u4fe1\u606f\u5df2\u66f4\u65b0'); } catch (error) { toast(error.message); }
  };
  if ($('#deleteMember')) $('#deleteMember').onclick = () => deleteMember(member);
}

async function deleteMember(member) {
  if (!confirm(`\u786e\u5b9a\u5220\u9664\u6210\u5458\u201c${member.name}\u201d\u5417\uff1f`)) return;
  try {
    await api(`/api/users/${member.id}`, { method: 'DELETE', body: '{}' });
    closeModal(); await refresh('team'); toast('\u6210\u5458\u5df2\u5220\u9664');
  } catch (error) {
    if (!/\u63a5\u624b\u6210\u5458/.test(error.message)) return toast(error.message);
    openTransferDialog(member, error.message);
  }
}

function openTransferDialog(member, detail) {
  const candidates = state.users.filter(item => item.id !== member.id && item.status === 'active');
  openModal(`<p class="eyebrow">Transfer ownership</p><h2>\u5148\u8f6c\u79fb\u5de5\u4f5c</h2><p class="modal-desc">${escapeHtml(detail)}\u3002\u5220\u9664\u540e\uff0c\u5173\u8054\u5de5\u4f5c\u5c06\u8f6c\u7ed9\u65b0\u8d1f\u8d23\u4eba\u3002</p><form id="transferForm" class="form-grid"><label class="full">\u63a5\u624b\u6210\u5458<select name="transferToUserId">${candidates.map(item => `<option value="${item.id}">${escapeHtml(item.name)} \u00b7 ${labels.role[item.role]}</option>`).join('')}</select></label><div class="modal-actions full"><button type="button" class="btn secondary" data-close>\u53d6\u6d88</button><button class="btn danger">\u8f6c\u79fb\u5e76\u5220\u9664</button></div></form>`);
  $('[data-close]').onclick = closeModal;
  $('#transferForm').onsubmit = async event => { event.preventDefault(); try { await api(`/api/users/${member.id}`, { method: 'DELETE', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); closeModal(); await refresh('team'); toast('\u5de5\u4f5c\u5df2\u8f6c\u79fb\uff0c\u6210\u5458\u5df2\u5220\u9664'); } catch (error) { toast(error.message); } };
}

function renderRequirementAnalysis() {
  $('#content').innerHTML = `<div class="analysis-hero"><div><p class="eyebrow">Requirement intelligence</p><h2>\u628a\u4e00\u6bb5\u60f3\u6cd5\uff0c\u53d8\u6210\u53ef\u6267\u884c\u7684\u9700\u6c42</h2><p>\u7ed3\u6784\u5316\u76ee\u6807\u3001\u7528\u6237\u6545\u4e8b\u3001\u9a8c\u6536\u6807\u51c6\u3001\u98ce\u9669\u548c\u4efb\u52a1\u3002</p></div><span class="analysis-badge">AI + \u672c\u5730\u89c4\u5219</span></div><section class="analysis-input-card"><form id="analysisForm"><label>\u7c98\u8d34\u539f\u59cb\u9700\u6c42\u3001\u4f1a\u8bae\u8bb0\u5f55\u6216\u5ba2\u6237\u53cd\u9988<textarea id="rawRequirement" name="rawText" required placeholder="\u4f8b\u5982\uff1a\u6211\u4eec\u9700\u8981\u4e00\u4e2a\u5185\u90e8\u9700\u6c42\u7ba1\u7406\u5de5\u5177\uff0c\u4e0d\u540c\u6210\u5458\u6709\u4e0d\u540c\u6743\u9650\uff0c\u9700\u6c42\u8981\u80fd\u62c6\u89e3\u4efb\u52a1\u5e76\u5728\u5230\u671f\u524d\u63d0\u9192...">${escapeHtml(sessionStorage.getItem('analysisDraft') || '')}</textarea></label><div class="analysis-actions"><span>\u5185\u5bb9\u53ea\u7528\u4e8e\u672c\u6b21\u5206\u6790</span><button class="btn primary" id="analyzeButton">\u5f00\u59cb\u5206\u6790 <b>\u2192</b></button></div></form></section><div id="analysisResult">${requirementAnalysisResult ? renderAnalysisResult(requirementAnalysisResult) : '<div class="analysis-empty"><span>\u2726</span><h3>\u5206\u6790\u7ed3\u679c\u5c06\u663e\u793a\u5728\u8fd9\u91cc</h3><p>\u5efa\u8bae\u81f3\u5c11\u63cf\u8ff0\u4f7f\u7528\u4eba\u3001\u8981\u89e3\u51b3\u7684\u95ee\u9898\u548c\u671f\u671b\u7ed3\u679c\u3002</p></div>'}</div>`;
  $('#analysisForm').onsubmit = runRequirementAnalysis;
  if ($('#convertAnalysis')) $('#convertAnalysis').onclick = openAnalysisConversion;
}

async function runRequirementAnalysis(event) {
  event.preventDefault();
  const rawText = $('#rawRequirement').value.trim();
  sessionStorage.setItem('analysisDraft', rawText);
  const button = $('#analyzeButton'); button.disabled = true; button.textContent = '\u6b63\u5728\u5206\u6790...';
  try { const result = await api('/api/requirement-analysis', { method: 'POST', body: JSON.stringify({ rawText }) }); requirementAnalysisResult = result.analysis; $('#analysisResult').innerHTML = renderAnalysisResult(result.analysis); $('#convertAnalysis').onclick = openAnalysisConversion; toast(result.analysis.source === 'model' ? '\u5df2\u5b8c\u6210 AI \u9700\u6c42\u5206\u6790' : '\u5df2\u5b8c\u6210\u672c\u5730\u9700\u6c42\u5206\u6790'); } catch (error) { toast(error.message); } finally { button.disabled = false; button.innerHTML = '\u91cd\u65b0\u5206\u6790 <b>\u2192</b>'; }
}

function analysisList(title, items, className = '') {
  return `<section class="analysis-section ${className}"><h3>${title}<span>${items.length}</span></h3><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
}

function renderAnalysisResult(result) {
  return `<section class="analysis-result-head"><div><span class="priority ${result.suggestedPriority}">${result.suggestedPriority}</span><small>${result.source === 'model' ? 'AI \u6a21\u578b\u5206\u6790' : '\u672c\u5730\u7ed3\u6784\u5316\u5206\u6790'}</small><h2>${escapeHtml(result.title)}</h2><p>${escapeHtml(result.problem)}</p></div><button class="btn primary" id="convertAnalysis">\u8f6c\u4e3a\u6b63\u5f0f\u9700\u6c42</button></section><div class="analysis-result-grid">${analysisList('\u9700\u6c42\u76ee\u6807', result.goals, 'accent')}${analysisList('\u9a8c\u6536\u6807\u51c6', result.acceptanceCriteria)}${analysisList('\u7528\u6237\u6545\u4e8b', result.userStories)}${analysisList('\u98ce\u9669\u4e0e\u4f9d\u8d56', result.risks, 'warning')}${analysisList('\u5f85\u6f84\u6e05\u95ee\u9898', result.questions)}${analysisList('\u5efa\u8bae\u4efb\u52a1', result.tasks)}</div>`;
}

function openAnalysisConversion() {
  const result = requirementAnalysisResult;
  if (!result) return;
  openModal(`<p class="eyebrow">Create requirement</p><h2>\u8f6c\u4e3a\u6b63\u5f0f\u9700\u6c42</h2><p class="modal-desc">\u540c\u65f6\u751f\u6210 ${result.tasks.length} \u4e2a\u5efa\u8bae\u4efb\u52a1\uff0c\u521b\u5efa\u540e\u53ef\u7ee7\u7eed\u8c03\u6574\u3002</p><form id="analysisConvertForm" class="form-grid"><label>\u8d1f\u8d23\u4eba<select name="ownerId">${state.users.filter(u => u.status === 'active').map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}</select></label><label>\u4f18\u5148\u7ea7<select name="priority">${options([['P0','P0'],['P1','P1'],['P2','P2'],['P3','P3']], result.suggestedPriority)}</select></label><label>\u9700\u6c42\u7c7b\u578b<select name="type">${options(Object.entries(labels.type))}</select></label><label>\u76ee\u6807\u65e5\u671f<input type="date" name="targetDate"></label><div class="modal-actions full"><button type="button" class="btn secondary" data-close>\u53d6\u6d88</button><button class="btn primary">\u521b\u5efa\u9700\u6c42\u548c\u4efb\u52a1</button></div></form>`);
  $('[data-close]').onclick = closeModal;
  $('#analysisConvertForm').onsubmit = async event => { event.preventDefault(); const body = { ...Object.fromEntries(new FormData(event.currentTarget)), analysis: result }; try { const created = await api('/api/requirement-analysis/convert', { method: 'POST', body: JSON.stringify(body) }); requirementAnalysisResult = null; sessionStorage.removeItem('analysisDraft'); closeModal(); await loadCore(); navigate('requirements'); toast(`\u9700\u6c42\u5df2\u521b\u5efa\uff0c\u540c\u65f6\u751f\u6210 ${created.tasks.length} \u4e2a\u4efb\u52a1`); } catch (error) { toast(error.message); } };
}

async function renderReminderTracking() {
  $('#content').innerHTML = '<div class="tracking-loading">\u6b63\u5728\u8bfb\u53d6\u63d0\u9192\u72b6\u6001...</div>';
  try {
    const data = await api('/api/reminders/tracking');
    const channelReady = data.scheduler.feishu || data.scheduler.generic;
    const statusText = channelReady ? (data.scheduler.feishu ? '\u98de\u4e66 Webhook \u5df2\u8fde\u63a5' : '\u901a\u7528 Webhook \u5df2\u8fde\u63a5') : '\u672a\u914d\u7f6e\u4e3b\u52a8\u63d0\u9192\u901a\u9053';
    $('#content').innerHTML = `<div class="section-head"><div><h2>\u63d0\u9192\u4e0e\u8ffd\u8e2a</h2><p>\u670d\u52a1\u7aef\u6bcf 15 \u5206\u949f\u68c0\u67e5\uff0c\u6bcf\u5929 ${data.scheduler.reminderHour}:00 \u6309 ${escapeHtml(data.scheduler.timeZone)} \u65f6\u533a\u4e3b\u52a8\u63a8\u9001\u3002</p></div>${can('settings.manage') ? '<button class="btn primary" id="runReminders">\u7acb\u5373\u68c0\u67e5\u5e76\u63a8\u9001</button>' : ''}</div>
      <section class="tracking-status ${channelReady ? 'ready' : 'warning'}"><span class="tracking-status-icon">${channelReady ? '\u2713' : '!'}</span><div><strong>${statusText}</strong><p>${channelReady ? '\u5230\u671f\u548c\u903e\u671f\u4e8b\u9879\u4f1a\u4e3b\u52a8\u63a8\u9001\uff0c\u540c\u4e00\u4e8b\u9879\u6bcf\u5929\u6700\u591a\u6210\u529f\u53d1\u9001\u4e00\u6b21\u3002' : '\u4ea7\u54c1\u5185\u4f1a\u7ee7\u7eed\u663e\u793a\u63d0\u9192\uff1b\u8981\u4e3b\u52a8\u901a\u77e5\uff0c\u8bf7\u5728\u7ebf\u4e0a\u73af\u5883\u914d\u7f6e FEISHU_REMINDER_WEBHOOK\u3002'}</p></div><small>\u4e0a\u6b21\u68c0\u67e5\uff1a${data.scheduler.lastCheckAt ? new Date(data.scheduler.lastCheckAt).toLocaleString('zh-CN') : '\u5c1a\u672a\u6267\u884c'}</small></section>
      <div class="tracking-grid"><section class="panel"><div class="panel-head"><h3>\u5f53\u524d\u5f85\u8ddf\u8fdb</h3><span class="count">${data.pending.length}</span></div>${data.pending.length ? data.pending.map(item => `<div class="tracking-item"><span class="reminder-dot ${item.state}" data-icon="${item.state === 'overdue' ? 'alert' : 'clock'}"></span><div><strong>${escapeHtml(item.title)}</strong><p>${item.type === 'milestone' ? '\u65f6\u95f4\u8282\u70b9' : '\u56e2\u961f\u4efb\u52a1'} \u00b7 ${escapeHtml(item.requirementTitle || '\u672a\u5173\u8054\u9700\u6c42')}</p></div><small>${item.state === 'overdue' ? '\u5df2\u903e\u671f' : '\u5373\u5c06\u5230\u671f'}<br>${escapeHtml(item.dueDate)}</small></div>`).join('') : '<div class="empty">\u6682\u65e0\u5230\u671f\u6216\u903e\u671f\u4e8b\u9879</div>'}</section>
      <section class="panel"><div class="panel-head"><h3>\u53d1\u9001\u8bb0\u5f55</h3><span class="count">${data.deliveries.length}</span></div>${data.deliveries.length ? data.deliveries.map(log => `<div class="delivery-item"><span class="delivery-state ${log.status}">${log.status === 'sent' ? '\u5df2\u53d1\u9001' : log.status === 'partial' ? '\u90e8\u5206\u6210\u529f' : '\u5931\u8d25'}</span><div><strong>${log.itemCount || 0} \u4e2a\u4e8b\u9879</strong><p>${(log.channels || []).join(' + ') || escapeHtml(log.error || '\u65e0\u901a\u9053')}</p></div><small>${new Date(log.createdAt).toLocaleString('zh-CN')}</small></div>`).join('') : '<div class="empty">\u8fd8\u6ca1\u6709\u53d1\u9001\u8bb0\u5f55</div>'}</section></div>`;
    hydrateIcons($('#content'));
    if ($('#runReminders')) $('#runReminders').onclick = async () => { const button = $('#runReminders'); button.disabled = true; button.textContent = '\u6b63\u5728\u63a8\u9001...'; try { const result = await api('/api/reminders/run', { method: 'POST', body: '{}' }); toast(result.sent ? `\u5df2\u63a8\u9001 ${result.sent} \u4e2a\u63d0\u9192` : '\u6682\u65e0\u65b0\u63d0\u9192'); renderReminderTracking(); } catch (error) { toast(error.message); renderReminderTracking(); } };
  } catch (error) { $('#content').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}