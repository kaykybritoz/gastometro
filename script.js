

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const CATS = {
  'mecânico':    { icon:'🔧', color:'#FF6B35', label:'Mecânico'    },
  'mercado':     { icon:'🛒', color:'#00D2FF', label:'Mercado'     },
  'restaurante': { icon:'🍽️', color:'#FFD93D', label:'Restaurante' },
  'gasolina':    { icon:'⛽', color:'#6BCB77', label:'Gasolina'    },
  'aluguel':     { icon:'🏠', color:'#C77DFF', label:'Aluguel'     },
  'farmácia':    { icon:'💊', color:'#FF8FA3', label:'Farmácia'    },
  'academia':    { icon:'💪', color:'#4CC9F0', label:'Academia'    },
  'transporte':  { icon:'🚌', color:'#F4845F', label:'Transporte'  },
  'lazer':       { icon:'🎮', color:'#98D8C8', label:'Lazer'       },
  'saúde':       { icon:'🏥', color:'#F7DC6F', label:'Saúde'       },
  'educação':    { icon:'📚', color:'#A0C4FF', label:'Educação'    },
  'roupas':      { icon:'👕', color:'#FFADAD', label:'Roupas'      },
  'pets':        { icon:'🐾', color:'#FFC6FF', label:'Pets'        },
  'viagem':      { icon:'✈️', color:'#CAFFBF', label:'Viagem'      },
  'outros':      { icon:'📦', color:'#888',    label:'Outros'      },
};
const MONTHS   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const GOAL_ICONS = ['✈️','🏠','🚗','💻','💍','📱','🎓','🏖️','⭐','🛡️','🎮','🐶'];

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let currentUser = null;
let expenses    = [];
let goals       = [];
let budget      = 5000;
let period      = 'month';
let activeTab   = 'dashboard';
let filterCat   = 'todos';
let deleteConfirmId = null;
let editingExpId    = null;
let selectedGoalIcon = '⭐';
let aiMessages  = [];
let aiLoading   = false;
let saveTimer   = null;
let areaChart   = null;
let pieChart    = null;

// ═══════════════════════════════════════════════════════
// STORAGE (localStorage-based, mirrors original's API)
// ═══════════════════════════════════════════════════════
const STORE_USERS   = 'gastometro:users';
const STORE_SESSION = 'gastometro:session';
const storeKey = uid => `gastometro:data:${uid}`;

function loadUsers()    { try{return JSON.parse(localStorage.getItem(STORE_USERS)||'[]');}catch{return[];} }
function saveUsers(u)   { localStorage.setItem(STORE_USERS, JSON.stringify(u)); }
function loadSession()  { try{return JSON.parse(localStorage.getItem(STORE_SESSION));}catch{return null;} }
function saveSession(uid){ localStorage.setItem(STORE_SESSION, JSON.stringify({uid})); }
function clearSession() { localStorage.removeItem(STORE_SESSION); }
function loadUserData(uid){ try{return JSON.parse(localStorage.getItem(storeKey(uid)));}catch{return null;} }
function saveUserData(uid,data){ localStorage.setItem(storeKey(uid), JSON.stringify(data)); }

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
const fmtBRL  = n => (n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = iso => { const d=new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const todayStr= () => new Date().toISOString().slice(0,10);
const genId   = () => Math.random().toString(36).slice(2)+Date.now().toString(36);

function hashPass(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h.toString(36);}

function guessCategory(text){
  const t=text.toLowerCase();
  for(const k of Object.keys(CATS)) if(t.includes(k)) return k;
  const map={ifood:'restaurante',uber:'transporte','99':'transporte',posto:'gasolina',supermercado:'mercado',farmacinha:'farmácia',gym:'academia',netflix:'lazer',spotify:'lazer',amazon:'outros',shein:'roupas',zara:'roupas','médico':'saúde',hospital:'saúde'};
  for(const [k,v] of Object.entries(map)) if(t.includes(k)) return v;
  return 'outros';
}
function parseInput(raw){
  const s=raw.trim();
  const m1=s.match(/^([^\d]+?)[\s:]+R?\$?\s*(\d[\d.,]*)$/i);
  const m2=s.match(/^R?\$?\s*(\d[\d.,]*)\s+(.+)$/i);
  const m3=s.match(/^([^\d]*?)(\d[\d.,]*)([^\d]*)$/);
  let desc,val;
  if(m1){desc=m1[1];val=m1[2];}
  else if(m2){val=m2[1];desc=m2[2];}
  else if(m3){desc=(m3[1]+m3[3]).trim();val=m3[2];}
  else return null;
  const v=parseFloat((val||'0').replace(/\./g,'').replace(',','.'));
  return v>0?{desc:desc.trim()||'Gasto',value:v}:null;
}

// ═══════════════════════════════════════════════════════
// DERIVED DATA
// ═══════════════════════════════════════════════════════
function getFiltered(){
  const now=new Date();
  let list=[...expenses];
  list=list.filter(e=>{
    const d=new Date(e.date);
    if(period==='week'){const ago=new Date(now-7*86400000);return d>=ago;}
    if(period==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(period==='year')  return d.getFullYear()===now.getFullYear();
    return true;
  });
  const search=document.getElementById('search-input')?.value||'';
  if(filterCat!=='todos') list=list.filter(e=>e.category===filterCat);
  if(search) list=list.filter(e=>e.desc.toLowerCase().includes(search.toLowerCase()));
  const sortBy=document.getElementById('sort-select')?.value||'date';
  list.sort((a,b)=>sortBy==='date'?new Date(b.date)-new Date(a.date):b.value-a.value);
  return list;
}
function getByCat(filtered){
  const acc={};
  filtered.forEach(e=>{acc[e.category]=(acc[e.category]||0)+e.value;});
  return Object.entries(acc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({name:CATS[k]?.label||k,value:v,color:CATS[k]?.color||'#888',key:k}));
}
function getDailyChart(filtered){
  const now=new Date();
  const days=period==='week'?7:period==='month'?30:12;
  const acc={};
  filtered.forEach(e=>{
    const d=new Date(e.date);
    const key=period==='year'?MONTHS[d.getMonth()]:`${d.getDate()}/${d.getMonth()+1}`;
    acc[key]=(acc[key]||0)+e.value;
  });
  if(period==='year') return MONTHS.map(m=>({name:m,value:acc[m]||0}));
  return Array.from({length:days},(_,i)=>{
    const d=new Date(now-(days-1-i)*86400000);
    const key=`${d.getDate()}/${d.getMonth()+1}`;
    return{name:period==='week'?WEEKDAYS[d.getDay()]:key,value:acc[key]||0};
  });
}
function getTotalMonth(){
  const now=new Date();
  return expenses.filter(e=>{const d=new Date(e.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce((s,e)=>s+e.value,0);
}

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
function switchMode(mode){
  document.getElementById('login-err').style.display='none';
  document.getElementById('form-login').style.display='none';
  document.getElementById('form-register').style.display='none';
  document.getElementById('form-google').style.display='none';
  const tabs=document.getElementById('mode-tabs');
  if(mode==='login'){
    tabs.style.display='';
    document.getElementById('form-login').style.display='';
    document.querySelectorAll('.mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode==='login'));
  } else if(mode==='register'){
    tabs.style.display='';
    document.getElementById('form-register').style.display='';
    document.querySelectorAll('.mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode==='register'));
  } else if(mode==='google-name'){
    tabs.style.display='none';
    document.getElementById('form-google').style.display='';
  }
}
function showLoginErr(msg){
  const el=document.getElementById('login-err');
  el.textContent=msg; el.style.display='';
}
function togglePass(id,btn){
  const inp=document.getElementById(id);
  inp.type=inp.type==='password'?'text':'password';
  btn.textContent=inp.type==='password'?'👁️':'🙈';
}
function doLogin(){
  const email=document.getElementById('login-email').value.trim().toLowerCase();
  const pass=document.getElementById('login-pass').value;
  if(!email||!pass){showLoginErr('Preencha e-mail e senha.');return;}
  const users=loadUsers();
  const u=users.find(u=>u.email===email);
  if(!u){showLoginErr('E-mail não encontrado.');return;}
  if(u.hash!==hashPass(pass)){showLoginErr('Senha incorreta.');return;}
  saveSession(u.id); loginUser(u);
}
function doRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const email=document.getElementById('reg-email').value.trim().toLowerCase();
  const pass=document.getElementById('reg-pass').value;
  if(!name||!email||!pass){showLoginErr('Preencha todos os campos.');return;}
  if(pass.length<6){showLoginErr('Senha mínima de 6 caracteres.');return;}
  if(!/\S+@\S+\.\S+/.test(email)){showLoginErr('E-mail inválido.');return;}
  const users=loadUsers();
  if(users.find(u=>u.email===email)){showLoginErr('E-mail já cadastrado.');return;}
  const u={id:genId(),name,email,hash:hashPass(pass),avatar:null,provider:'email',createdAt:new Date().toISOString()};
  saveUsers([...users,u]); saveSession(u.id); loginUser(u);
}
function doGoogleLogin(){
  const name=document.getElementById('google-name').value.trim();
  const email=document.getElementById('google-email').value.trim().toLowerCase();
  if(!name||!email){showLoginErr('Preencha nome e e-mail Google.');return;}
  const users=loadUsers();
  let u=users.find(u=>u.email===email&&u.provider==='google');
  if(!u){
    u={id:genId(),name,email,hash:'',avatar:`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285F4&color=fff&size=64`,provider:'google',createdAt:new Date().toISOString()};
    saveUsers([...users,u]);
  }
  saveSession(u.id); loginUser(u);
}
function loginUser(u){
  currentUser=u;
  const d=loadUserData(u.id);
  if(d){expenses=d.expenses||[];goals=d.goals||[];budget=d.budget||5000;}
  else{expenses=[];goals=[];budget=5000;}
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-screen').style.display='flex';
  initApp();
}
function doLogout(){
  clearSession(); currentUser=null; expenses=[]; goals=[]; budget=5000;
  closeModal('modal-profile');
  document.getElementById('app-screen').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  // reset login form
  document.getElementById('login-email').value='';
  document.getElementById('login-pass').value='';
  document.getElementById('login-err').style.display='none';
  switchMode('login');
}

// ═══════════════════════════════════════════════════════
// APP INIT
// ═══════════════════════════════════════════════════════
function initApp(){
  // topbar avatar
  const initials=currentUser.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('topbar-avatar-initials').textContent=initials;
  // AI sub
  document.getElementById('ai-sub').textContent=`Olá, ${currentUser.name.split(' ')[0]}! Conheço seus gastos. Pergunte à vontade.`;
  // populate selects
  populateCatSelects();
  // budget presets
  const presetsEl=document.getElementById('budget-presets');
  [2000,3000,5000,8000,10000].forEach(v=>{
    const btn=document.createElement('button');
    btn.className='btn-preset'; btn.textContent=fmtBRL(v);
    btn.onclick=()=>{budget=v;closeModal('modal-budget');updateBudgetBtn();autoSave();showToast(`Orçamento: ${fmtBRL(v)}`);}
    presetsEl.appendChild(btn);
  });
  // icon picker
  const picker=document.getElementById('icon-picker');
  GOAL_ICONS.forEach(ic=>{
    const btn=document.createElement('button');
    btn.className='icon-btn'+(ic==='⭐'?' active':'');
    btn.textContent=ic;
    btn.onclick=()=>{selectedGoalIcon=ic;document.querySelectorAll('.icon-btn').forEach(b=>b.classList.toggle('active',b.textContent===ic));};
    picker.appendChild(btn);
  });
  // add-date default
  document.getElementById('add-date').value=todayStr();
  updateBudgetBtn();
  // ai input watcher
  document.getElementById('ai-input').addEventListener('input',()=>{
    const v=document.getElementById('ai-input').value.trim();
    const btn=document.getElementById('btn-send');
    btn.className='btn-send '+(v&&!aiLoading?'active':'inactive');
  });
  renderAll();
}

function populateCatSelects(){
  ['add-category','edit-category'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel) return;
    sel.innerHTML='';
    Object.entries(CATS).forEach(([k,v])=>{
      const opt=document.createElement('option');
      opt.value=k; opt.textContent=`${v.icon} ${v.label}`; sel.appendChild(opt);
    });
  });
}

function updateBudgetBtn(){
  document.getElementById('btn-budget-open').textContent=`Orçamento: ${fmtBRL(budget)}`;
  document.getElementById('budget-max-label').textContent=fmtBRL(budget);
  document.getElementById('budget-input').value=budget;
}

// ═══════════════════════════════════════════════════════
// AUTO SAVE
// ═══════════════════════════════════════════════════════
function autoSave(){
  if(!currentUser) return;
  clearTimeout(saveTimer);
  const badge=document.getElementById('saving-badge');
  badge.style.display='';
  saveTimer=setTimeout(()=>{
    saveUserData(currentUser.id,{expenses,goals,budget});
    badge.style.display='none';
  },600);
}

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function setTab(tab){
  activeTab=tab;
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='dashboard') renderDashboard();
}
function setPeriod(p){
  period=p;
  document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===p));
  renderAll();
}

// ═══════════════════════════════════════════════════════
// RENDER ALL
// ═══════════════════════════════════════════════════════
function renderAll(){
  renderDashboard();
  renderGastos();
  renderMetas();
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
function renderDashboard(){
  const filtered=getFiltered();
  const total=filtered.reduce((s,e)=>s+e.value,0);
  const totalMonth=getTotalMonth();
  const budgetLeft=budget-totalMonth;
  const budgetPct=Math.min((totalMonth/budget)*100,100);
  const budgetColor=budgetPct>90?'#FF4757':budgetPct>70?'#FFA502':'#2ED573';
  const recurring=expenses.filter(e=>e.recurring);
  const topExpense=filtered.reduce((a,b)=>b.value>a.value?b:a,{value:0});
  const byCat=getByCat(filtered);
  const dailyData=getDailyChart(filtered);

  // stat cards
  const statEl=document.getElementById('stat-cards');
  statEl.innerHTML=`
    <div class="stat-card">
      <div class="stat-card-top"><p class="stat-label">Total gasto</p><span class="stat-icon">💸</span></div>
      <p class="stat-value" style="color:#FF6B35;">${fmtBRL(total)}</p>
      <p class="stat-sub">${filtered.length} transações</p>
    </div>
    <div class="stat-card">
      <div class="stat-card-top"><p class="stat-label">Saldo livre</p><span class="stat-icon">🏦</span></div>
      <p class="stat-value" style="color:${budgetColor};">${fmtBRL(budgetLeft)}</p>
      <p class="stat-sub">${(100-budgetPct).toFixed(0)}% do orçamento</p>
    </div>
    <div class="stat-card">
      <div class="stat-card-top"><p class="stat-label">Maior gasto</p><span class="stat-icon">📌</span></div>
      <p class="stat-value" style="color:#C77DFF;">${fmtBRL(topExpense.value)}</p>
      <p class="stat-sub">${topExpense.desc||'—'}</p>
    </div>
  `;

  // budget bar
  document.getElementById('budget-pct-label').style.color=budgetColor;
  document.getElementById('budget-pct-label').textContent=budgetPct.toFixed(1)+'%';
  const fill=document.getElementById('budget-bar-fill');
  fill.style.width=budgetPct+'%';
  fill.style.background=`linear-gradient(90deg,${budgetColor}88,${budgetColor})`;
  const dot=document.getElementById('budget-bar-dot');
  if(budgetPct>4){dot.style.display='';dot.style.background=budgetColor;dot.style.boxShadow=`0 0 8px ${budgetColor}`;}
  else dot.style.display='none';

  // area chart
  renderAreaChart(dailyData);

  // pie chart
  renderPieChart(byCat, total);

  // recurring
  const recEl=document.getElementById('recurring-section');
  if(recurring.length>0){
    recEl.style.display='';
    document.getElementById('recurring-title').textContent=`🔁 Recorrentes (${fmtBRL(recurring.reduce((s,e)=>s+e.value,0))}/mês)`;
    document.getElementById('recurring-list').innerHTML=recurring.map(e=>{
      const info=CATS[e.category]||CATS.outros;
      return `<div class="recurring-item" style="border:1px solid ${info.color}44;">
        <span style="font-size:16px;">${info.icon}</span>
        <div><div class="recurring-item-name">${e.desc}</div><div class="recurring-item-val" style="color:${info.color};">${fmtBRL(e.value)}</div></div>
      </div>`;
    }).join('');
  } else recEl.style.display='none';

  // top expenses
  const topEl=document.getElementById('top-section');
  if(filtered.length>0){
    topEl.style.display='';
    const sorted=[...filtered].sort((a,b)=>b.value-a.value).slice(0,5);
    document.getElementById('top-list').innerHTML=sorted.map((e,i)=>{
      const info=CATS[e.category]||CATS.outros;
      const barW=topExpense.value>0?((e.value/topExpense.value)*100)+'%':'0%';
      return `<div class="top-item">
        <span class="top-rank">#${i+1}</span>
        <div class="top-icon" style="background:${info.color}22;">${info.icon}</div>
        <div class="top-info">
          <div class="top-desc">${e.desc}</div>
          <div class="top-bar-track"><div class="top-bar-fill" style="width:${barW};background:${info.color};"></div></div>
        </div>
        <span class="top-val" style="color:${info.color};">${fmtBRL(e.value)}</span>
      </div>`;
    }).join('');
  } else topEl.style.display='none';

  // empty
  document.getElementById('empty-dashboard').style.display=expenses.length===0?'':'none';
}

function renderAreaChart(data){
  const canvas=document.getElementById('area-chart');
  if(areaChart){areaChart.destroy();areaChart=null;}
  areaChart=new Chart(canvas,{
    type:'line',
    data:{
      labels:data.map(d=>d.name),
      datasets:[{
        data:data.map(d=>d.value),
        borderColor:'#00D2FF',borderWidth:2,
        fill:true,
        backgroundColor:(ctx)=>{
          const g=ctx.chart.ctx.createLinearGradient(0,0,0,160);
          g.addColorStop(0,'rgba(0,210,255,0.3)');g.addColorStop(1,'rgba(0,210,255,0)');return g;
        },
        tension:0.4,pointRadius:0,
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{
        backgroundColor:'#12121e',borderColor:'#2a2a38',borderWidth:1,
        callbacks:{label:ctx=>`Gasto: ${fmtBRL(ctx.parsed.y)}`}
      }},
      scales:{
        x:{grid:{color:'#1a1a28',drawBorder:false},ticks:{color:'#555',font:{size:10}},border:{display:false}},
        y:{grid:{color:'#1a1a28',drawBorder:false},ticks:{color:'#555',font:{size:10},callback:v=>v>=1000?`${v/1000}k`:v},border:{display:false}}
      }
    }
  });
}

function renderPieChart(byCat, total){
  const container=document.getElementById('pie-container');
  if(byCat.length===0){
    if(pieChart){pieChart.destroy();pieChart=null;}
    container.innerHTML='<div class="no-data">Sem gastos ainda</div>';
    return;
  }
  container.innerHTML=`<div class="pie-wrap">
    <div class="pie-canvas-wrap"><canvas id="pie-chart"></canvas></div>
    <div class="pie-legend" id="pie-legend"></div>
  </div>`;
  const canvas=document.getElementById('pie-chart');
  if(pieChart){pieChart.destroy();pieChart=null;}
  pieChart=new Chart(canvas,{
    type:'doughnut',
    data:{
      labels:byCat.map(c=>c.name),
      datasets:[{data:byCat.map(c=>c.value),backgroundColor:byCat.map(c=>c.color),borderWidth:0,hoverOffset:4}]
    },
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'65%',
      plugins:{legend:{display:false},tooltip:{
        backgroundColor:'#12121e',borderColor:'#2a2a38',borderWidth:1,
        callbacks:{label:ctx=>`${fmtBRL(ctx.parsed)}`}
      }}
    }
  });
  const legend=document.getElementById('pie-legend');
  legend.innerHTML=byCat.slice(0,5).map(c=>`
    <div class="pie-legend-item">
      <div class="pie-legend-left"><div class="pie-dot" style="background:${c.color};"></div><span class="pie-name">${c.name}</span></div>
      <span class="pie-pct" style="color:${c.color};">${total>0?((c.value/total)*100).toFixed(0):0}%</span>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════
// GASTOS
// ═══════════════════════════════════════════════════════
function renderGastos(){
  const filtered=getFiltered();
  const total=filtered.reduce((s,e)=>s+e.value,0);

  // cat pills
  const pillsEl=document.getElementById('cat-pills');
  const usedCats=Object.keys(CATS).filter(k=>expenses.some(e=>e.category===k));
  pillsEl.innerHTML=`<button class="pill${filterCat==='todos'?' active':''}" onclick="setFilterCat('todos')" style="${filterCat==='todos'?'background:rgba(136,136,136,.2);border-color:#888;color:#888;':''}">Todos (${expenses.length})</button>`
    + usedCats.map(k=>{
      const v=CATS[k]; const active=filterCat===k;
      return `<button class="pill${active?' active':''}" onclick="setFilterCat('${k}')"
        style="${active?`background:${v.color}33;border-color:${v.color};color:${v.color};`:''}">
        ${v.icon} ${v.label}</button>`;
    }).join('');

  // expense list
  const listEl=document.getElementById('expense-list');
  if(filtered.length===0){
    listEl.innerHTML=`<div style="padding:48px;text-align:center;color:#333;"><div style="font-size:48px;">🕳️</div><p style="margin-top:10px;font-size:14px;">Nenhum gasto encontrado</p></div>`;
  } else {
    listEl.innerHTML=filtered.map((exp,i)=>{
      const info=CATS[exp.category]||CATS.outros;
      const d=new Date(exp.date);
      const hhmm=`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
      const isConfirm=deleteConfirmId===exp.id;
      return `<div class="expense-row">
        <div class="expense-cat-icon" style="background:${info.color}22;border:1px solid ${info.color}44;">${info.icon}</div>
        <div class="expense-info">
          <div class="expense-desc">${exp.desc}</div>
          <div class="expense-meta">
            <span class="expense-date">${fmtDate(exp.date)} · ${hhmm}</span>
            ${exp.note?`<span class="expense-note">"${exp.note}"</span>`:''}
            ${exp.recurring?`<span class="expense-recur" style="color:${info.color};background:${info.color}22;">🔁</span>`:''}
          </div>
        </div>
        <span class="expense-val" style="color:${info.color};">-${fmtBRL(exp.value)}</span>
        <div class="expense-actions">
          <button class="btn-edit" onclick="openEditModal('${exp.id}')">✏️</button>
          ${isConfirm
            ?`<span class="confirm-inline"><button class="btn-confirm-yes" onclick="deleteExpense('${exp.id}')">Sim</button><button class="btn-confirm-no" onclick="cancelDelete()">Não</button></span>`
            :`<button class="btn-delete" onclick="confirmDelete('${exp.id}')">×</button>`
          }
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('expense-count').textContent=`${filtered.length} transações`;
  document.getElementById('expense-total').textContent=`Total: ${fmtBRL(total)}`;
}
function setFilterCat(cat){filterCat=cat;renderGastos();}
function confirmDelete(id){deleteConfirmId=id;renderGastos();}
function cancelDelete(){deleteConfirmId=null;renderGastos();}
function deleteExpense(id){expenses=expenses.filter(e=>e.id!==id);deleteConfirmId=null;autoSave();renderAll();showToast('Gasto removido','info');}

// ═══════════════════════════════════════════════════════
// METAS
// ═══════════════════════════════════════════════════════
function renderMetas(){
  document.getElementById('metas-count').textContent=`${goals.length} metas ativas`;
  const grid=document.getElementById('goals-grid');
  const empty=document.getElementById('empty-metas');
  if(goals.length===0){grid.innerHTML='';empty.style.display='';return;}
  empty.style.display='none';
  grid.innerHTML=goals.map(g=>{
    const pct=Math.min((g.saved/g.target)*100,100);
    const left=g.target-g.saved;
    const deadlineDays=Math.ceil((new Date(g.deadline)-new Date())/86400000);
    const gColor=pct>=100?'#2ED573':pct>60?'#FFD93D':g.color;
    const r=27,circ=2*Math.PI*r,dash=circ*Math.min(pct/100,1);
    const deadlineStr=deadlineDays>0?`${deadlineDays} dias`:deadlineDays===0?'Hoje':'Expirado';
    return `<div class="goal-card">
      <div class="goal-inner">
        <div class="goal-ring-wrap">
          <svg width="70" height="70" class="ring-svg">
            <circle cx="35" cy="35" r="${r}" fill="none" stroke="#1e1e2e" stroke-width="7"/>
            <circle cx="35" cy="35" r="${r}" fill="none" stroke="${gColor}" stroke-width="7"
              stroke-dasharray="${dash} ${circ}" stroke-linecap="round" style="transition:stroke-dasharray .6s ease;"/>
          </svg>
        </div>
        <div class="goal-info">
          <div class="goal-top">
            <div>
              <div class="goal-name">${g.icon} ${g.name}</div>
              <div class="goal-deadline">Prazo: ${new Date(g.deadline).toLocaleDateString('pt-BR')} · ${deadlineStr}</div>
            </div>
            <div class="goal-right">
              <div class="goal-pct" style="color:${gColor};">${pct.toFixed(0)}%</div>
              <div class="goal-amounts">${fmtBRL(g.saved)} / ${fmtBRL(g.target)}</div>
            </div>
          </div>
          <div class="goal-bar-track">
            <div class="goal-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${gColor}88,${gColor});"></div>
          </div>
          ${pct<100?`
            <div class="goal-actions">
              ${[100,250,500].map(v=>`<button class="btn-deposit" style="background:${g.color}22;border:1px solid ${g.color}44;color:${g.color};" onclick="goalDeposit('${g.id}',${v})">+${fmtBRL(v)}</button>`).join('')}
              <button class="btn-complete" onclick="goalDeposit('${g.id}',${left})" title="Completar">✓</button>
              <button class="btn-remove-goal" onclick="removeGoal('${g.id}')" title="Remover">×</button>
            </div>`
          :`<div class="goal-achieved">🎉 Meta alcançada!</div>`}
        </div>
      </div>
    </div>`;
  }).join('');
}
function goalDeposit(id,amount){
  goals=goals.map(g=>g.id===id?{...g,saved:Math.min(g.saved+amount,g.target)}:g);
  autoSave();renderMetas();showToast(`💰 ${fmtBRL(amount)} depositado na meta!`);
}
function removeGoal(id){goals=goals.filter(g=>g.id!==id);autoSave();renderMetas();}

// ═══════════════════════════════════════════════════════
// QUICK ADD
// ═══════════════════════════════════════════════════════
function handleQuickAdd(){
  const raw=document.getElementById('quick-input').value;
  const parsed=parseInput(raw);
  if(!parsed){
    const bar=document.getElementById('quick-add-bar');
    bar.classList.add('shake');
    setTimeout(()=>bar.classList.remove('shake'),500);
    showToast("Não entendi. Tente: 'mecânico 500'",'error');
    return;
  }
  const cat=guessCategory(parsed.desc);
  const exp={id:genId(),desc:parsed.desc.charAt(0).toUpperCase()+parsed.desc.slice(1),value:parsed.value,category:cat,date:new Date().toISOString(),note:'',recurring:false};
  expenses=[exp,...expenses];
  document.getElementById('quick-input').value='';
  autoSave();renderAll();
  showToast(`✅ ${fmtBRL(parsed.value)} adicionado — ${CATS[cat]?.label||cat}`);
}

// ═══════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════
function openModal(id){
  const el=document.getElementById(id);
  el.classList.remove('hidden');
  el.onclick=e=>{if(e.target===el)closeModal(id);};
}
function closeModal(id){document.getElementById(id).classList.add('hidden');}

function openAddModal(){
  document.getElementById('add-desc').value='';
  document.getElementById('add-value').value='';
  document.getElementById('add-category').value='outros';
  document.getElementById('add-date').value=todayStr();
  document.getElementById('add-note').value='';
  document.getElementById('add-recurring').checked=false;
  openModal('modal-add');
}
function saveExpense(){
  const desc=document.getElementById('add-desc').value.trim();
  const valStr=document.getElementById('add-value').value;
  const v=parseFloat(valStr.replace(',','.'));
  if(!desc||!v||v<=0){showToast('Preencha descrição e valor','error');return;}
  const exp={
    id:genId(),desc,value:v,
    category:document.getElementById('add-category').value,
    date:new Date(document.getElementById('add-date').value).toISOString(),
    note:document.getElementById('add-note').value,
    recurring:document.getElementById('add-recurring').checked
  };
  expenses=[exp,...expenses];
  closeModal('modal-add');autoSave();renderAll();
  showToast(`✅ ${fmtBRL(v)} adicionado!`);
}

function openEditModal(id){
  const exp=expenses.find(e=>e.id===id);
  if(!exp) return;
  editingExpId=id;
  document.getElementById('edit-desc').value=exp.desc;
  document.getElementById('edit-value').value=exp.value;
  document.getElementById('edit-category').value=exp.category;
  document.getElementById('edit-note').value=exp.note||'';
  openModal('modal-edit');
}
function saveEdit(){
  const v=parseFloat(String(document.getElementById('edit-value').value).replace(',','.'));
  expenses=expenses.map(e=>e.id===editingExpId?{
    ...e,
    desc:document.getElementById('edit-desc').value,
    value:v||e.value,
    category:document.getElementById('edit-category').value,
    note:document.getElementById('edit-note').value
  }:e);
  closeModal('modal-edit');autoSave();renderAll();showToast('Gasto atualizado ✏️');
}

function openGoalModal(){
  document.getElementById('goal-name').value='';
  document.getElementById('goal-target').value='';
  document.getElementById('goal-saved').value='';
  document.getElementById('goal-deadline').value=todayStr();
  selectedGoalIcon='⭐';
  document.querySelectorAll('.icon-btn').forEach(b=>b.classList.toggle('active',b.textContent==='⭐'));
  openModal('modal-goal');
}
function saveGoal(){
  const name=document.getElementById('goal-name').value.trim();
  const t=parseFloat(document.getElementById('goal-target').value.replace(',','.'));
  const s=parseFloat(document.getElementById('goal-saved').value.replace(',','.')||'0');
  if(!name||!t){showToast('Preencha nome e valor','error');return;}
  const goal={id:genId(),name,target:t,saved:s||0,icon:selectedGoalIcon,color:'#00D2FF',deadline:document.getElementById('goal-deadline').value};
  goals=[...goals,goal];
  closeModal('modal-goal');autoSave();renderMetas();showToast('🎯 Meta salva!');
}

function openBudgetModal(){
  document.getElementById('budget-input').value=budget;
  openModal('modal-budget');
}
function saveBudget(){
  const v=parseFloat(document.getElementById('budget-input').value.replace(',','.'));
  if(v>0){budget=v;closeModal('modal-budget');updateBudgetBtn();autoSave();renderDashboard();showToast(`Orçamento: ${fmtBRL(v)}`);}
}

function openProfile(){
  const initials=currentUser.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('profile-avatar-large').textContent=initials;
  document.getElementById('profile-name').textContent=currentUser.name;
  document.getElementById('profile-email').textContent=currentUser.email;
  const provEl=document.getElementById('profile-provider');
  if(currentUser.provider==='google'){
    provEl.style.background='#1a2a3a';provEl.style.border='1px solid #4285F444';
    provEl.textContent='🔵 Google';
  } else {
    provEl.style.background='#1a1a28';provEl.style.border='1px solid #2a2a38';
    provEl.textContent='📧 E-mail';
  }
  document.getElementById('profile-total-count').textContent=expenses.length;
  document.getElementById('profile-month-total').textContent=fmtBRL(getTotalMonth());
  document.getElementById('profile-goals-count').textContent=goals.length;
  document.getElementById('profile-created').textContent=`Conta criada em ${new Date(currentUser.createdAt).toLocaleDateString('pt-BR')}`;
  openModal('modal-profile');
}

function openClearAll(){openModal('modal-clear');}
function clearAll(){expenses=[];deleteConfirmId=null;closeModal('modal-clear');autoSave();renderAll();showToast('Todos os gastos removidos','info');}

// ═══════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════
function setAiInput(text){
  document.getElementById('ai-input').value=text;
  const btn=document.getElementById('btn-send');
  btn.className='btn-send active';
  document.getElementById('ai-input').focus();
}
function clearChat(){
  aiMessages=[];
  document.getElementById('ai-messages').innerHTML=`
    <div class="ai-suggestions" id="ai-suggestions">
      <p>Sugestões:</p>
      <div class="ai-suggestions-btns">
        <button class="btn-suggestion" onclick="setAiInput('Onde estou gastando mais?')">Onde estou gastando mais?</button>
        <button class="btn-suggestion" onclick="setAiInput('Como reduzir gastos em 20%?')">Como reduzir gastos em 20%?</button>
        <button class="btn-suggestion" onclick="setAiInput('Meu orçamento está saudável?')">Meu orçamento está saudável?</button>
        <button class="btn-suggestion" onclick="setAiInput('Qual categoria cortar primeiro?')">Qual categoria cortar primeiro?</button>
        <button class="btn-suggestion" onclick="setAiInput('Dicas para economizar')">Dicas para economizar</button>
      </div>
    </div>`;
  document.getElementById('btn-clear-chat').style.display='none';
}
async function sendAI(){
  const inputEl=document.getElementById('ai-input');
  const userMsg=inputEl.value.trim();
  if(!userMsg||aiLoading) return;
  inputEl.value='';
  aiLoading=true;
  document.getElementById('btn-send').className='btn-send inactive';

  // hide suggestions
  const sug=document.getElementById('ai-suggestions');
  if(sug) sug.remove();
  document.getElementById('btn-clear-chat').style.display='';

  const filtered=getFiltered();
  const byCat=getByCat(filtered);
  const total=filtered.reduce((s,e)=>s+e.value,0);
  const summary=byCat.map(c=>`${c.name}: R$${c.value.toFixed(2)}`).join(', ');
  const sys=`Você é Rico, assistente financeiro pessoal de ${currentUser.name}. Dados: Total=${fmtBRL(total)}, Orçamento=${fmtBRL(budget)}, Gastos: ${summary||'nenhum ainda'}. Responda em português, seja direto e use emojis com moderação. Máx 3 parágrafos.`;

  aiMessages = [...aiMessages, {
  role: 'user',
  content: userMsg
}];
  const messagesEl=document.getElementById('ai-messages');

  // render user msg
  const userDiv=document.createElement('div');
  userDiv.className='ai-msg-wrap user';
  userDiv.innerHTML=`<div class="ai-msg user">${escapeHtml(userMsg)}</div>`;
  messagesEl.appendChild(userDiv);

  // thinking
  const thinkDiv=document.createElement('div');
  thinkDiv.className='ai-thinking';
  thinkDiv.innerHTML=`<span class="pulse-anim">🤖</span><span>Rico está pensando...</span>`;
  messagesEl.appendChild(thinkDiv);
  messagesEl.scrollTop=messagesEl.scrollHeight;
  
}
function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');}

// ═══════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════
function exportCSV(){
  const rows=[['Data','Descrição','Categoria','Valor','Nota'],...expenses.map(e=>[
    new Date(e.date).toLocaleDateString('pt-BR'),e.desc,
    CATS[e.category]?.label||e.category,
    e.value.toFixed(2).replace('.',','),e.note||''
  ])];
  const csv=rows.map(r=>r.map(c=>`"${c}"`).join(';')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`gastos-${currentUser.name.replace(/ /g,'-')}.csv`;a.click();
  showToast('📥 CSV exportado!');
}

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
let toastTimer=null;
function showToast(msg,type='success'){
  const old=document.querySelector('.toast');
  if(old) old.remove();
  clearTimeout(toastTimer);
  const c=type==='success'?'#2ED573':type==='error'?'#FF6B6B':'#4CC9F0';
  const bg=type==='success'?'#0d2e1a':type==='error'?'#2e0d0d':'#0d1a2e';
  const div=document.createElement('div');
  div.className='toast';
  div.style.cssText=`background:${bg};border:1px solid ${c};color:${c};`;
  div.textContent=msg;
  document.body.appendChild(div);
  toastTimer=setTimeout(()=>div.remove(),3000);
}

// ═══════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    document.getElementById('boot-screen').style.display='none';
    const session=loadSession();
    if(session){
      const users=loadUsers();
      const u=users.find(u=>u.id===session.uid);
      if(u){loginUser(u);return;}
    }
    document.getElementById('login-screen').style.display='flex';
  },600);
});

