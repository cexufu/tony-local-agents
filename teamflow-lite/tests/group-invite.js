const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const port = 17368; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamflow-invite-test-'));
const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, INITIAL_ADMIN_PASSWORD: 'test-password' }, stdio: ['ignore', 'pipe', 'pipe'] });
function client() { let cookie = ''; return async (url, options = {}) => { const response = await fetch('http://127.0.0.1:' + port + url, { ...options, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } }); if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]; const body = await response.json(); if (!response.ok) throw new Error(response.status + ': ' + JSON.stringify(body)); return body; }; }
async function ready(request) { for (let i=0;i<30;i+=1) { try { await request('/api/health'); return; } catch { await new Promise(r=>setTimeout(r,100)); } } throw new Error('Server did not start'); }
(async () => { const owner=client(), member=client(); try {
  await ready(owner); await owner('/api/login',{method:'POST',body:JSON.stringify({email:'admin@team.local',password:'test-password'})});
  await owner('/api/settings',{method:'PATCH',body:JSON.stringify({teamName:'group001',teamKey:'group001-invite-code'})});
  await member('/api/register',{method:'POST',body:JSON.stringify({name:'Xie Qianwen',email:'xieqianwen@example.test',password:'member-password-1',teamName:'Xie Private'})});
  const before=await member('/api/hub'); if (before.teams.length !== 1 || before.teams[0].name !== 'Xie Private') throw new Error('Private workspace was not preserved');
  await member('/api/hub/team-access',{method:'POST',body:JSON.stringify({teamKey:'group001-invite-code'})});
  const after=await member('/api/hub'); if (!after.teams.some(team=>team.name==='group001' && team.active)) throw new Error('Invite did not activate group001');
  const groupMembers=await member('/api/users'); if (!groupMembers.users.some(user=>user.email==='xieqianwen@example.test' && user.role==='member')) throw new Error('Member was not added to group001');
  const privateTeam=before.teams[0]; await member('/api/hub/select-team',{method:'POST',body:JSON.stringify({teamId:privateTeam.id})}); const switched=await member('/api/hub'); if (!switched.teams.find(team=>team.id===privateTeam.id).active) throw new Error('Could not switch back to private team');
  await member('/api/account/password',{method:'POST',body:JSON.stringify({currentPassword:'member-password-1',newPassword:'member-password-2'})});
  const relogin=client(); await relogin('/api/login',{method:'POST',body:JSON.stringify({email:'xieqianwen@example.test',password:'member-password-2'})});
  const passwordHub=await relogin('/api/hub'); if (passwordHub.teams.length !== 2) throw new Error('Password change lost team membership');
  console.log('Password change test passed: account password updates without losing teams');
  console.log('Group invite test passed: private workspace plus shared group membership');
} finally { child.kill(); fs.rmSync(dataDir,{recursive:true,force:true}); } })().catch(error=>{console.error(error);process.exitCode=1;});
