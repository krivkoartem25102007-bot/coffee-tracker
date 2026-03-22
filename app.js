const API_BASE = 'http://lmpss3.dev.spsejecna.net/procedure.php';
const ENDPOINTS = {
  people: API_BASE + '?cmd=getPeopleList',
  types: API_BASE + '?cmd=getTypesList',
  save: API_BASE + '?cmd=saveDrinks'
};

const el = id => document.getElementById(id);
const usersWrap = el('users');
const typesWrap = el('types');
const drinkForm = el('drinkForm');
const statusBox = el('status');
const rememberCheckbox = el('rememberCheckbox');
const clearRemember = el('clearRemember');
const resetBtn = el('resetBtn');
const installBtn = el('installBtn');

let people = [];
let types = [];
let selectedUserId = null;
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden');
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});

function setCookie(name, value, days=365){
  const d = new Date();
  d.setTime(d.getTime() + (days*24*60*60*1000));
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/`;
}
function getCookie(name){
  const pairs = document.cookie.split(';').map(s => s.trim());
  for (const p of pairs){
    const [k,v] = p.split('=');
    if (decodeURIComponent(k) === name) return decodeURIComponent(v || '');
  }
  return null;
}
function saveRemember(userId){
  localStorage.setItem('kava_user', userId);
  sessionStorage.setItem('kava_user_session', userId);
  setCookie('kava_user', userId, 365);
}
function clearRememberAll(){
  localStorage.removeItem('kava_user');
  sessionStorage.removeItem('kava_user_session');
  setCookie('kava_user', '', -1);
}

function showStatus(msg, ok=true){
  statusBox.textContent = msg;
  statusBox.classList.remove('hidden');
  statusBox.style.borderLeft = ok ? '4px solid #10b981' : '4px solid #ef4444';
  setTimeout(()=> statusBox.classList.add('hidden'), 3000);
}

function createUserButtons(){
  usersWrap.innerHTML = '';
  people.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'userBtn';
    btn.textContent = p.name || p;
    btn.dataset.id = p.id ?? p;
    btn.addEventListener('click', () => {
      selectUser(btn.dataset.id);
    });
    usersWrap.appendChild(btn);
  });

  const remembered = sessionStorage.getItem('kava_user_session') || localStorage.getItem('kava_user') || getCookie('kava_user');
  if (remembered) selectUser(remembered);
}

function selectUser(id){
  selectedUserId = String(id);
  Array.from(usersWrap.children).forEach(b => {
    b.classList.toggle('active', b.dataset.id === String(id));
  });
  sessionStorage.setItem('kava_user_session', selectedUserId);
  rememberCheckbox.checked = !!localStorage.getItem('kava_user') || !!getCookie('kava_user');
  if (rememberCheckbox.checked) saveRemember(selectedUserId);
}

function createTypeControls(){
  typesWrap.innerHTML = '';
  types.forEach(t => {
    const row = document.createElement('div');
    row.className = 'typeRow';
    const idSafe = 'type_' + t.name.replace(/\s+/g,'_').replace(/[^\w\-]/g,'');
    row.innerHTML = `
      <div class="labelRow">
        <div class="typeName">${t.name}</div>
        <div class="counter" id="${idSafe}_count">0</div>
      </div>
      <input type="range" min="0" max="10" value="0" class="range" id="${idSafe}" data-type="${t.name}">
    `;
    typesWrap.appendChild(row);
    const range = row.querySelector('.range');
    const counter = row.querySelector('.counter');
    range.addEventListener('input', () => {
      counter.textContent = range.value;
    });
  });
}

async function fetchJson(url, opts){
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return null;
  }
}

async function loadData(){
  const p = await fetchJson(ENDPOINTS.people);
  if (p && Array.isArray(p)) {
    people = p.map(item => {
      if (typeof item === 'object') return { id: item.id ?? item.value, name: item.name ?? item.label };
      return { id: item, name: item };
    });
  } else {
    people = [
      {id:'1', name:'Masopust Lukáš'},
      {id:'2', name:'Molič Jan'},
      {id:'3', name:'Adamek Daniel'},
      {id:'4', name:'Weber David'}
    ];
  }

  const t = await fetchJson(ENDPOINTS.types);
  if (t && Array.isArray(t)) {
    types = t.map(item => {
      if (typeof item === 'object') return { name: item.name ?? item.label };
      return { name: item };
    });
  } else {
    types = [
      {name:'Mléko'},
      {name:'Espresso'},
      {name:'Coffe'},
      {name:'Long'},
      {name:'Doppio+'}
    ];
  }

  createUserButtons();
  createTypeControls();
}

drinkForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!selectedUserId) { showStatus('Vyberte uživatele', false); return; }

  const drinks = Array.from(typesWrap.querySelectorAll('.range')).map(r => {
    return { type: r.dataset.type, value: Number(r.value) };
  });

  const payload = { user: String(selectedUserId), drinks: drinks };

  try {
    const res = await fetch(ENDPOINTS.save, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error();
    showStatus('Odesláno');
    if (rememberCheckbox.checked) saveRemember(selectedUserId);
    return;
  } catch {}

  try {
    const form = new URLSearchParams();
    drinks.forEach(d => form.append('type[]', d.value));
    form.append('user', String(selectedUserId));
    const res2 = await fetch(ENDPOINTS.save, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    if (!res2.ok) throw new Error();
    showStatus('Odesláno');
    if (rememberCheckbox.checked) saveRemember(selectedUserId);
  } catch {
    showStatus('Chyba', false);
  }
});

resetBtn.addEventListener('click', () => {
  Array.from(typesWrap.querySelectorAll('.range')).forEach(r => { r.value = 0; r.dispatchEvent(new Event('input')); });
  showStatus('Reset');
});

rememberCheckbox.addEventListener('change', () => {
  if (rememberCheckbox.checked && selectedUserId) saveRemember(selectedUserId);
  if (!rememberCheckbox.checked) clearRememberAll();
});
clearRemember.addEventListener('click', () => {
  clearRememberAll();
  rememberCheckbox.checked = false;
  showStatus('Smazáno');
});

(async function init(){
  await loadData();
  const sess = sessionStorage.getItem('kava_user_session');
  if (sess) selectUser(sess);
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
