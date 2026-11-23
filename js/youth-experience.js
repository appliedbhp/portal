// Age-adaptive client experience. Preferences are cached for instant painting
// and synchronized with the client profile when the backend is available.
const YOUTH_DEFAULTS = { mode:"teen", accent:"#6366f1", goalLabel:"Goals", reducedMotion:false, celebrations:true };
let youthPreferences = Object.assign({}, YOUTH_DEFAULTS);

function youthCacheKey(){ return "youthExperience:" + (typeof getClientId === "function" ? getClientId() : "portal"); }
function getYouthPreferences(){ return Object.assign({}, youthPreferences); }
function youthGoalLabel(singular=false){ const value=youthPreferences.goalLabel||"Goals"; return singular ? value.replace(/s$/i,"") : value; }

function applyYouthPreferences(prefs){
  youthPreferences = Object.assign({}, YOUTH_DEFAULTS, prefs || {});
  const root=document.documentElement;
  root.dataset.youthMode=youthPreferences.mode;
  root.style.setProperty("--youth-accent", youthPreferences.accent);
  root.classList.toggle("youth-reduced-motion", !!youthPreferences.reducedMotion);
  try { localStorage.setItem(youthCacheKey(), JSON.stringify(youthPreferences)); } catch(_) {}
  document.querySelectorAll("[data-youth-goals-label]").forEach(el=>el.textContent=youthGoalLabel(false));
}

function restoreYouthPreferences(){
  if(typeof getRole==="function" && getRole()==="provider") return;
  try { applyYouthPreferences(JSON.parse(localStorage.getItem(youthCacheKey())||"{}")); } catch(_){ applyYouthPreferences({}); }
  if(typeof apiCall==="function") apiCall("getYouthPreferences",{}).then(r=>applyYouthPreferences(r.preferences)).catch(()=>{});
}

function youthGreeting(){
  const hour=new Date().getHours();
  return hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
}

function youthCheckIn(value, button){
  const today=new Date().toISOString().slice(0,10);
  try { localStorage.setItem("youthCheckIn:"+getClientId()+":"+today,value); } catch(_) {}
  document.querySelectorAll(".youth-feeling-btn").forEach(b=>b.classList.toggle("selected",b===button));
  const response=document.getElementById("youth-checkin-response");
  const copy={ low:"Thanks for checking in. A small step still counts today.", steady:"Noticing where you are is a strong start.", good:"Nice—choose one thing you want to carry forward.", energized:"Use that energy on one meaningful next step." };
  if(response) response.textContent=copy[value]||"Thanks for checking in.";
}

let youthFocusEndsAt=0, youthFocusTimer=null;
function youthStartFocus(minutes){
  youthFocusEndsAt=Date.now()+minutes*60000;
  clearInterval(youthFocusTimer);
  youthFocusTimer=setInterval(youthTickFocus,1000);
  youthTickFocus();
}
function youthTickFocus(){
  const el=document.getElementById("youth-focus-time"); if(!el){clearInterval(youthFocusTimer);return;}
  const left=Math.max(0,youthFocusEndsAt-Date.now()),m=Math.floor(left/60000),s=Math.floor(left%60000/1000);
  el.textContent=`${m}:${String(s).padStart(2,"0")}`;
  if(!left){clearInterval(youthFocusTimer);el.textContent="Done ✓";if(youthPreferences.celebrations)document.body.classList.add("youth-celebrate");setTimeout(()=>document.body.classList.remove("youth-celebrate"),1000);}
}

restoreYouthPreferences();
