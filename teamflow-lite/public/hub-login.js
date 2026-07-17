const apiBase='/teamflow/api';
async function api(path, options={}){const response=await fetch(apiBase+path,{headers:{'Content-Type':'application/json'},...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Request failed');return data;}
function show(register){document.querySelector('#loginForm').classList.toggle('hidden',register);document.querySelector('#registerForm').classList.toggle('hidden',!register);}
function message(text){document.querySelector('#message').textContent=text||'';}
document.querySelector('#showRegister').onclick=()=>show(true);document.querySelector('#showLogin').onclick=()=>show(false);
document.querySelector('#loginForm').onsubmit=async event=>{event.preventDefault();message('');try{await api('/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});location.href='/teamflow/hub.html';}catch(error){message(error.message);}};
document.querySelector('#registerForm').onsubmit=async event=>{event.preventDefault();try{await api('/register',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});location.href='/teamflow/hub.html';}catch(error){message(error.message);}};
