const base = new URL('.', document.baseURI).pathname.replace(/\/$/, '');
async function api(path, options = {}) { const response = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Request failed'); return data; }
function openTeamFlow() { location.href = base + '/?teamflow=1'; }
function renderTeams(teams) {
  const holder = document.querySelector('#teamMembership');
  if (!teams?.length) { holder.textContent = ''; return; }
  holder.innerHTML = '<p class="team-list-title">\u4f60\u5df2\u52a0\u5165\u7684\u56e2\u961f</p>' + teams.map(team => '<button class="text-button team-select" data-team="' + team.id + '">' + (team.active ? '\u5f53\u524d\uff1a' : '') + team.name + '</button>').join('');
  holder.querySelectorAll('[data-team]').forEach(button => button.addEventListener('click', async () => { try { await api('/api/hub/select-team', { method: 'POST', body: JSON.stringify({ teamId: button.dataset.team }) }); openTeamFlow(); } catch (error) { document.querySelector('#teamHint').textContent = error.message; } }));
}
(async () => { try { const hub = await api('/api/hub'); document.querySelector('#welcome').textContent = hub.user.name + '\uff0c\u4f60\u7684\u4e2a\u4eba AI \u5de5\u4f5c\u533a\u5df2\u7ecf\u51c6\u5907\u597d\u3002'; document.querySelector('#openStudio').onclick = () => location.href = hub.aiStudioUrl; document.querySelector('#teamHint').textContent = '\u8f93\u5165\u56e2\u961f\u8d1f\u8d23\u4eba\u63d0\u4f9b\u7684\u9080\u8bf7\u7801\uff0c\u52a0\u5165\u5171\u4eab TeamFlow \u56e2\u961f\u3002'; renderTeams(hub.teams); } catch { location.href = base + '/'; } })();
document.querySelector('#teamAccess').addEventListener('submit', async event => { event.preventDefault(); const hint = document.querySelector('#teamHint'); try { await api('/api/hub/team-access', { method: 'POST', body: JSON.stringify({ teamKey: document.querySelector('#teamKey').value }) }); openTeamFlow(); } catch (error) { hint.textContent = error.message; } });
document.querySelector('#logout').onclick = async () => { await api('/api/logout', { method: 'POST' }); location.href = base + '/'; };

const accountModal = document.querySelector('#accountModal');
document.querySelector('#accountSettings').onclick = () => { document.querySelector('#passwordForm').reset(); document.querySelector('#passwordMessage').textContent = ''; accountModal.classList.remove('hidden'); };
document.querySelector('#closeAccount').onclick = () => accountModal.classList.add('hidden');
document.querySelector('#passwordForm').onsubmit = async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const message = document.querySelector('#passwordMessage'); if (form.get('newPassword') !== form.get('confirmPassword')) { message.textContent = '\u4e24\u6b21\u65b0\u5bc6\u7801\u4e0d\u4e00\u81f4\u3002'; return; } try { await api('/api/account/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }) }); message.textContent = '\u5bc6\u7801\u5df2\u66f4\u65b0\u3002'; setTimeout(() => accountModal.classList.add('hidden'), 700); } catch (error) { message.textContent = error.message; } };
