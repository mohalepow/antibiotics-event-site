/* إعدادات Supabase في config.js */
const CONFIG = window.APP_CONFIG || {};
const hasBackend = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY &&
  !CONFIG.SUPABASE_URL.includes("YOUR_") && !CONFIG.SUPABASE_ANON_KEY.includes("YOUR_"));
const supabaseClient = hasBackend && window.supabase
  ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;

const $ = id => document.getElementById(id);
let booths = [];
let selectedId = null;
let editing = false;
let currentMapUrl = null;
const ar = n => new Intl.NumberFormat("ar-SA").format(n);
const toast = message => { $("toast").textContent=message; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),2600); };
const escapeText = value => String(value ?? "");

function setMap(url) {
  currentMapUrl = url || null;
  $("floorplan").src = url || "assets/floor-plan-placeholder.svg";
  $("map-empty").classList.toggle("hidden", Boolean(url));
}

async function loadData() {
  if (!supabaseClient) {
    booths = [];
    renderAll();
    $("booth-count").textContent = "٠ بوثات";
    return;
  }
  const [{data: boothData,error: boothError},{data: settingData,error: settingError}] = await Promise.all([
    supabaseClient.from("booths").select("*").order("booth_number"),
    supabaseClient.from("site_settings").select("value").eq("key","map_url").maybeSingle()
  ]);
  if (boothError) { console.error(boothError); toast("تعذر تحميل البوثات. راجع إعداد قاعدة البيانات."); }
  booths = boothData || [];
  setMap(settingData?.value || null);
  renderAll();
  window.dispatchEvent(new CustomEvent("event-booths-loaded"));
}

function renderAll() {
  $("booth-count").textContent = `${ar(booths.length)} بوثات`;
  renderPins(); renderBoothCards();
  if (selectedId && booths.some(b=>b.id===selectedId)) selectBooth(selectedId);
  else clearDetails();
  if (!$("admin-view").classList.contains("hidden")) renderAdminBooths();
}
function clearDetails() {
  $("details-empty").classList.remove("hidden");
  $("details-content").classList.add("hidden");
}
function selectBooth(id) {
  const b = booths.find(item=>item.id===id); if(!b) return;
  selectedId=id;
  $("details-empty").classList.add("hidden"); $("details-content").classList.remove("hidden");
  $("detail-number").textContent=`البوث ${ar(b.booth_number)}`;
  $("detail-category").textContent=b.category || "ركن توعوي";
  $("detail-icon").textContent=b.icon || "✚";
  $("detail-title").textContent=b.name;
  $("detail-description").textContent=b.description || "";
  $("detail-location").textContent=b.location || "يُحدد لاحقًا";
  document.querySelectorAll(".pin").forEach(p=>p.classList.toggle("active",Number(p.dataset.id)===id));
}
function renderPins() {
  $("map-pins").innerHTML="";
  booths.forEach(b=>{
    const pin=document.createElement("button"); pin.className="pin"; pin.type="button";
    pin.style.left=`${b.x}%`; pin.style.top=`${b.y}%`; pin.dataset.id=b.id;
    pin.setAttribute("aria-label",`عرض ${b.name}`);
    const span=document.createElement("span"); span.textContent=ar(b.booth_number); pin.append(span);
    pin.addEventListener("click",()=>selectBooth(b.id)); $("map-pins").append(pin);
  });
}
function renderBoothCards(query="") {
  const list=$("booth-list"); list.innerHTML="";
  const filtered=booths.filter(b=>`${b.name} ${b.category||""} ${b.location||""}`.toLowerCase().includes(query.trim().toLowerCase()));
  filtered.forEach(b=>{
    const card=document.createElement("button"); card.className="booth-card"; card.type="button";
    const head=document.createElement("div"); head.className="card-head";
    const no=document.createElement("span"); no.className="card-no"; no.textContent=`البوث ${ar(b.booth_number)}`;
    const icon=document.createElement("span"); icon.className="card-icon"; icon.textContent=b.icon||"✚"; head.append(no,icon);
    const title=document.createElement("h3"); title.textContent=b.name;
    const desc=document.createElement("p"); desc.textContent=b.description||"تفاصيل هذا البوث ستضاف قريبًا.";
    const loc=document.createElement("div"); loc.className="card-location"; loc.textContent=`⌖ ${b.location||"الموقع غير محدد"}`;
    card.append(head,title,desc,loc); card.addEventListener("click",()=>{selectBooth(b.id);$("map").scrollIntoView({behavior:"smooth"});}); list.append(card);
  });
  $("no-results").classList.toggle("hidden",filtered.length!==0);
}
$("search").addEventListener("input",e=>renderBoothCards(e.target.value));

function openModal(){ $("admin-modal").classList.remove("hidden"); }
function closeModal(){ $("admin-modal").classList.add("hidden"); }
$("admin-open").addEventListener("click",openModal); $("admin-close").addEventListener("click",closeModal);
$("admin-modal").addEventListener("click",e=>{if(e.target===$("admin-modal"))closeModal();});

let adminDashboardChannel = null;
let adminDashboardTimer = null;
let adminDashboardBusy = false;

function setDashboardNumber(id, value) {
  const node = $(id);
  if (node) node.textContent = ar(Number(value || 0));
}

function renderAdminVisitChart(rows = []) {
  const root = $("admin-visits-chart");
  if (!root) return;
  root.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "dashboard-empty";
    empty.textContent = "لا توجد زيارات مسجلة خلال هذه الفترة.";
    root.append(empty);
    return;
  }
  const max = Math.max(1, ...rows.map(row => Number(row.visits || 0)));
  rows.forEach(row => {
    const line = document.createElement("div");
    line.className = "visit-bar-row";
    const date = new Date(`${row.date}T12:00:00+03:00`);
    const day = document.createElement("span");
    day.className = "visit-day";
    day.textContent = new Intl.DateTimeFormat("ar-SA", { weekday: "short" }).format(date);
    const track = document.createElement("span");
    track.className = "visit-bar-track";
    const bar = document.createElement("span");
    bar.className = "visit-bar";
    const amount = Number(row.visits || 0);
    bar.style.width = `${amount ? Math.max(3, amount / max * 100) : 0}%`;
    track.append(bar);
    const count = document.createElement("b");
    count.className = "visit-count";
    count.textContent = ar(amount);
    line.append(day, track, count);
    root.append(line);
  });
}

function renderAdminPlayers(rootId, players = [], mode = "top") {
  const root = $(rootId);
  if (!root) return;
  root.replaceChildren();
  if (!players.length) {
    const empty = document.createElement("p");
    empty.className = "dashboard-empty";
    empty.textContent = "لا توجد بيانات مسجلة حتى الآن.";
    root.append(empty);
    return;
  }
  players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "admin-live-row";
    const rank = document.createElement("span");
    rank.className = mode === "top" ? "admin-live-rank" : "admin-live-date";
    if (mode === "top") {
      rank.textContent = ar(index + 1);
    } else {
      const date = player.updated_at ? new Date(player.updated_at) : null;
      rank.textContent = date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date)
        : "حديثًا";
    }
    const info = document.createElement("div");
    info.className = "admin-live-info";
    const name = document.createElement("b");
    name.textContent = player.display_name || "مشارك";
    const details = document.createElement("small");
    details.textContent = `اللعبة ${ar(player.game_points)} · الاختبار ${ar(player.quiz_points)}`;
    info.append(name, details);
    const points = document.createElement("strong");
    points.textContent = `${ar(player.total_score)} نقطة`;
    row.append(rank, info, points);
    root.append(row);
  });
}

async function loadAdminDashboard() {
  if (!supabaseClient || $("admin-view").classList.contains("hidden") || adminDashboardBusy) return;
  adminDashboardBusy = true;
  $("dashboard-error").classList.add("hidden");
  try {
    const { data, error } = await supabaseClient.rpc("get_admin_dashboard");
    if (error) throw error;
    const stats = data || {};
    setDashboardNumber("admin-visits-today", stats.visits_today);
    setDashboardNumber("admin-visits-total", stats.visits_total);
    setDashboardNumber("admin-participants", stats.participants);
    setDashboardNumber("admin-points", stats.total_points);
    setDashboardNumber("admin-games", stats.game_attempts);
    setDashboardNumber("admin-quizzes", stats.quizzes_completed);
    setDashboardNumber("admin-badges", stats.badges_earned);
    setDashboardNumber("admin-booths-count", stats.booths);
    renderAdminVisitChart(Array.isArray(stats.visits_week) ? stats.visits_week : []);
    renderAdminPlayers("admin-top-players", Array.isArray(stats.top_players) ? stats.top_players : [], "top");
    renderAdminPlayers("admin-recent-players", Array.isArray(stats.recent_players) ? stats.recent_players : [], "recent");
    $("dashboard-updated").textContent = `آخر تحديث: ${new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  } catch (error) {
    console.error("Admin dashboard:", error);
    $("dashboard-error").textContent = "تعذر تحميل الإحصائيات. تأكد من تشغيل ملف supabase-upgrade-dashboard.sql ومن دخولك بحساب مدير مفعل.";
    $("dashboard-error").classList.remove("hidden");
    $("admin-live-state").innerHTML = "<i></i> يحتاج إلى إعداد";
  } finally {
    adminDashboardBusy = false;
  }
}

function stopAdminLiveUpdates() {
  if (adminDashboardTimer) clearInterval(adminDashboardTimer);
  adminDashboardTimer = null;
  if (adminDashboardChannel && supabaseClient) supabaseClient.removeChannel(adminDashboardChannel);
  adminDashboardChannel = null;
}

function startAdminLiveUpdates() {
  if (!supabaseClient) return;
  stopAdminLiveUpdates();
  loadAdminDashboard();
  adminDashboardTimer = setInterval(loadAdminDashboard, 30000);
  adminDashboardChannel = supabaseClient.channel("admin-dashboard-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "event_leaderboard" }, loadAdminDashboard)
    .on("postgres_changes", { event: "*", schema: "public", table: "player_achievements" }, loadAdminDashboard)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_visits" }, loadAdminDashboard)
    .on("postgres_changes", { event: "*", schema: "public", table: "booths" }, loadAdminDashboard)
    .subscribe(status => {
      const node = $("admin-live-state");
      if (!node) return;
      node.innerHTML = status === "SUBSCRIBED" ? "<i></i> متصل بالتحديث الفوري" : "<i></i> تحديث تلقائي كل ٣٠ ثانية";
    });
}

$("refresh-dashboard")?.addEventListener("click", loadAdminDashboard);

function showAdmin(session) {
  $("login-view").classList.toggle("hidden",Boolean(session));
  $("admin-view").classList.toggle("hidden",!session);
  if(session){
    $("admin-email").textContent=session.user.email||"المدير";
    renderAdminBooths();
    startAdminLiveUpdates();
  } else {
    stopAdminLiveUpdates();
  }
}
async function checkSession(){
  if(!supabaseClient){$("login-error").textContent="قاعدة البيانات غير مربوطة بعد. أكمل إعداد Supabase حسب ملف README.";return;}
  const {data}=await supabaseClient.auth.getSession(); showAdmin(data.session);
  supabaseClient.auth.onAuthStateChange((_event,session)=>showAdmin(session));
}
$("login-btn").addEventListener("click",async()=>{
  if(!supabaseClient){$("login-error").textContent="أكمل إعداد Supabase أولًا.";return;}
  $("login-error").textContent="";
  const {data,error}=await supabaseClient.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if(error){$("login-error").textContent="تعذر تسجيل الدخول. تأكد من بيانات المدير وإعدادات المشروع.";return;}
  showAdmin(data.session); await loadData();
});
$("logout-btn").addEventListener("click",async()=>{await supabaseClient.auth.signOut();showAdmin(null);});

function renderAdminBooths(){
  const root=$("admin-booths"); root.innerHTML="";
  const add=document.createElement("button"); add.className="primary full";add.textContent="+ إضافة بوث";add.disabled=booths.length>=5;
  add.addEventListener("click",()=>openEditor());root.append(add);
  booths.forEach(b=>{
    const row=document.createElement("div");row.className="admin-booth-row";
    const name=document.createElement("span");name.textContent=`${ar(b.booth_number)}. ${b.name}`;
    const actions=document.createElement("div");actions.className="row-actions";
    const qr=document.createElement("button");qr.className="small-btn";qr.textContent="QR";qr.type="button";qr.onclick=()=>openBoothQr(b);
    const edit=document.createElement("button");edit.className="small-btn";edit.textContent="تعديل";edit.onclick=()=>openEditor(b);
    const del=document.createElement("button");del.className="small-btn danger";del.textContent="حذف";del.onclick=()=>deleteBooth(b.id);
    actions.append(qr,edit,del);row.append(name,actions);
  });
}
function getBoothVisitUrl(boothId){
  const url=new URL(window.location.href);
  url.searchParams.set("booth",String(boothId));
  url.hash="";
  return url.toString();
}
function openBoothQr(booth){
  const visitUrl=getBoothVisitUrl(booth.id);
  $("booth-qr-title").textContent=`QR · ${booth.name}`;
  $("booth-qr-caption").textContent=`رمز تسجيل زيارة: ${booth.name}`;
  $("booth-qr-image").src=`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=${encodeURIComponent(visitUrl)}`;
  $("booth-qr-open").href=visitUrl;
  $("booth-qr-open").textContent="فتح رابط الزيارة";
  $("booth-qr-modal").classList.remove("hidden");
}
$("booth-qr-close")?.addEventListener("click",()=>$("booth-qr-modal").classList.add("hidden"));
$("booth-qr-modal")?.addEventListener("click",e=>{if(e.target===$("booth-qr-modal"))$("booth-qr-modal").classList.add("hidden");});

function openEditor(b=null){
  if(!b && booths.length>=5){toast("وصلت للحد الأعلى: ٥ بوثات");return;}
  editing=Boolean(b);$("booth-editor").classList.remove("hidden");
  $("editor-title").textContent=b?"تعديل بيانات البوث":"إضافة بوث جديد";
  $("edit-id").value=b?.id||"";
  $("edit-name").value=b?.name||"";$("edit-category").value=b?.category||"";
  $("edit-description").value=b?.description||"";$("edit-location").value=b?.location||"";
  $("edit-x").value=b?.x??50;$("edit-y").value=b?.y??50;syncBoothPreviewImage();updateCoords();
  $("save-status").textContent="اضغط على الخريطة لتحديد موقع البوث أو حرّك المؤشرات.";
  $("booth-editor").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function updateCoords(){
  $("x-value").textContent=$("edit-x").value+"%";
  $("y-value").textContent=$("edit-y").value+"%";
  updateBoothPreviewMarker();
}
function updateBoothPreviewMarker(){
  const marker=$("booth-preview-marker");
  if(!marker)return;
  marker.style.left=Number($("edit-x").value)+"%";
  marker.style.top=Number($("edit-y").value)+"%";
}
function syncBoothPreviewImage(){
  const source=$("floorplan");
  const preview=$("booth-preview-image");
  if(source&&preview)preview.src=source.src;
}
function moveBoothPreview(clientX,clientY){
  const preview=$("booth-live-preview");
  const rect=preview.getBoundingClientRect();
  const x=Math.max(1,Math.min(99,Math.round((clientX-rect.left)/rect.width*100)));
  const y=Math.max(1,Math.min(99,Math.round((clientY-rect.top)/rect.height*100)));
  $("edit-x").value=x;$("edit-y").value=y;updateCoords();
}
let boothPreviewDragging=false;
$("booth-live-preview")?.addEventListener("pointerdown",e=>{
  boothPreviewDragging=true;
  e.currentTarget.setPointerCapture(e.pointerId);
  moveBoothPreview(e.clientX,e.clientY);
});
$("booth-live-preview")?.addEventListener("pointermove",e=>{
  if(boothPreviewDragging)moveBoothPreview(e.clientX,e.clientY);
});
$("booth-live-preview")?.addEventListener("pointerup",()=>{boothPreviewDragging=false;});
$("booth-live-preview")?.addEventListener("pointercancel",()=>{boothPreviewDragging=false;});
$("edit-x").addEventListener("input",updateCoords);$("edit-y").addEventListener("input",updateCoords);
$("cancel-edit").addEventListener("click",()=>$("booth-editor").classList.add("hidden"));

$("save-booth").addEventListener("click",async()=>{
  if(!supabaseClient)return;
  const name=$("edit-name").value.trim();
  if(!name){$("save-status").textContent="اكتب اسم البوث أولًا.";return;}
  const id=$("edit-id").value;
  const payload={name,category:$("edit-category").value.trim(),description:$("edit-description").value.trim(),location:$("edit-location").value.trim(),x:Number($("edit-x").value),y:Number($("edit-y").value),icon:"✚"};
  let result;
  if(id) result=await supabaseClient.from("booths").update(payload).eq("id",id);
  else {const next=Math.max(0,...booths.map(b=>b.booth_number))+1;result=await supabaseClient.from("booths").insert({...payload,booth_number:next});}
  if(result.error){console.error(result.error);$("save-status").textContent="تعذر الحفظ. تأكد من تشغيل SQL وسياسات الصلاحيات.";return;}
  $("booth-editor").classList.add("hidden");await loadData();toast("تم حفظ بيانات البوث");
});
async function deleteBooth(id){
  if(!confirm("هل أنت متأكد من حذف هذا البوث؟"))return;
  const {error}=await supabaseClient.from("booths").delete().eq("id",id);
  if(error){toast("تعذر حذف البوث؛ تحقق من الصلاحيات.");return;}
  if(selectedId===id){selectedId=null;clearDetails();}
  await loadData();toast("تم حذف البوث");
}

$("upload-map").addEventListener("click",async()=>{
  if(!supabaseClient)return;
  const file=$("map-upload").files[0];if(!file){$("map-status").textContent="اختر صورة المخطط أولًا.";return;}
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){ $("map-status").textContent="الصيغ المدعومة: JPG وPNG وWEBP.";return;}
  if(file.size>5*1024*1024){$("map-status").textContent="حجم الصورة يجب ألا يتجاوز ٥ ميجابايت.";return;}
  $("map-status").textContent="جارٍ رفع الصورة...";
  const ext=file.name.split(".").pop().toLowerCase();
  const path=`floor-plan-${Date.now()}.${ext}`;
  const {error:uploadError}=await supabaseClient.storage.from("event-map").upload(path,file,{upsert:true,contentType:file.type});
  if(uploadError){console.error(uploadError);$("map-status").textContent="فشل الرفع. تأكد من إنشاء bucket باسم event-map.";return;}
  const {data}=supabaseClient.storage.from("event-map").getPublicUrl(path);
  const {error:saveError}=await supabaseClient.from("site_settings").upsert({key:"map_url",value:data.publicUrl});
  if(saveError){$("map-status").textContent="تم رفع الصورة لكن تعذر حفظ رابطها.";return;}
  setMap(data.publicUrl);$("map-status").textContent="تم تحديث صورة المخطط لجميع الزوار.";toast("تم رفع المخطط بنجاح");
});

function getVisitorKey() {
  const keyName = "antibiotics-event-visitor-id";
  try {
    let key = localStorage.getItem(keyName);
    if (!key || !/^[0-9a-f-]{36}$/i.test(key)) {
      key = window.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
        const random = Math.random() * 16 | 0;
        return (char === "x" ? random : (random & 3 | 8)).toString(16);
      });
      localStorage.setItem(keyName, key);
    }
    return key;
  } catch (error) {
    return window.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
      const random = Math.random() * 16 | 0;
      return (char === "x" ? random : (random & 3 | 8)).toString(16);
    });
  }
}

async function recordEventVisit() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.rpc("record_event_visit", { p_visitor_key: getVisitorKey() });
  if (error) console.warn("Visit tracking is unavailable until the dashboard SQL upgrade is applied.", error);
}

async function start(){
  if(!supabaseClient){
    $("map-empty").classList.remove("hidden");
    $("login-error").textContent="اربط المشروع بـ Supabase لإتاحة إدارة البوثات وحفظها للزوار.";
    booths=[];renderAll();return;
  }
  await recordEventVisit();
  await loadData();await checkSession();
}
start();


/* لعبة رحلة المضاد الحيوي ولوحة المتصدرين */
(()=>{
 const canvas=$("game-canvas"); if(!canvas)return;
 const ctx=canvas.getContext("2d");
 let width=800,height=430,dpr=1,raf=0,running=false,ended=false,score=0,best=0;
 let player={x:width*.27,y:height*.48,vy:0};
 let obstacles=[],frame=0,lastTime=0,obstacleTimer=0,submitPending=false,particles=[];
 let soundEnabled=true,audioContext=null,lastBump=0;
 let currentRunId=null,scoreSubmitted=false;
 function createRunId(){
   if(window.crypto?.randomUUID)return window.crypto.randomUUID();
   return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
     const r=Math.random()*16|0;return (c==="x"?r:(r&3|8)).toString(16);
   });
 }
 const BASE_GRAVITY=.34,BASE_LIFT=-6.2,BASE_GAP=154,BASE_SPEED=2.7,OBSTACLE_WIDTH=54;
 function difficulty(){
   const tier=Math.floor(score/10);
   const verticalMargin=Math.min(54,Math.max(34,height*.14));
   const maxGap=Math.max(108,height-verticalMargin*2);
   const startGap=Math.min(BASE_GAP,maxGap);
   const minGap=Math.min(108,maxGap);
   return {
     level:tier+1,
     gravity:Math.min(BASE_GRAVITY+tier*.018,.49),
     lift:Math.max(BASE_LIFT-tier*.13,-7.8),
     gap:Math.max(startGap-tier*6,minGap),
     speed:Math.min(BASE_SPEED+tier*.32,5.6),
     spawnInterval:Math.max(88-tier*4,54),
     margin:verticalMargin
   };
 }
 function updateDifficultyUI(){
   const current=difficulty();
   $("game-level").textContent=scoreText(current.level);
   $("game-difficulty-note").textContent=current.level===1
     ?"تزداد الصعوبة كل ١٠ نقاط"
     :`المستوى ${scoreText(current.level)}: سرعة أعلى وفجوات أضيق`;
 }
 function playTone(freq=520,duration=.07,type="sine",volume=.035,slide=0){
   if(!soundEnabled)return;
   try{
     const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
     audioContext=audioContext||new AudioCtx();if(audioContext.state==="suspended")audioContext.resume();
     const osc=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
     osc.type=type;osc.frequency.setValueAtTime(freq,now);if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),now+duration);
     gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
     osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+duration);
   }catch(e){/* Optional audio depends on browser support. */}
 }
 function burst(x,y,color="#F5EDE2",count=10){
   for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,sp=1+Math.random()*3;particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:24+Math.random()*12,max:36,size:1.5+Math.random()*2,color});}
 }
 function updateParticles(dt){particles=particles.filter(p=>p.life>0);particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.035*dt;p.life-=dt;});}
 function drawParticles(){particles.forEach(p=>{ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();ctx.restore();});}
 const scoreText=n=>new Intl.NumberFormat("ar-SA").format(n);
 function resize(){
   const rect=canvas.getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,2);
   width=Math.max(320,rect.width);height=Math.max(240,rect.height);
   canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
   ctx.setTransform(dpr,0,0,dpr,0,0);
   if(!running)draw();
 }
 function capsule(x,y){
   ctx.save();ctx.translate(x,y);ctx.rotate(Math.max(-.45,Math.min(.55,player.vy*.055)));
   ctx.shadowColor="#B08B44";ctx.shadowBlur=15;
   const w=39,h=19;
   ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,h/2);ctx.clip();
   const grad=ctx.createLinearGradient(-w/2,0,w/2,0);grad.addColorStop(0,"#F5EDE2");grad.addColorStop(.49,"#F5EDE2");grad.addColorStop(.51,"#B08B44");grad.addColorStop(1,"#B08B44");
   ctx.fillStyle=grad;ctx.fillRect(-w/2,-h/2,w,h);
   ctx.restore();
   ctx.save();ctx.translate(x,y);ctx.rotate(Math.max(-.45,Math.min(.55,player.vy*.055)));ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(-19.5,-9.5,39,19,10);ctx.stroke();ctx.restore();
 }
 function drawCell(x,y,r,alpha=1){
   ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x-r*.3,y-r*.3,2,x,y,r);g.addColorStop(0,"#B78F49");g.addColorStop(.7,"#A78847");g.addColorStop(1,"#08424D");ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#F5EDE255";ctx.lineWidth=3;ctx.stroke();ctx.restore();
 }
 function background(){
   const g=ctx.createLinearGradient(0,0,0,height);g.addColorStop(0,"#08424D");g.addColorStop(1,"#03252F");ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
   for(let i=0;i<7;i++){const x=((i*151-frame*.25)%(width+100)+width+100)%(width+100);drawCell(x,45+(i*79)%Math.max(100,height-70),13+(i%3)*5,.3);}
   ctx.strokeStyle="#0C6C7855";ctx.lineWidth=2;
   for(let y=35;y<height;y+=70){ctx.beginPath();ctx.moveTo(0,y+Math.sin((frame+y)*.012)*9);ctx.bezierCurveTo(width*.3,y-20,width*.7,y+20,width,y+Math.cos((frame+y)*.012)*9);ctx.stroke();}
   for(let i=0;i<18;i++){const x=(i*71+frame*.55)%(width+10),y=(i*47+Math.sin(frame*.025+i)*20)%height;ctx.fillStyle="#F5EDE277";ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();}
 }
 function drawObstacle(o){
   const w=OBSTACLE_WIDTH,gapSize=o.gap;
   const grad=ctx.createLinearGradient(o.x,0,o.x+w,0);grad.addColorStop(0,"#A78847");grad.addColorStop(.5,"#F5EDE2");grad.addColorStop(1,"#B08B44");
   ctx.fillStyle=grad;ctx.shadowColor="#B78F4944";ctx.shadowBlur=10;
   ctx.beginPath();ctx.roundRect(o.x,-8,w,o.top+8,[0,0,13,13]);ctx.fill();
   ctx.beginPath();ctx.roundRect(o.x,o.top+gapSize,w,height-o.top-gapSize+8,[13,13,0,0]);ctx.fill();ctx.shadowBlur=0;
   ctx.fillStyle="#B08B44";ctx.fillRect(o.x-5,o.top-12,w+10,12);ctx.fillRect(o.x-5,o.top+gapSize,w+10,12);
   for(let j=0;j<3;j++){drawCell(o.x+12+j*15,Math.max(14,o.top-28),5,.65);drawCell(o.x+12+j*15,Math.min(height-12,o.top+gapSize+28),5,.65);}
 }
 function draw(){
   background();obstacles.forEach(drawObstacle);drawParticles();capsule(player.x,player.y);
   if(running){ctx.fillStyle="#ffffffaa";ctx.font='bold 12px "MediaPro", "Arabic Diwani", Tahoma, sans-serif';ctx.textAlign="right";ctx.fillText("رحلة داخل مجرى الدم",width-16,25);}
 }
 function reset(){
   score=0;frame=0;obstacleTimer=0;obstacles=[];particles=[];player={x:Math.max(75,width*.27),y:height*.48,vy:0};
   currentRunId=createRunId();scoreSubmitted=false;
   $("submit-score").disabled=false;$("score-status").textContent="";
   $("game-score").textContent=scoreText(0);$("game-submit").classList.add("hidden");updateDifficultyUI();
   ended=false;submitPending=false;
 }
 function start(){
   if(raf)cancelAnimationFrame(raf);reset();running=true;
   $("game-overlay").classList.add("hidden");lastTime=0;raf=requestAnimationFrame(loop);
 }
 function flap(){if(running){player.vy=difficulty().lift;burst(player.x-15,player.y,"#F5EDE2",3);playTone(570,.055,"sine",.022,170);}else if(ended){start();}}
 function finish(){
   running=false;ended=true;cancelAnimationFrame(raf);raf=0;burst(player.x,player.y,"#B78F49",22);playTone(210,.22,"triangle",.055,-100);$("game-stage").classList.remove("bump");void $("game-stage").offsetWidth;$("game-stage").classList.add("bump");
   $("game-message-title").textContent="انتهت الرحلة!";
   $("game-message").textContent=`جمعت ${scoreText(score)} نقطة ووصلت إلى المستوى ${scoreText(difficulty().level)}. سجّل اسمك وأضف نتيجتك إلى لوحة المتصدرين.`;
   $("game-start").textContent="العب مرة ثانية";$("game-overlay").classList.remove("hidden");
   $("game-submit").classList.remove("hidden");$("player-name").focus();
 }
 function loop(time){
   if(!running)return;
   const dt=lastTime?Math.min(2,(time-lastTime)/16.67):1;lastTime=time;frame+=dt;
   const current=difficulty();
   player.vy+=current.gravity*dt;player.y+=player.vy*dt;
   obstacleTimer+=dt;
   if(obstacleTimer>=current.spawnInterval){
     obstacleTimer-=current.spawnInterval;
     const topLimit=Math.max(current.margin,height-current.gap-current.margin);
     const top=current.margin+Math.random()*Math.max(0,topLimit-current.margin);
     obstacles.push({x:width+10,top,gap:current.gap,speed:current.speed,passed:false});
   }
   obstacles.forEach(o=>{
     o.x-=o.speed*dt;
     if(!o.passed&&o.x+OBSTACLE_WIDTH<player.x){
       o.passed=true;score++;$("game-score").textContent=scoreText(score);best=Math.max(best,score);$("game-best").textContent=scoreText(best);
       if(score%10===0){updateDifficultyUI();burst(player.x+18,player.y,"#B78F49",18);playTone(920,.18,"triangle",.045,340);}
       else{burst(player.x+18,player.y,"#F5EDE2",9);playTone(760,.09,"sine",.035,260);}
       $("game-stage").classList.remove("score-pop");void $("game-stage").offsetWidth;$("game-stage").classList.add("score-pop");
     }
     const hitX=player.x+15>o.x&&player.x-15<o.x+OBSTACLE_WIDTH;
     const hitY=player.y-8<o.top||player.y+8>o.top+o.gap;
     if(hitX&&hitY)finish();
   });
   obstacles=obstacles.filter(o=>o.x>-65);
   if(player.y<8||player.y>height-8)finish();
   updateParticles(dt);draw();if(running)raf=requestAnimationFrame(loop);
 }
 $("game-start").addEventListener("click",()=>{playTone(480,.08,"sine",.025,180);start();});
 $("game-flap").addEventListener("click",flap);
 $("game-sound").addEventListener("click",()=>{soundEnabled=!soundEnabled;$("game-sound").textContent=soundEnabled?"🔊 الصوت يعمل":"🔇 الصوت مكتوم";$("game-sound").setAttribute("aria-pressed",String(soundEnabled));if(soundEnabled)playTone(620,.08,"sine",.025,120);});
 $("game-stage").addEventListener("pointerdown",e=>{if(e.target.closest(".game-overlay"))return;e.preventDefault();flap();});
 window.addEventListener("keydown",e=>{if((e.code==="Space"||e.code==="ArrowUp")&&$("game").getBoundingClientRect().top<window.innerHeight&&$("game").getBoundingClientRect().bottom>0){e.preventDefault();if(!running&&ended)return;flap();}});
 window.addEventListener("resize",resize);resize();

 // Participant profile, quiz, unified leaderboard, and achievement badges.
 const PLAYER_NAME_KEY="antibiotics-event-player-name";
 const BADGES=[
  {id:"first_activity",icon:"🌱",title:"بداية الرحلة",description:"سجّل أول نتيجة في أحد أنشطة الفعالية."},
  {id:"quiz_starter",icon:"📚",title:"محب المعرفة",description:"أكمل أول اختبار معرفي."},
  {id:"perfect_quiz",icon:"🧠",title:"خبير المضادات",description:"أجب عن أسئلة اختبار واحد إجابة صحيحة بالكامل."},
  {id:"game_veteran",icon:"🎮",title:"عاشق التحدي",description:"سجّل نتائج ٣ محاولات في اللعبة."},
  {id:"fifty_points",icon:"🏅",title:"جامع النقاط",description:"اجمع ٥٠ نقطة أو أكثر من جميع الأنشطة."},
  {id:"all_rounder",icon:"🏆",title:"بطل الفعالية",description:"سجّل نتيجة في اللعبة وأكمل اختبارًا معرفيًا."}
 ];
 const QUIZ=[
  {q:"متى يمكن أن تكون المضادات الحيوية مفيدة؟",a:["لعلاج نزلات البرد والإنفلونزا","لعلاج بعض العدوى البكتيرية عندما يقرر المختص الحاجة إليها","لعلاج جميع أنواع الألم","للوقاية من كل أنواع العدوى"],why:"المضادات الحيوية تعالج بعض العدوى التي تسببها البكتيريا، ويحدد المختص متى تكون مناسبة."},
  {q:"ما الذي يكتسب القدرة على مقاومة المضاد الحيوي؟",a:["جسم الإنسان","جهاز المناعة","البكتيريا","الدواء نفسه"],why:"المقاومة تحدث عندما تطوّر البكتيريا القدرة على التصدي للأدوية المصممة للقضاء عليها."},
  {q:"ما الصحيح بخصوص نزلات البرد والإنفلونزا؟",a:["المضادات الحيوية لا تعالج الفيروسات المسببة لها","تحتاج دائمًا إلى مضاد حيوي","زيادة الجرعة تسرّع الشفاء","يمكن استخدام أي مضاد متوفر"],why:"المضادات الحيوية لا تعمل ضد الفيروسات، ومنها الفيروسات المسببة للبرد والإنفلونزا."},
  {q:"ماذا تفعل بالمضاد الحيوي المتبقي من وصفة سابقة؟",a:["تحتفظ به للمرض القادم","تعطيه لشخص لديه أعراض مشابهة","تضاعف الجرعة عند الحاجة","لا تستخدمه لاحقًا أو تشاركه، واسأل الصيدلي عن التخلص الآمن منه"],why:"لا تستخدم بقايا المضادات لمرض آخر ولا تشاركها؛ فقد لا تكون مناسبة وقد تؤخر العلاج الصحيح."},
  {q:"إذا وصف لك الطبيب مضادًا حيويًا، فما التصرف الصحيح؟",a:["توقف عنه أو تغيّر الجرعة بمجرد التحسن","تلتزم بالجرعة والتعليمات الموصوفة وتستشير المختص عند وجود مشكلة","تشارك الدواء مع أحد أفراد الأسرة","تضاعف الجرعة إذا نسيت جرعة"],why:"استخدم المضاد تمامًا وفق تعليمات الطبيب أو الصيدلي، ولا تغيّر العلاج بنفسك."}
 ];
 let savedPlayerName="";
 try{savedPlayerName=localStorage.getItem(PLAYER_NAME_KEY)||"";}catch(e){/* Storage may be disabled. */}
 if($("profile-name"))$("profile-name").value=savedPlayerName;
 if($("player-name"))$("player-name").value=savedPlayerName;
 const getPlayerName=()=>($("profile-name")?.value||savedPlayerName||$("player-name")?.value||"").trim();
 function rememberPlayerName(name){
   savedPlayerName=name;
   if($("profile-name"))$("profile-name").value=name;
   if($("player-name"))$("player-name").value=name;
   try{localStorage.setItem(PLAYER_NAME_KEY,name);}catch(e){/* Name remains available for this page session. */}
 }
 function renderQuiz(){
   const root=$("quiz-questions");if(!root)return;root.innerHTML="";
   QUIZ.forEach((question,index)=>{
     const card=document.createElement("fieldset");card.className="quiz-question";
     const legend=document.createElement("legend");legend.textContent=`${ar(index+1)}. ${question.q}`;
     const options=document.createElement("div");options.className="quiz-options";
     question.a.forEach((answer,optionIndex)=>{
       const label=document.createElement("label");label.className="quiz-option";
       const radio=document.createElement("input");radio.type="radio";radio.name=`quiz-answer-${index}`;radio.value=String(optionIndex);
       const text=document.createElement("span");text.textContent=answer;
       label.append(radio,text);options.append(label);
     });
     card.append(legend,options);root.append(card);
   });
 }
 async function loadPlayerDashboard(){
   const root=$("achievement-grid");if(!root)return;
   const name=getPlayerName();
   if(!name){root.innerHTML='<p class="leader-empty">احفظ اسمك لعرض إنجازاتك ومتابعة مجموع نقاطك.</p>';$("stat-total").textContent=ar(0);$("stat-games").textContent=ar(0);$("stat-quizzes").textContent=ar(0);return;}
   if(!supabaseClient){root.innerHTML='<p class="leader-empty">اربط Supabase ثم نفّذ ملف تحديث قاعدة البيانات لتفعيل حفظ الإنجازات.</p>';return;}
   const key=name.toLocaleLowerCase();
   const [statsResult,badgesResult,boothVisitsResult]=await Promise.all([
     supabaseClient.from("event_leaderboard").select("total_score,game_points,quiz_points,games_played,quizzes_completed,perfect_quizzes").eq("player_key",key).maybeSingle(),
     supabaseClient.from("player_achievements").select("badge_id,earned_at").eq("player_key",key),
     supabaseClient.rpc("get_visited_booths",{p_player_name:name})
   ]);
   if(statsResult.error||badgesResult.error||boothVisitsResult.error){console.error(statsResult.error||badgesResult.error||boothVisitsResult.error);root.innerHTML='<p class="leader-empty">تعذر تحميل الإنجازات. تأكد من تشغيل ملفات SQL المطلوبة.</p>';return;}
   const stats=statsResult.data||{total_score:0,game_points:0,quiz_points:0,games_played:0,quizzes_completed:0,perfect_quizzes:0};
   $("stat-total").textContent=ar(stats.total_score||0);$("stat-games").textContent=ar(stats.games_played||0);$("stat-quizzes").textContent=ar(stats.quizzes_completed||0);
   const earned=new Map((badgesResult.data||[]).map(b=>[b.badge_id,b.earned_at]));root.innerHTML="";
   const boothVisits=new Map((boothVisitsResult.data||[]).map(item=>[String(item.booth_id),item.visited_at]));
   const allBadges=[...BADGES,...booths.map(booth=>({
     id:`booth:${booth.id}`,icon:"📍",title:booth.name,
     description:`زر بوث «${booth.name}» وامسح رمز QR الخاص به لفتح هذا الإنجاز.`,
     earnedAt:boothVisits.get(String(booth.id))||null
   }))];
   BADGES.forEach(badge=>{
     const earnedAt=earned.get(badge.id);const card=document.createElement("article");card.className=`achievement-badge${earnedAt?" earned":" locked"}`;
     const icon=document.createElement("span");icon.className="badge-icon";icon.textContent=badge.icon;
     const title=document.createElement("b");title.textContent=badge.title;
     const desc=document.createElement("p");desc.textContent=badge.description;
     const status=document.createElement("small");status.className="badge-status";
     if(earnedAt){status.textContent="مكتسبة · "+new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium"}).format(new Date(earnedAt));}
     else status.textContent="🔒 لم تُفتح بعد";
     card.append(icon,title,desc,status);root.append(card);
   });
   allBadges.filter(badge=>badge.id.startsWith("booth:")).forEach(badge=>{
     const card=document.createElement("article");card.className=`achievement-badge${badge.earnedAt?" earned":" locked"}`;
     const icon=document.createElement("span");icon.className="badge-icon";icon.textContent=badge.icon;
     const title=document.createElement("b");title.textContent=badge.title;
     const desc=document.createElement("p");desc.textContent=badge.description;
     const status=document.createElement("small");status.className="badge-status";
     status.textContent=badge.earnedAt?"تمت الزيارة · "+new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium"}).format(new Date(badge.earnedAt)):"🔒 لم تتم الزيارة بعد";
     card.append(icon,title,desc,status);root.append(card);
   });
 }
 let pendingQrBooth = null;
 async function openBoothCheckin(){
   const boothId=new URLSearchParams(window.location.search).get("booth");
   if(!boothId || !supabaseClient)return;
   const booth=booths.find(item=>String(item.id)===String(boothId));
   if(!booth){$("booth-checkin-status").textContent="تعذر العثور على هذا البوث. تأكد من أن رمز QR ما زال صالحًا.";return;}
   pendingQrBooth=booth;
   $("booth-checkin-name").textContent=booth.name;
   $("booth-checkin-player").value=getPlayerName()||savedPlayerName;
   $("booth-checkin-status").textContent="";
   $("booth-checkin-modal").classList.remove("hidden");
 }
 window.addEventListener("event-booths-loaded",openBoothCheckin);
 $("booth-checkin-close")?.addEventListener("click",()=>$("booth-checkin-modal").classList.add("hidden"));
 $("booth-checkin-modal")?.addEventListener("click",e=>{if(e.target===$("booth-checkin-modal"))$("booth-checkin-modal").classList.add("hidden");});
 $("booth-checkin-submit")?.addEventListener("click",async()=>{
   if(!pendingQrBooth)return;
   const name=$("booth-checkin-player").value.trim();
   if(name.length<2||name.length>18){$("booth-checkin-status").textContent="اكتب اسمًا من حرفين إلى ١٨ حرفًا.";return;}
   const button=$("booth-checkin-submit");button.disabled=true;$("booth-checkin-status").textContent="جارٍ تسجيل زيارتك...";
   const {data,error}=await supabaseClient.rpc("record_booth_visit",{p_booth_id:String(pendingQrBooth.id),p_player_name:name});
   button.disabled=false;
   if(error){console.error("Booth visit:",error);$("booth-checkin-status").textContent="تعذر تسجيل الزيارة. نفّذ ملف supabase-upgrade-booth-visits.sql أولًا.";return;}
   rememberPlayerName(name);
   $("booth-checkin-status").textContent=data?.already_visited?"هذه الزيارة مسجلة مسبقًا، وشارة البوث موجودة في إنجازاتك.":"تم تسجيل زيارتك بنجاح! أُضيف إنجاز هذا البوث إلى ملفك.";
   $("booth-checkin-submit").textContent=data?.already_visited?"تم تسجيل الزيارة":"تمت الزيارة ✓";
   await loadPlayerDashboard();
 });
 $("save-profile")?.addEventListener("click",async()=>{
   const name=$("profile-name").value.trim();
   if(name.length<2||name.length>18){$("profile-status").textContent="اكتب اسمًا من حرفين إلى ١٨ حرفًا.";return;}
   rememberPlayerName(name);$("profile-status").textContent="تم حفظ اسمك على هذا الجهاز. استخدم الاسم نفسه في جميع الأنشطة.";
   await loadPlayerDashboard();
 });
 renderQuiz();
 $("quiz-submit")?.addEventListener("click",async()=>{
   const name=getPlayerName();
   if(name.length<2||name.length>18){$("quiz-status").textContent="احفظ اسمك في قسم إنجازاتي أولًا.";$("profile-name")?.focus();return;}
   const answers=QUIZ.map((q,index)=>{const selected=document.querySelector(`input[name="quiz-answer-${index}"]:checked`);return selected?Number(selected.value):null;});
   if(answers.some(answer=>answer===null)){$("quiz-status").textContent="أجب عن الأسئلة الخمسة قبل اعتماد إجاباتك.";return;}
   if(!supabaseClient){$("quiz-status").textContent="اربط الموقع بـ Supabase لتسجيل نقاط الاختبار.";return;}
   const button=$("quiz-submit");button.disabled=true;$("quiz-status").textContent="جارٍ تصحيح إجاباتك وتسجيل النقاط...";
   const {data,error}=await supabaseClient.rpc("submit_quiz_score",{p_name:name,p_answers:answers});
   button.disabled=false;
   if(error){console.error(error);$("quiz-status").textContent="تعذر تسجيل نتيجتك. نفّذ ملف supabase-upgrade-achievements.sql أولًا.";return;}
   rememberPlayerName(name);
   const correct=Number(data?.correct_count||0),points=Number(data?.score||0);
   $("quiz-result-title").textContent=correct===5?"ممتاز! إجابات كاملة 🎉":"أحسنت، استمر في التعلم!";
   $("quiz-result-text").textContent=`إجابات صحيحة: ${ar(correct)} من ٥ · نقاط هذه المحاولة: ${ar(points)} · أُضيفت النقاط إلى مجموعك في لوحة المتصدرين.`;
   $("quiz-result").classList.remove("hidden");$("quiz-reset").classList.remove("hidden");button.classList.add("hidden");$("quiz-status").textContent="تم تسجيل الاختبار بنجاح.";
   const correctAnswers=Array.isArray(data?.correct_answers)?data.correct_answers:[1,2,0,3,1];
   const review=$("quiz-review");review.innerHTML="";
   QUIZ.forEach((question,index)=>{
     const isCorrect=answers[index]===Number(correctAnswers[index]);
     const item=document.createElement("article");item.className=`quiz-review-item ${isCorrect?"right":"wrong"}`;
     const title=document.createElement("b");title.textContent=`${ar(index+1)}. ${isCorrect?"إجابة صحيحة":"الإجابة الصحيحة: "+question.a[Number(correctAnswers[index])]}`;
     const explanation=document.createElement("p");explanation.textContent=question.why;
     item.append(title,explanation);review.append(item);
   });
   review.classList.remove("hidden");
   await Promise.all([loadLeaders(),loadPlayerDashboard()]);
 });
 $("quiz-reset")?.addEventListener("click",()=>{
   document.querySelectorAll('#quiz-questions input[type="radio"]').forEach(input=>input.checked=false);
   $("quiz-result").classList.add("hidden");$("quiz-review").classList.add("hidden");$("quiz-review").innerHTML="";$("quiz-reset").classList.add("hidden");$("quiz-submit").classList.remove("hidden");$("quiz-status").textContent="اختبار جديد جاهز. نقاط المحاولات السابقة محفوظة.";
 });

 async function loadLeaders(){
   const root=$("leaderboard");
   if(!supabaseClient){root.innerHTML='<p class="leader-empty">اربط Supabase لعرض لوحة المتصدرين وحفظ مجموع النقاط.</p>';return;}
   const {data,error}=await supabaseClient.from("event_leaderboard").select("display_name,total_score,game_points,quiz_points").order("total_score",{ascending:false}).limit(10);
   if(error){console.error(error);root.innerHTML='<p class="leader-empty">تعذر تحميل النتائج حاليًا.</p>';return;}
   if(!data?.length){root.innerHTML='<p class="leader-empty">كن أول من يسجل اسمه في لوحة المتصدرين!</p>';return;}
   root.innerHTML="";
   data.forEach((item,index)=>{
     const row=document.createElement("div");row.className="leader-row";
     const rank=document.createElement("span");rank.className="leader-rank";rank.textContent=scoreText(index+1);
     const nameWrap=document.createElement("div");nameWrap.className="leader-name-wrap";
     const name=document.createElement("span");name.className="leader-name";name.textContent=item.display_name;
     const breakdown=document.createElement("small");breakdown.className="leader-breakdown";breakdown.textContent=`اللعبة ${scoreText(item.game_points)} · الاختبار ${scoreText(item.quiz_points)}`;
     nameWrap.append(name,breakdown);
     const points=document.createElement("span");points.className="leader-points";points.textContent=scoreText(item.total_score)+" نقطة";
     row.append(rank,nameWrap,points);root.append(row);
   });
 }
 $("submit-score").addEventListener("click",async()=>{
   if(!supabaseClient){$("score-status").textContent="لوحة المتصدرين تحتاج ربط Supabase أولًا.";return;}
   if(score<1){$("score-status").textContent="حاول تجمع نقطة واحدة على الأقل قبل التسجيل.";return;}
   const name=($("player-name").value||getPlayerName()).trim();
   if(name.length<2||name.length>18){$("score-status").textContent="اكتب اسمًا من حرفين إلى ١٨ حرفًا، أو احفظه في قسم إنجازاتي.";$("profile-name")?.focus();return;}
   if(!ended){$("score-status").textContent="يمكن تسجيل النتيجة بعد انتهاء الجولة فقط.";return;}
   if(scoreSubmitted){$("score-status").textContent="تم تسجيل نتيجة هذه الجولة مسبقًا. ابدأ جولة جديدة لتسجيل نتيجة أخرى.";return;}
   if(!currentRunId){$("score-status").textContent="تعذر التحقق من الجولة. ابدأ جولة جديدة.";return;}
   if(submitPending)return;
   submitPending=true;$("submit-score").disabled=true;$("score-status").textContent="جارٍ تسجيل النتيجة...";
   const {data,error}=await supabaseClient.rpc("submit_game_score_once",{
     p_run_id:currentRunId,p_name:name,p_score:score
   });
   submitPending=false;
   if(error){
     console.error(error);$("submit-score").disabled=false;
     $("score-status").textContent="تعذر تسجيل النتيجة. شغّل ملف supabase-upgrade-score-once.sql في Supabase ثم حاول مجددًا.";
     return;
   }
   if(data?.already_submitted){
     scoreSubmitted=true;
     $("score-status").textContent="هذه الجولة مسجلة مسبقًا ولا يمكن إضافة نقاطها مرة أخرى.";
   }else{
     scoreSubmitted=true;
     rememberPlayerName(name);
     $("score-status").textContent="تم تسجيل نتيجة هذه الجولة بنجاح! لا يمكن تكرار إضافتها.";
   }
   $("submit-score").disabled=true;
   await Promise.all([loadLeaders(),loadPlayerDashboard()]);
 });
 loadLeaders();
 loadPlayerDashboard();
})();
