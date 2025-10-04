/* ========= 設定 ========= */
// ★必ず差し替え（GAS WebアプリURL /exec）
const SHEETS_ENDPOINT = "PUT_YOUR_GAS_WEBAPP_URL_HERE";
const SHEETS_TOKEN = "";           // GAS側 EXPECT と合わせると簡易認証
const SYNC_ENABLED = true;
const SYNC_DEBOUNCE_MS = 1200;

// Google（Firebase：未設定でもOK）
const ENABLE_GOOGLE = true;
const firebaseConfig = { apiKey:"", authDomain:"", projectId:"", appId:"" };

// LINE（LIFF：未設定でもOK）
const ENABLE_LINE = true;
const LIFF_ID = "";

/* ========= マスタ/ダミー ========= */
const LS = {
  favs:'ut_favs', apps:'ut_apps', user:'ut_user', users:'ut_users',
  events:'ut_events', guest:'ut_guest', pvs:'ut_pvs', accounts:'ut_accounts',
  employers:'ut_employers', seenPop:'ut_seen_pop', jobs:'ut_jobs', drafts:'ut_job_drafts'
};

// 初期シード（画像付き）
const JOBS_SEED = [
  [1,'バックエンド開発（Go/GCP）','Alpha','渋谷','エンジニア','API実装/ログ基盤',2500,3,['フル/一部リモート','フレックス','英語力'],true,12,'2025-09-25','regular','東京都','渋谷区','https://picsum.photos/seed/job1/800/450'],
  [2,'グロースマーケ補佐（SNS/広告）','Beta','五反田','マーケ','SNS運用/ABテスト',2000,2,['フレックス','ベンチャー'],true,3,'2025-09-20','regular','東京都','品川区','https://picsum.photos/seed/job2/800/450'],
  [12,'学習塾講師アシ','Edu Star','高円寺','事務・アシスタント','採点/質問対応',1600,2,['未経験OK','土日可'],true,11,'2025-09-08','education','東京都','杉並区','https://picsum.photos/seed/job3/800/450'],
];
const JOBS_SEED_OBJ = JOBS_SEED.map(r=>({
  id:r[0],title:r[1],company:r[2],location:r[3],category:r[4],desc:r[5],
  wage:r[6],days:r[7],flags:r[8],open:r[9],intern:r[10],created:r[11],
  jobType:r[12],prefecture:r[13],city:r[14],image:r[15]
}));

const CATEGORIES=['マーケ','エンジニア','コンサル','経営・企画','営業','金融','メディア','経理','人事・広報','デザイナー','事務・アシスタント','その他'];
const FLAGS=['服装髪型自由','交通費支給','未経験OK','フル/一部リモート','フレックス','土日可','英語力','大手','ベンチャー','起業家/外銀/戦コン/総合商社/GAFA内定者を輩出'];
const REGION={'東京都':['千代田区','中央区','港区','新宿区','渋谷区','品川区','世田谷区','杉並区'],'関西':['大阪市','京都市','神戸市']};

const UNIVERSITY_OPTIONS = ["東京大学","京都大学","早稲田大学","慶應義塾大学","一橋大学","大阪大学","神戸大学","その他"];
const GRADE_OPTIONS = ["B1","B2","B3","B4","M1","M2","D","既卒"];
const PREF_OPTIONS = ["東京都","神奈川県","千葉県","埼玉県","大阪府","愛知県","福岡県","その他"];

/* ========= util ========= */
const $=(q)=>document.querySelector(q);
const esc=(s)=>String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const nowISO=()=>new Date().toISOString();
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const fmtDate=(s)=>{const d=new Date(s);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;};
const getJSON=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}};
const setJSON=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

/* ========= Jobs（シード + ローカル公開分 + ドラフト） ========= */
const allJobs = () => {
  const local = getJSON(LS.jobs,[]);
  return [...JOBS_SEED_OBJ, ...local];
};
const getDrafts = ()=> getJSON(LS.drafts,[]);
const setDrafts = (arr)=> setJSON(LS.drafts,arr);
const publishDraft = (draftId)=>{
  const drafts = getDrafts();
  const d = drafts.find(x=>x.id===draftId);
  if(!d) return false;
  const jobs = getJSON(LS.jobs,[]);
  // 新しい連番ID
  const newId = Math.max(0, ...JOBS_SEED_OBJ.map(j=>j.id), ...jobs.map(j=>j.id)) + 1;
  jobs.push({
    id:newId, title:d.title, company:d.company, location:d.location, category:d.category, desc:d.desc,
    wage:d.wage, days:d.days, flags:d.flags, open:d.open, intern:d.intern,
    created:nowISO().slice(0,10), jobType:d.jobType, prefecture:d.prefecture, city:d.city, image:d.image
  });
  setJSON(LS.jobs, jobs);
  setDrafts(drafts.filter(x=>x.id!==draftId));
  toast('ドラフトを公開しました');
  render(1); // リスト更新
  drawAdmin();
  return true;
};

/* ========= local保存 + 同期 ========= */
const getFavs = ()=> new Set(getJSON(LS.favs,'[]'));
const setFavs = (s)=> setJSON(LS.favs,[...s]);

const getApps = ()=> getJSON(LS.apps,[]);
const setApps = (a)=>{ setJSON(LS.apps,a); scheduleSync('applications'); };

const getUsers = ()=> getJSON(LS.users,[]);
const setUsers = (a)=>{ setJSON(LS.users,a); scheduleSync('users'); };

const getEvents = ()=> getJSON(LS.events,[]);
const setEvents = (a)=>{ setJSON(LS.events,a); scheduleSync('events'); };

const getEmployers = ()=> getJSON(LS.employers,[]);
const setEmployers = (a)=>{ setJSON(LS.employers,a); scheduleSync('employers'); };

const getPVs = ()=> getJSON(LS.pvs,[]);
const setPVs = (a)=> setJSON(LS.pvs,a);

let syncTimer=null, pendingKinds=new Set();
function scheduleSync(kind){
  if(!SYNC_ENABLED) return;
  pendingKinds.add(kind);
  if(syncTimer) clearTimeout(syncTimer);
  syncTimer=setTimeout(runSync,SYNC_DEBOUNCE_MS);
}
async function runSync(){
  const kinds=[...pendingKinds]; pendingKinds.clear();
  for(const k of kinds){
    let rows=[];
    if(k==='users') rows=getUsers().map(u=>({
      id:u.id, email:u.email||"", name:u.name||"", provider:u.provider||"",
      createdAt:u.createdAt||"", lastLoginAt:u.lastLoginAt||"", totalLogins:u.totalLogins||1,
      birth:u.birth||"", univ:u.univ||"", univOther:u.univOther||"",
      grade:u.grade||"", major:u.major||"", pref:u.pref||"", phone:u.phone||"",
      days:u.days||"", wishWage:u.wishWage||"", skills:u.skills||"", links:u.links||"", bio:u.bio||""
    }));
    else if(k==='events') rows=getEvents().map(e=>({
      id:e.id, ts:e.ts, type:e.type, userId:e.userId, email:e.email||"", page:e.page||"", jobId:e.jobId||""
    }));
    else if(k==='applications') rows=getApps().map(a=>({
      id:a.id, ts:a.ts, userId:a.userId, email:a.email||"", name:a.name||"", jobId:a.jobId,
      message:a.message||"", status:a.status||"pending"
    }));
    else if(k==='employers') rows=getEmployers().map(x=>({
      id:x.id, ts:x.ts, company:x.company, pic:x.pic, email:x.email, tel:x.tel,
      pref:x.pref, size:x.size, industry:x.industry, url:x.url, billing:x.billing, agree:x.agree?'YES':'NO'
    }));
    if(!rows.length) continue;
    try{
      await fetch(SHEETS_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:k,rows,token:SHEETS_TOKEN})});
    }catch(e){ console.warn('sync error',k,e); pendingKinds.add(k); }
  }
}

/* ========= 現在ユーザー/イベント ========= */
function currentUser(){
  const u=getJSON(LS.user,null);
  if(u) return u;
  let gid=localStorage.getItem(LS.guest);
  if(!gid){ gid='guest_'+uid(); localStorage.setItem(LS.guest,gid); }
  return { id:gid, guest:true, email:null, name:null, provider:null, avatar:null };
}
function logEvent(type, payload={}){
  const u=currentUser();
  const ev=getEvents(); ev.push({ id:uid(), ts:nowISO(), type, userId:u.id, email:u.email||null, ...payload });
  setEvents(ev);
}
function addPV(jobId){ const p=getPVs(); p.push({id:uid(),jobId,ts:nowISO()}); setPVs(p); }

/* ========= 初回ポップ ========= */
function showFirstVisitPop(){
  if(getJSON(LS.seenPop,false)) return;
  showModal(`
    <div style="text-align:center">
      <h3>ようこそ！</h3>
      <p class="meta">ログインすると応募や履歴の保存ができます。</p>
      <div class="row center">
        <button type="button" class="btn primary" data-route="account" id="popGoSignup">新規登録/ログイン</button>
        <button type="button" class="btn" id="popSeeJobs">まずは求人を見る</button>
      </div>
    </div>
  `, ()=>{
    $('#popGoSignup').onclick=()=>{ closeModal(); openLoginCard('ログイン/新規登録'); };
    $('#popSeeJobs').onclick=()=>{ closeModal(); };
  });
  setJSON(LS.seenPop,true);
}

/* ========= 認証UI ========= */
const loginState=$('#loginState'), btnLogin=$('#btnLogin'), btnLogout=$('#btnLogout'), btnSignup=$('#btnSignup');
function bindAuthButtons(){
  btnLogin.onclick=()=>openLoginCard('ログイン');
  btnSignup.onclick=()=>openLoginCard('新規登録');
  btnLogout.onclick=()=>logout();
}
function refreshLogin(){
  const u=getJSON(LS.user,null);
  if(u){ loginState.innerHTML=`ログイン中：<b>${esc(u.name||u.email||u.id)}</b>`; btnLogout.style.display='inline-block'; }
  else { loginState.textContent='未ログイン'; btnLogout.style.display=''; btnLogout.style.display='none'; }
}

/* —— ログインカード（Google/LINE/メール） —— */
function openLoginCard(title){
  showModal(`
    <div class="panel soft">
      <h3>${esc(title)}</h3>
      <div class="row gap-xs">
        <button type="button" id="btnGoogleLogin" class="btn">🔵 Googleでログイン</button>
        <button type="button" id="btnLineLogin" class="btn">🟢 LINEでログイン</button>
      </div>
      <div class="panel soft" style="margin-top:12px">
        <label>メールアドレス<input id="lemail" class="input" type="email" placeholder="you@example.com" autocomplete="email"/></label>
        <label>パスワード<input id="lpass" class="input" type="password" placeholder="********"/></label>
        <div class="row right"><button type="button" id="btnEmailLogin" class="btn primary">ログイン</button></div>
      </div>
      <p class="meta">未登録の方は上のメール欄でそのまま作成できます／パスワードを忘れた方はログイン試行でエラー表示（デモ）</p>
    </div>
  `, ()=>{
    $('#btnGoogleLogin').onclick=()=>{ if(!ENABLE_GOOGLE||!firebaseConfig.apiKey){ toast('Google設定が未完了'); return; } googleLogin(); };
    $('#btnLineLogin').onclick=()=>{ if(!ENABLE_LINE||!LIFF_ID||!window.liff){ toast('LINE設定が未完了'); return; } lineLogin(); };
    $('#btnEmailLogin').onclick=()=>{
      const email=$('#lemail').value.trim(); const pass=$('#lpass').value;
      if(!email||!pass) return toast('メール/パスを入力');
      emailPassLogin(email,pass);
    };
  });
}

function emailPassLogin(email, pass){
  const h=t=>btoa(unescape(encodeURIComponent(t))).slice(0,24);
  const accounts=getJSON(LS.accounts,[]);
  let acc=accounts.find(a=>a.email===email&&a.provider==='password');
  if(!acc){ acc={email,provider:'password',passHash:h(pass),createdAt:nowISO()}; accounts.push(acc); }
  else if(acc.passHash!==h(pass)){ toast('パスワードが違います'); return; }
  setJSON(LS.accounts,accounts);
  commitLogin({provider:'password',externalId:'pwd_'+email,email,name:email});
  closeModal(); toast('ログインしました');
}

// Google
let firebaseReady=false;
try{ if(ENABLE_GOOGLE&&firebaseConfig.apiKey){ firebase.initializeApp(firebaseConfig); firebaseReady=true; } }catch(e){}
async function googleLogin(){
  if(!firebaseReady) return toast('Google設定が未完了');
  const provider=new firebase.auth.GoogleAuthProvider();
  try{
    const cred=await firebase.auth().signInWithPopup(provider);
    const p=cred.user;
    commitLogin({provider:'google',externalId:p.uid,email:p.email||null,name:p.displayName||null,avatar:p.photoURL||null});
    closeModal(); toast('Googleでログイン');
  }catch(e){ console.error(e); toast('Googleログイン失敗'); }
}
// LINE
async function lineLogin(){
  try{
    await liff.init({liffId:LIFF_ID});
    if(!liff.isLoggedIn()){ liff.login({scope:'openid profile email'}); return; }
    const prof=await liff.getProfile(); const idt=liff.getDecodedIDToken();
    commitLogin({provider:'line',externalId:prof.userId,email:idt?.email||null,name:prof.displayName||null,avatar:prof.pictureUrl||null});
    closeModal(); toast('LINEでログイン');
  }catch(e){ console.error(e); toast('LINEログイン失敗'); }
}

/* —— 共通：ログイン確定/移行/同期 —— */
function commitLogin({provider,externalId,email,name,avatar}){
  const prev=currentUser();
  const users=getUsers();
  let user=users.find(u=> (email&&u.email===email) || (u.externalId===externalId));
  if(!user){
    user={ id:'u_'+uid(), email:email||null, name:name||null, externalId, provider, avatar:avatar||null,
      createdAt:nowISO(), lastLoginAt:nowISO(), totalLogins:1 };
    users.push(user);
  }else{
    user.lastLoginAt=nowISO(); user.totalLogins=(user.totalLogins||0)+1;
    user.name=user.name||name; user.avatar=user.avatar||avatar;
  }
  setUsers(users);
  setJSON(LS.user,{ id:user.id,email:user.email,name:user.name,provider:user.provider,avatar:user.avatar });

  if(prev.guest){
    setApps(getApps().map(a=>a.userId===prev.id?{...a,userId:user.id,email:user.email,name:user.name||''}:a));
    setEvents(getEvents().map(e=>e.userId===prev.id?{...e,userId:user.id,email:user.email}:e));
    localStorage.removeItem(LS.guest);
  }
  refreshLogin(); logEvent('login',{email:user.email,provider});
  scheduleSync('users'); scheduleSync('events'); scheduleSync('applications');
}
function logout(){
  const u=getJSON(LS.user,null); if(u) logEvent('logout',{email:u.email,provider:u.provider});
  try{ if(firebaseReady && firebase.auth().currentUser) firebase.auth().signOut(); }catch{}
  try{ if(window.liff && liff.isLoggedIn()) liff.logout(); }catch{}
  localStorage.removeItem(LS.user); refreshLogin(); toast('ログアウトしました');
}

/* ========= 右上メニュー ========= */
function bindMenu(){
  const menuBtn = $('#menuBtn');
  const menuPanel = $('#menuPanel');
  menuBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const on = menuPanel.classList.toggle('on');
    menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    menuPanel.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  // 項目クリック→遷移
  menuPanel.querySelectorAll('[data-route]').forEach(b=>{
    b.addEventListener('click', ()=>{
      menuPanel.classList.remove('on');
      menuBtn.setAttribute('aria-expanded','false');
      goto(b.dataset.route);
    });
  });
  // 外側クリックで閉じる
  document.addEventListener('click', (e)=>{
    if(!menuPanel.contains(e.target) && e.target!==menuBtn){
      menuPanel.classList.remove('on');
      menuBtn.setAttribute('aria-expanded','false');
    }
  });
}

/* ========= クリック委譲（カード内ボタン等） ========= */
function bindGlobalClickRouter(){
  document.addEventListener('click', (e)=>{
    const t=e.target;
    if (t.id==='modalClose' || t.closest('#modalClose')) { e.preventDefault(); closeModal(); return; }
    const routeEl = t.closest('[data-route]');
    if (routeEl && !t.closest('#menuPanel')) { e.preventDefault(); goto(routeEl.dataset.route); return; }

    // 求人カード操作
    const favEl   = t.closest('[data-fav]');
    const applyEl = t.closest('[data-apply]');
    const detEl   = t.closest('[data-detail]');
    if (favEl){ e.preventDefault(); const id=+favEl.dataset.fav; const s=getFavs(); s.has(id)?s.delete(id):s.add(id); setFavs(s); logEvent('fav_toggle',{jobId:id}); render(); return; }
    if (applyEl){ e.preventDefault(); openApply(+applyEl.dataset.apply); return; }
    if (detEl){ e.preventDefault(); openDetail(+detEl.dataset.detail); return; }

    if (t.id==='reset'){ e.preventDefault(); resetFilters(); render(1); return; }
  }, { passive:false });
}

/* ========= ルーティング ========= */
const views={};
function setupRouting(){
  Object.assign(views,{
    jobs:$('#view-jobs'),map:$('#view-map'),ranking:$('#view-ranking'),articles:$('#view-articles'),
    education:$('#view-education'),employers:$('#view-employers'),legal:$('#view-legal'),
    privacy:$('#view-privacy'),company:$('#view-company'),account:$('#view-account'),admin:$('#view-admin')
  });
  // 上部タブ
  document.querySelectorAll('.tab').forEach(b=> b.addEventListener('click',()=>goto(b.dataset.route)));
}
function goto(route){
  Object.entries(views).forEach(([k,el])=> el&&(el.style.display=k===route?'block':'none'));
  document.querySelectorAll('.tab').forEach(b=> b.classList.toggle('active',b.dataset.route===route));
  if(route==='account') renderAccount();
  if(route==='map') renderRegion();
  if(route==='ranking') renderRanking();
  if(route==='articles') renderArticles();
  if(route==='education') mountEducation();
  if(route==='employers') initEmployerForm();
  if(route==='admin') drawAdmin();
  logEvent('view',{page:route});
}

/* ========= フィルタUI ========= */
let curPage=1;
function mountFilters(){
  // セレクトに職種/特徴を投入
  const catSel=$('#catSel'), flagSel=$('#flagSel');
  CATEGORIES.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o); });
  FLAGS.forEach(f=>{ const o=document.createElement('option'); o.value=f; o.textContent=f; flagSel.appendChild(o); });

  // 変更で再描画
  ['q','sort','minWage','minDays','pageSize','internMin','f-open','favOnly','catSel','flagSel']
    .forEach(id=>{
      const el = (id==='catSel'||id==='flagSel') ? $('#'+id) : document.getElementById(id);
      if(!el) return;
      const evt = (el.tagName==='INPUT' && el.type==='checkbox') ? 'change' : 'input';
      el.addEventListener(evt, ()=>render(1));
    });

  // 初期描画
  render(1);
}
function resetFilters(){
  $('#q').value=''; $('#sort').value='new'; $('#minWage').value='0'; $('#minDays').value='2';
  $('#pageSize').value='10'; $('#internMin').value='0'; $('#f-open').checked=true; $('#favOnly').checked=false;
  [...$('#catSel').options].forEach(o=>o.selected=false);
  [...$('#flagSel').options].forEach(o=>o.selected=false);
}
function getSelectedValues(sel){ return [...sel.options].filter(o=>o.selected).map(o=>o.value); }

function getFilters(){
  const cats=getSelectedValues($('#catSel'));
  const flags=getSelectedValues($('#flagSel'));
  return {
    q:($('#q').value||'').trim().toLowerCase(),
    sort:$('#sort').value, minWage:+$('#minWage').value, minDays:+$('#minDays').value,
    pageSize:+$('#pageSize').value, onlyOpen:$('#f-open').checked, favOnly:$('#favOnly').checked,
    internMin:+$('#internMin').value, cats, flags
  };
}
function matchFlags(jobFlags, sel){ return sel.every(t=>jobFlags.includes(t)); }
function applyFilters(rows,f){
  const favs=getFavs();
  let out=rows.filter(j=>{
    if(f.onlyOpen && !j.open) return false;
    if(f.favOnly && !favs.has(j.id)) return false;
    if(f.cats.length && !f.cats.includes(j.category)) return false;
    if(f.flags.length && !matchFlags(j.flags,f.flags)) return false;
    if(j.wage<f.minWage) return false;
    if(j.days<f.minDays) return false;
    if(f.internMin && j.intern<f.internMin) return false;
    if(f.q){
      const hay=(j.title+' '+j.company+' '+j.location+' '+j.category+' '+j.desc+' '+j.flags.join(' ')).toLowerCase();
      if(!hay.includes(f.q)) return false;
    }
    return true;
  });
  // sort
  out = out.sort((a,b)=>{
    if(f.sort==='wage') return b.wage-a.wage;
    if(f.sort==='days') return a.days-b.days;
    if(f.sort==='intern') return b.intern-a.intern;
    return +new Date(b.created)-+new Date(a.created);
  });
  return out;
}
function paginate(arr,page,ps){
  const total=arr.length,pages=Math.max(1,Math.ceil(total/ps)),cur=Math.max(1,Math.min(page,pages));
  return {slice:arr.slice((cur-1)*ps,cur*ps),total,pages,cur};
}
function render(page){
  if(page) curPage=page;
  const f=getFilters();
  const base = allJobs().filter(j=>j.jobType!=='education');
  const filtered=applyFilters(base,f);
  const {slice,total,pages,cur}=paginate(filtered,curPage,f.pageSize);
  $('#stat').textContent=`${total}件中 ${slice.length?((cur-1)*f.pageSize+1)+'〜'+((cur-1)*f.pageSize+slice.length):'0'} を表示（${pages}ページ）`;
  const favs=getFavs(); const cards=$('#cards'); cards.innerHTML='';
  slice.forEach(j=>{
    const d=document.createElement('div'); d.className='card '+(j.open?'':'closed');
    d.innerHTML=`
      <img class="thumb" src="${esc(j.image||'https://picsum.photos/seed/placeholder/800/450')}" alt="">
      <div style="padding:12px">
        <div>${j.open?'<span class="badge">募集中</span>':'<span class="badge">募集停止</span>'}
          ${j.flags.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}
        </div>
        <h3 style="margin:6px 0">${esc(j.title)}</h3>
        <div class="dim">${esc(j.company)}・${esc(j.location)}｜時給${j.wage}円｜週${j.days}〜｜在籍${j.intern}｜${fmtDate(j.created)}</div>
      </div>
      <div class="row right" style="padding:0 12px 12px">
        <button type="button" class="btn" data-detail="${j.id}">詳細</button>
        ${j.open?`<button type="button" class="btn primary" data-apply="${j.id}">エントリー</button>`:''}
        <button type="button" class="btn" data-fav="${j.id}">${favs.has(j.id)?'★':'☆'}</button>
      </div>`;
    cards.appendChild(d);
  });
  // pager
  const pager=$('#pager'); pager.innerHTML='';
  const add=(lab,to,dis,act)=>{ const b=document.createElement('button'); b.type='button'; b.className='pagebtn'; if(act) b.style.background='linear-gradient(135deg,#cfe0ff,#e8f0ff)'; b.textContent=lab; b.disabled=dis; b.onclick=()=>render(to); pager.appendChild(b); };
  add('«',1,cur===1); add('‹',Math.max(1,cur-1),cur===1);
  for(let i=1;i<=pages;i++){
    if(i===1||i===pages||Math.abs(i-cur)<=2) add(String(i),i,false,i===cur);
    else if(Math.abs(i-cur)===3){ const s=document.createElement('span'); s.textContent='…'; s.className='meta'; pager.appendChild(s); }
  }
  add('›',Math.min(pages,cur+1),cur===pages); add('»',pages,cur===pages);
}

/* ========= 地域/ランキング/記事/教育 ========= */
function renderRegion(){
  const box=$('#mapLinks'); if(!box) return; box.innerHTML='';
  Object.entries(REGION).forEach(([pref,cities])=>{
    const wrap=document.createElement('div'); wrap.className='mapbox';
    wrap.innerHTML=`<h3>${pref}</h3><div class="meta">区市をクリックで一覧に適用</div><div class="links"></div>`;
    const ln=wrap.querySelector('.links');
    const link=(label,pref,city)=>{ const a=document.createElement('a'); a.href="javascript:void(0)"; a.textContent=label; a.onclick=()=>{ $('#q').value=city?`${pref} ${city}`:pref; goto('jobs'); render(1); }; return a; };
    ln.appendChild(link('全域',pref,null)); cities.forEach(c=> ln.appendChild(link(c,pref,c)));
    box.appendChild(wrap);
  });
}
function renderRanking(){
  const favs=getFavs(), apps=getApps(), pvs=getPVs();
  const score=(id)=> apps.filter(a=>a.jobId===id).length*2 + (favs.has(id)?1:0) + pvs.filter(p=>p.jobId===id).length*0.2;
  const rows = allJobs().map(j=>({j,score:score(j.id)}))
    .sort((a,b)=> b.score - a.score || b.j.intern - a.j.intern || +new Date(b.j.created)-+new Date(a.j.created))
    .slice(0,20);
  const box=$('#rankbox'); if(!box) return; box.innerHTML='';
  rows.forEach((r,i)=>{
    const d=document.createElement('div'); d.className='item';
    d.innerHTML=`#${i+1} <b>${esc(r.j.title)}</b> <span class="meta">／${esc(r.j.company)}・${esc(r.j.location)}・時給${r.j.wage}</span> <span class="meta">score:${r.score.toFixed(1)}</span>`;
    box.appendChild(d);
  });
}
const ARTICLES=[
  {slug:'prep-guide',title:'応募準備ガイド',category:'応募準備ガイド',body:'# 応募準備\n- 履歴書\n- ポートフォリオ',tags:['履歴書','面接']},
  {slug:'choose-role',title:'業界・職種の選び方',category:'業界・職種の選び方',body:'# 職種選び',tags:['キャリア']}
];
const ARTICLE_CATS=['応募準備ガイド','業界・職種の選び方'];
function renderArticles(){
  const sel=$('#articleCat'), aq=$('#articleQ'), list=$('#articleList'), detail=$('#articleDetail'); if(!sel) return;
  if(!sel.dataset.ready){ ARTICLE_CATS.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); }); sel.dataset.ready='1'; }
  const draw=()=>{
    const term=aq.value.trim().toLowerCase(), cat=sel.value;
    const rows=ARTICLES.filter(a=>(!cat||a.category===cat)&&(!term||(a.title+a.body).toLowerCase().includes(term)));
    list.innerHTML=''; detail.style.display='none';
    rows.forEach(a=>{
      const card=document.createElement('div'); card.className='card';
      card.innerHTML=`<div style="padding:12px"><b>${esc(a.title)}</b> <span class="meta">／${esc(a.category)}</span><div class="meta">${esc(a.tags.join(', '))}</div><div class="row right"><button type="button" class="btn" data-slug="${a.slug}">読む</button></div></div>`;
      list.appendChild(card);
    });
    list.onclick=(e)=>{ const slug=e.target.closest('[data-slug]')?.dataset.slug; if(!slug) return;
      const art=ARTICLES.find(x=>x.slug===slug); const lines=art.body.split(/\n/);
      const toc=lines.filter(l=>/^#{1,3}\s/.test(l)).map(l=>l.replace(/^#+\s/,'')); detail.innerHTML=`<h3>${esc(art.title)}</h3><div class="meta">${esc(art.category)} ｜ ${esc(art.tags.join(', '))}</div><hr/><b>目次</b><ul>${toc.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><pre class="legal">${esc(art.body)}</pre>`; detail.style.display='block';
    };
  };
  if(!sel.onchange){ sel.onchange=draw; aq.oninput=draw; } draw();
}
function mountEducation(){
  const host=$('#eduMount'); if(!host) return;
  host.innerHTML=`
    <div class="filter-grid small">
      <input id="eq" class="input" placeholder="フリーワード"/>
      <select id="esort" class="input"><option value="new">新着順</option><option value="wage">時給が高い順</option><option value="days">勤務日数が少ない順</option></select>
      <select id="ewage" class="input"><option value="0">下限なし</option><option value="1200">1200円〜</option><option value="1500">1500円〜</option><option value="2000">2000円〜</option><option value="2500">2500円〜</option></select>
      <select id="edays" class="input"><option value="2">週2〜</option><option value="3">週3〜</option><option value="4">週4〜</option></select>
    </div>
    <label class="row center-left" style="margin:8px 0"><input type="checkbox" id="eopen" checked> <span>募集中のみ</span></label>
    <div id="elist" class="cards slim"></div>`;
  const eq=$('#eq'), es=$('#esort'), ew=$('#ewage'), ed=$('#edays'), eopen=$('#eopen'), elist=$('#elist');
  const draw=()=>{ let rows=allJobs().filter(j=>j.jobType==='education'); const term=eq.value.trim().toLowerCase();
    if(term) rows=rows.filter(j=>(j.title+j.company+j.desc).toLowerCase().includes(term));
    rows=rows.filter(j=> j.wage>=+ew.value && j.days>=+ed.value && (!eopen.checked || j.open));
    rows.sort((a,b)=> es.value==='wage'? b.wage-a.wage : es.value==='days'? a.days-b.days : +new Date(b.created)-+new Date(a.created));
    elist.innerHTML=''; rows.forEach(j=>{
      const d=document.createElement('div'); d.className='card '+(j.open?'':'closed');
      d.innerHTML=`<img class="thumb" src="${esc(j.image||'https://picsum.photos/seed/edu/800/450')}" alt="">
        <div style="padding:12px"><div>${j.open?'<span class="badge">募集中</span>':'<span class="badge">募集停止</span>'}</div><h3>${esc(j.title)}</h3><div class="dim">${esc(j.company)}｜時給${j.wage}円｜週${j.days}〜</div></div>
        <div class="row right" style="padding:0 12px 12px">${j.open?`<button type="button" class="btn" data-apply="${j.id}">エントリー</button>`:''}</div>`;
      elist.appendChild(d);
    });
    elist.onclick=(e)=>{ const app=e.target.closest('[data-apply]')?.dataset.apply; if(app) openApply(+app); };
  };
  [eq,es,ew,ed,eopen].forEach(el=> el.addEventListener('input',draw)); draw();
}

/* ========= 詳細/応募 ========= */
function openDetail(id){
  const j=allJobs().find(x=>x.id===id); if(!j) return;
  addPV(id); logEvent('view',{jobId:id});
  showModal(`
    <h3>${esc(j.title)}</h3>
    <img class="thumb" style="width:100%;border-radius:12px;margin:8px 0" src="${esc(j.image||'https://picsum.photos/seed/detail/800/450')}" alt="">
    <div class="dim">${esc(j.company)}・${esc(j.location)}｜時給${j.wage}円｜週${j.days}〜｜在籍${j.intern}｜${fmtDate(j.created)}</div>
    <p>${esc(j.desc)}</p>
    <div class="row right">
      ${j.open?`<button type="button" class="btn primary" id="goApply">エントリー</button>`:''}
      <button type="button" class="btn" id="favBtn">★</button>
    </div>`,()=>{
      $('#favBtn').onclick=()=>{ const s=getFavs(); s.add(j.id); setFavs(s); toast('★追加'); };
      const btn=$('#goApply'); if(btn) btn.onclick=()=>{ closeModal(); openApply(j.id); };
    });
}
function openApply(jobId){
  const u=currentUser();
  if(!u.email && !u.name){ openLoginCard('ログイン'); return; }
  const users = getUsers();
  const me = users.find(x=>x.id===u.id) || {};

  // すべて選択式 + 日付はカレンダー（type=date）
  showModal(`
    <h3>応募前の確認</h3>
    <div class="meta">必要事項をご入力ください（次回以降は自動で呼び出されます）。</div>
    <form id="preApplyForm" class="grid-2col">
      <div class="panel soft">
        <label>氏名<input name="name" class="input" value="${esc(me.name||u.name||'')}" required /></label>
        <label>生年月日<input name="birth" type="date" class="input" value="${esc(me.birth||'')}" required /></label>
        <label>大学
          <select name="univ" class="input">
            ${UNIVERSITY_OPTIONS.map(x=>`<option ${me.univ===x?'selected':''}>${x}</option>`).join('')}
          </select>
        </label>
        <label>大学（その他の方）<input name="univOther" class="input" placeholder="自由入力" value="${esc(me.univOther||'')}"/></label>
        <label>学年
          <select name="grade" class="input">${GRADE_OPTIONS.map(x=>`<option ${me.grade===x?'selected':''}>${x}</option>`)}</select>
        </label>
        <label>専攻<input name="major" class="input" value="${esc(me.major||'')}" /></label>
      </div>
      <div class="panel soft">
        <label>居住地（都道府県）
          <select name="pref" class="input">${PREF_OPTIONS.map(x=>`<option ${me.pref===x?'selected':''}>${x}</option>`)}</select>
        </label>
        <label>電話番号<input name="phone" class="input" inputmode="tel" /></label>
        <label>就業可能日数
          <select name="days" class="input">
            <option ${me.days==='週2〜'?'selected':''}>週2〜</option>
            <option ${me.days==='週3〜'?'selected':''}>週3〜</option>
            <option ${me.days==='週4〜'?'selected':''}>週4〜</option>
          </select>
        </label>
        <label>希望時給
          <select name="wishWage" class="input">
            <option ${me.wishWage==='1200円〜'?'selected':''}>1200円〜</option>
            <option ${me.wishWage==='1500円〜'?'selected':''}>1500円〜</option>
            <option ${me.wishWage==='2000円〜'?'selected':''}>2000円〜</option>
            <option ${me.wishWage==='2500円〜'?'selected':''}>2500円〜</option>
          </select>
        </label>
        <label>自己PR（任意）<textarea name="message" class="input" rows="4" placeholder="簡単な自己紹介や志望動機">${esc(me.lastMessage||'')}</textarea></label>
      </div>
    </form>
    <div class="row right">
      <button type="button" id="doApply" class="btn primary">この内容で応募する</button>
    </div>
  `, ()=>{
    $('#doApply').onclick=()=>{
      const fd = new FormData($('#preApplyForm'));
      const profile = {
        name: fd.get('name'), birth: fd.get('birth'),
        univ: (fd.get('univ')==='その他' ? (fd.get('univOther')||'その他') : fd.get('univ')),
        univOther: fd.get('univOther')||'',
        grade: fd.get('grade'), major: fd.get('major'),
        pref: fd.get('pref'), phone: fd.get('phone'),
        days: fd.get('days'), wishWage: fd.get('wishWage'),
        lastMessage: fd.get('message')
      };
      if(!profile.name || !profile.birth){ toast('氏名と生年月日は必須です'); return; }

      const arr = getUsers(); let user = arr.find(x=>x.id===u.id);
      if(!user){
        user = { id:u.id, email:u.email||null, name:profile.name, provider:u.provider||'local', createdAt:nowISO(), lastLoginAt:nowISO(), totalLogins:1 };
        arr.push(user);
      }
      Object.assign(user, profile);
      setUsers(arr);

      const a=getApps();
      if(a.some(x=>x.userId===u.id && x.jobId===jobId)){ toast('この求人には既に応募済み'); return; }
      const job = allJobs().find(j=>j.id===jobId);
      a.push({ id: uid(), jobId, userId: u.id, email: u.email||"", name: profile.name||u.name||"",
        jobTitle: job?.title||'', jobCompany: job?.company||'', ts: nowISO(), message: profile.lastMessage||"", status:'pending' });
      setApps(a);

      logEvent('apply',{jobId});
      toast('応募を記録しました（プロフィールも更新）');
      closeModal();
    };
  });
}

/* ========= 採用担当者：会社登録 & 掲載前編集 ========= */
function initEmployerForm(){
  const form = $('#employerForm'); if(!form) return;
  const btn = $('#saveEmployer');
  const note = $('#employerNote');
  btn.onclick = ()=>{
    const fd = new FormData(form);
    if(!fd.get('company') || !fd.get('pic') || !fd.get('email') || !fd.get('agree')){
      toast('必須項目を入力してください'); return;
    }
    const rec = {
      id: 'emp_'+uid(), ts: nowISO(),
      company: fd.get('company'), pic: fd.get('pic'),
      email: fd.get('email'), tel: fd.get('tel'),
      pref: fd.get('pref'), size: fd.get('size'), industry: fd.get('industry'),
      url: fd.get('url'), billing: fd.get('billing'), agree: !!fd.get('agree')
    };
    const arr = getEmployers(); arr.push(rec); setEmployers(arr);
    note.textContent = '登録を受け付けました（シートに同期）';
    toast('会社情報を登録しました');
  };

  // 新規求人（ドラフト作成）
  $('#openNewJob').onclick = ()=>{
    showModal(`
      <h3>新規求人（ドラフト）</h3>
      <form id="draftForm" class="grid-2col">
        <div class="panel soft">
          <label>タイトル<input name="title" class="input" required></label>
          <label>会社名<input name="company" class="input" required></label>
          <label>勤務地<input name="location" class="input" placeholder="渋谷など"></label>
          <label>職種
            <select name="category" class="input">${CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select>
          </label>
          <label>説明<textarea name="desc" class="input" rows="5" placeholder="業務内容など"></textarea></label>
        </div>
        <div class="panel soft">
          <label>時給<input name="wage" type="number" class="input" value="1500"></label>
          <label>勤務日数（週）<input name="days" type="number" class="input" value="3"></label>
          <label>特徴（カンマ区切り）<input name="flags" class="input" placeholder="フル/一部リモート, フレックス"></label>
          <label>都道府県<input name="prefecture" class="input" value="東京都"></label>
          <label>区市<input name="city" class="input" value=""></label>
          <label>ジョブタイプ
            <select name="jobType" class="input">
              <option value="regular" selected>通常</option>
              <option value="education">教育系</option>
            </select>
          </label>
          <label>画像<input name="image" type="file" accept="image/*" class="input"></label>
          <label class="row center-left"><input type="checkbox" name="open" checked> <span>募集中で作成</span></label>
        </div>
      </form>
      <div class="row right"><button type="button" id="saveDraft" class="btn primary">ドラフト保存</button></div>
    `, ()=>{
      $('#saveDraft').onclick=()=>{
        const fd = new FormData($('#draftForm'));
        const payload = {
          id:'d_'+uid(),
          title:fd.get('title'), company:fd.get('company'), location:fd.get('location'),
          category:fd.get('category'), desc:fd.get('desc'), wage:+fd.get('wage')||0, days:+fd.get('days')||0,
          flags:(fd.get('flags')||'').split(',').map(s=>s.trim()).filter(Boolean),
          prefecture:fd.get('prefecture')||'', city:fd.get('city')||'',
          jobType:fd.get('jobType')||'regular', open:!!fd.get('open'), intern:0, image:null
        };
        const file = fd.get('image');
        const finalize = (img)=>{
          payload.image = img || 'https://picsum.photos/seed/draft/800/450';
          const drafts = getDrafts(); drafts.push(payload); setDrafts(drafts);
          toast('ドラフト保存しました'); closeModal(); drawDraftList();
        };
        if(file && file.size){
          const fr=new FileReader(); fr.onload=()=>finalize(fr.result); fr.readAsDataURL(file);
        }else finalize(null);
      };
    });
  };

  drawDraftList();
}
function drawDraftList(){
  const host = $('#draftList'); if(!host) return;
  const drafts = getDrafts();
  host.innerHTML = drafts.length ? '' : '<div class="meta">ドラフトなし</div>';
  drafts.forEach(d=>{
    const el=document.createElement('div'); el.className='card';
    el.innerHTML = `
      <img class="thumb" src="${esc(d.image)}" alt="">
      <div style="padding:12px">
        <b>${esc(d.title)}</b> <span class="meta">／${esc(d.company)}・${esc(d.location)}</span>
        <div class="dim">職種:${esc(d.category)}｜時給${d.wage}｜週${d.days}〜｜${esc(d.prefecture)} ${esc(d.city)}</div>
      </div>
      <div class="row right" style="padding:0 12px 12px">
        <button class="btn" data-pub="${d.id}">公開</button>
        <button class="btn danger" data-del="${d.id}">削除</button>
      </div>`;
    host.appendChild(el);
  });
  host.onclick = (e)=>{
    const pub = e.target.closest('[data-pub]')?.dataset.pub;
    const del = e.target.closest('[data-del]')?.dataset.del;
    if(pub){ publishDraft(pub); }
    if(del){ setDrafts(getDrafts().filter(x=>x.id!==del)); toast('削除しました'); drawDraftList(); }
  };
}

/* ========= 管理（応募承認/ドラフト公開） ========= */
function drawAdmin(){
  // 応募
  const apps = getApps().slice().sort((a,b)=> +new Date(b.ts)-+new Date(a.ts));
  const wrap = $('#adminApps'); wrap.innerHTML = apps.length ? '' : '<div class="meta">承認待ちはありません</div>';
  apps.forEach(a=>{
    const job = allJobs().find(j=>j.id===a.jobId);
    const item=document.createElement('div'); item.className='item';
    item.innerHTML = `
      <div><b>${esc(a.name||'匿名')}</b> さん — <span class="meta">${new Date(a.ts).toLocaleString()}</span></div>
      <div class="dim">応募：${esc(job?.title||a.jobTitle||'不明')} ／ ${esc(job?.company||a.jobCompany||'')}</div>
      <div class="row gap-xs">
        <span class="badge">状態: ${esc(a.status||'pending')}</span>
        <button class="btn" data-approve="${a.id}">承認</button>
        <button class="btn danger" data-reject="${a.id}">却下</button>
      </div>`;
    wrap.appendChild(item);
  });
  wrap.onclick=(e)=>{
    const id = e.target.dataset.approve || e.target.dataset.reject;
    if(!id) return;
    const st = e.target.dataset.approve ? 'approved' : 'rejected';
    const arr = getApps(); const rec = arr.find(x=>x.id===id); if(rec){ rec.status=st; setApps(arr); toast(`状態を${st}に更新`); drawAdmin(); }
  };

  // ドラフト
  const dhost = $('#adminDrafts'); dhost.innerHTML='';
  const drafts = getDrafts();
  if(!drafts.length){ dhost.innerHTML='<div class="meta">公開可能なドラフトはありません</div>'; return; }
  drafts.forEach(d=>{
    const el=document.createElement('div'); el.className='card';
    el.innerHTML = `
      <img class="thumb" src="${esc(d.image)}" alt="">
      <div style="padding:12px"><b>${esc(d.title)}</b> <span class="meta">／${esc(d.company)}</span></div>
      <div class="row right" style="padding:0 12px 12px"><button class="btn" data-pub="${d.id}">公開</button></div>`;
    dhost.appendChild(el);
  });
  dhost.onclick=(e)=>{ const pub=e.target.closest('[data-pub]')?.dataset.pub; if(pub) publishDraft(pub); };
}

/* ========= アカウント ========= */
function renderAccount(){
  const u=currentUser(); const users=getUsers(); const me=users.find(x=>x.id===u.id)||{};
  $('#acctBox').innerHTML = u.email||u.name
    ? `<div>ユーザー：<b>${esc(u.name||u.email)}</b> <span class="meta">（${esc(u.provider||'local')}）</span></div>`
    : `<div class="meta">未ログイン（ゲストID：${esc(u.id)}）</div>`;

  const form=$('#profileForm');
  const setVal=(n,v)=>{ const el=form.querySelector(`[name="${n}"]`); if(el) el.value=v||''; };
  ['name','school','grade','major','wishRole','wishArea','wishWage','days','skills','links','bio'].forEach(k=> setVal(k, me[k] ?? (k==='name'?u.name:'')));

  const prev=$('#avatarPreview'); if(prev){ prev.classList.toggle('hidden', !u.avatar); if(u.avatar){ prev.src=u.avatar; } }

  $('#saveProfile').onclick=()=>{
    const data=Object.fromEntries(new FormData(form));
    const file=form.querySelector('[name="avatar"]').files[0];
    const proceed=(avatarData)=>{
      const arr=getUsers();
      let user=arr.find(x=>x.id===u.id);
      if(!user){
        user={ id:u.id, email:u.email||null, name:data.name||u.name||null, provider:u.provider||'local', createdAt:nowISO(), lastLoginAt:nowISO(), totalLogins:1 };
        arr.push(user);
      }
      Object.assign(user,{ name:data.name||user.name, school:data.school, grade:data.grade, major:data.major, wishRole:data.wishRole, wishArea:data.wishArea, wishWage:data.wishWage, days:data.days, skills:data.skills, links:data.links, bio:data.bio });
      if(avatarData){ user.avatar=avatarData; setJSON(LS.user,{...currentUser(), avatar:avatarData}); $('#avatarPreview').src=avatarData; $('#avatarPreview').classList.remove('hidden'); }
      setUsers(arr); toast('プロフィールを保存しました');
    };
    if(file){ const fr=new FileReader(); fr.onload=()=>proceed(fr.result); fr.readAsDataURL(file); } else proceed(null);
  };

  const myApps=getApps().filter(a=>a.userId===u.id).map(a=>({ ...a, job:allJobs().find(j=>j.id===a.jobId) }));
  $('#activityBox').innerHTML = myApps.length
    ? '<ul class="list">'+myApps.map(x=>`<li>「${esc(x.job?.title||'不明')}」 <span class="meta">（${esc(x.job?.company||'')}）</span> <span class="meta">— ${new Date(x.ts).toLocaleString()}</span> <span class="badge">${esc(x.status||'pending')}</span></li>`).join('')+'</ul>'
    : '<div class="meta">応募（参加）履歴はまだありません。</div>';
}

/* ========= モーダル/トースト ========= */
const modal=$('#modal'), modalBody=$('#modalBody');
function bindModal(){ $('#modalClose').onclick=()=>closeModal(); modal.addEventListener('click',(e)=>{ if(e.target===modal) closeModal(); }); }
function showModal(html,onReady){ modalBody.innerHTML=html; modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); if(onReady) onReady(); }
function closeModal(){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }
function toast(m){ const t=$('#toast'); t.textContent=m; t.style.display='block'; setTimeout(()=>t.style.display='none',1600); }

/* ========= 初期化 ========= */
function init(){
  bindGlobalClickRouter();
  bindAuthButtons();
  bindMenu();
  bindModal();
  setupRouting();
  mountFilters();

  refreshLogin();
  render(1);
  renderRegion();
  renderRanking();
  logEvent('view',{page:'jobs'});

  showFirstVisitPop();

  // 初回同期
  scheduleSync('users'); scheduleSync('events'); scheduleSync('applications');
  initEmployerForm();
}

// DOM 後に必ず実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
