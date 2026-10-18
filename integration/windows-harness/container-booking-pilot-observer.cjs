'use strict';
// Trusted operator-only, container-only observer. No model, provider or application imports.
const fs = require('node:fs'), crypto = require('node:crypto');
const ORIGIN = 'http://127.0.0.1:8080';
const WORKER_PATH = '/trusted/container-booking-pilot-observer.cjs';
const SCHEMA = 1, MAX_OUTPUT_BYTES = 65536, MAX_TABS_PER_STEP = 80, DEADLINE_MS = 45000;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const targetUrl = hash => ORIGIN + (hash===null?'/booking':'/booking/reschedule/'+hash);
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function validateHash(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9]{1,128}$/.test(value)) fail('observer_booking_hash_denied');
  return value;
}
function isoDate(year, month, day) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const text = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const date = new Date(text + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === text ? text : null;
}
function parseDate(value) {
  if (typeof value !== 'string' || value.length > 100) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) return isoDate(Number(m[1]),Number(m[2]),Number(m[3]));
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (m) return isoDate(Number(m[3]),Number(m[2]),Number(m[1]));
  m = /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(value.trim());
  if (m) return isoDate(Number(m[3]),MONTHS.findIndex(x => x.toLowerCase() === m[1].toLowerCase()) + 1,Number(m[2]));
  return null;
}
function observationDate(raw) {
  const values = [], evidence = [];
  for (const input of raw.date_inputs) if (input.visible) {
    const value = parseDate(input.value);
    if (value) { values.push(value); evidence.push('date_input'); }
  }
  for (const calendar of raw.flatpickr) if (calendar.visible) {
    if (calendar.selected_days.length !== 1) return {selected_date_iso:null,evidence_kind:null,ambiguous:true};
    const day = calendar.selected_days[0], value = parseDate(day.aria_label);
    const monthIndex = MONTHS.findIndex(x => x.toLowerCase() === calendar.month.toLowerCase());
    if (!value || monthIndex < 0 || !/^\d{4}$/.test(calendar.year) ||
      value.slice(0,7) !== `${calendar.year}-${String(monthIndex+1).padStart(2,'0')}` ||
      Number(day.text) !== Number(value.slice(8))) return {selected_date_iso:null,evidence_kind:null,ambiguous:true};
    values.push(value); evidence.push('flatpickr_selected_day');
  }
  const unique = [...new Set(values)];
  return {selected_date_iso:unique.length===1?unique[0]:null,
    evidence_kind:unique.length===1?[...new Set(evidence)].join('+'):null,ambiguous:unique.length>1};
}
// Fixed read-only function. No selector, script, framework object or expression is accepted from callers.
function readObservation() {
  const visible = x => !!x && x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden' && getComputedStyle(x).display !== 'none';
  const dateIds = ['select-date','af-keyboard-date','native_date','native-date'];
  const customerIds = ['first-name','last-name','email','phone-number'];
  const date_inputs = dateIds.map(id => document.getElementById(id)).filter(x => x && x.tagName === 'INPUT' && ['text','date'].includes(x.type)).map(x => ({id:x.id,type:x.type,value:String(x.value||'').slice(0,100),visible:visible(x)}));
  const flatpickr = [...document.querySelectorAll('.flatpickr-calendar.inline')].slice(0,3).map(calendar => {
    const month = calendar.querySelector('.flatpickr-current-month .cur-month');
    const monthSelect = calendar.querySelector('.flatpickr-current-month .flatpickr-monthDropdown-months');
    const year = calendar.querySelector('.flatpickr-current-month .cur-year');
    return {visible:visible(calendar),month:String(month?.textContent||monthSelect?.selectedOptions?.[0]?.textContent||'').trim().slice(0,40),
      year:String(year?.value||'').slice(0,4),selected_days:[...calendar.querySelectorAll('.flatpickr-day.selected')].slice(0,3).map(day => ({aria_label:String(day.getAttribute('aria-label')||'').slice(0,100),text:String(day.textContent||'').trim().slice(0,4)}))};
  });
  const customer = Object.fromEntries(customerIds.map(id => {
    const x = document.getElementById(id);
    return [id,x && x.tagName==='INPUT' && ['text','email','tel'].includes(x.type) && visible(x) ? String(x.value||'').slice(0,1000) : null];
  }));
  const active = document.activeElement;
  const selection = Object.fromEntries(['select-service','select-provider'].map(id=>{const x=document.getElementById(id);return [id,x?.tagName==='SELECT'&&visible(x)?String(x.value||'').slice(0,100):null];}));
  return {url:location.href.slice(0,2048),focus:{tag:active?.tagName||null,id:String(active?.id||'').slice(0,100),type:active?.type||null},date_inputs,flatpickr,customer,
    selection,next1_visible:visible(document.getElementById('button-next-1')),next2_visible:visible(document.getElementById('button-next-2'))};
}
function validateObservation(raw, hash) {
  if (!raw || typeof raw !== 'object' || raw.url !== targetUrl(hash) ||
    !raw.focus || typeof raw.focus.id !== 'string' || raw.focus.id.length>100 || !Array.isArray(raw.date_inputs) || raw.date_inputs.length>4 ||
    !Array.isArray(raw.flatpickr) || raw.flatpickr.length>2 || !raw.customer || !raw.selection ||
    typeof raw.next1_visible!=='boolean' || typeof raw.next2_visible!=='boolean') fail('observer_diagnostic_invalid');
  for (const x of raw.date_inputs) if (!['select-date','af-keyboard-date','native_date','native-date'].includes(x.id) ||
    !['text','date'].includes(x.type) || typeof x.value!=='string' || x.value.length>100 || typeof x.visible!=='boolean') fail('observer_diagnostic_invalid');
  if (new Set(raw.date_inputs.map(x=>x.id)).size!==raw.date_inputs.length) fail('observer_diagnostic_invalid');
  for (const x of raw.flatpickr) {
    if (typeof x.visible!=='boolean' || typeof x.month!=='string' || x.month.length>40 || typeof x.year!=='string' || x.year.length>4 || !Array.isArray(x.selected_days) || x.selected_days.length>2) fail('observer_diagnostic_invalid');
    for (const d of x.selected_days) if (typeof d.aria_label!=='string' || d.aria_label.length>100 || typeof d.text!=='string' || d.text.length>4) fail('observer_diagnostic_invalid');
  }
  const customerKeys=['first-name','last-name','email','phone-number'];
  if (Object.keys(raw.customer).length!==4 || customerKeys.some(k=>!Object.hasOwn(raw.customer,k) || !(raw.customer[k]===null || typeof raw.customer[k]==='string'&&raw.customer[k].length<=1000))) fail('observer_diagnostic_invalid');
  if(Object.keys(raw.selection).length!==2||['select-service','select-provider'].some(k=>!Object.hasOwn(raw.selection,k)||!(raw.selection[k]===null||typeof raw.selection[k]==='string'&&raw.selection[k].length<=100)))fail('observer_diagnostic_invalid');
  return {...raw,date:observationDate(raw)};
}
function permittedRequest(url, method, hash) {
  let u; try { u=new URL(url); } catch { return false; }
  if (u.origin!==ORIGIN || u.username || u.password || u.hash) return false;
  if (['GET','HEAD'].includes(method)) {
    if (!u.search && u.href===targetUrl(hash)) return true;
    return /^\/assets\/[A-Za-z0-9_@./-]+$/.test(u.pathname) && !u.pathname.split('/').some(p=>p==='.'||p==='..');
  }
  return method==='POST' && !u.search && /^\/(?:index\.php\/)?booking\/(?:get_available_hours|get_unavailable_dates)$/.test(u.pathname);
}
async function observe({chromium, bookingHash, readiness=false, now=Date.now, workerSha256, signal}) {
  if(typeof readiness!=='boolean'||readiness&&bookingHash!==undefined)fail('observer_arguments_denied');
  const hash=readiness?null:validateHash(bookingHash),started=now();let browser,context,closed=false,violated=false,blocked=0,timer;
  let stage='launch',lastDiagnostic=null;
  const actions=[];
  const remaining=()=>DEADLINE_MS-(now()-started);
  const stop=async()=>{closed=true;const c=context,b=browser;context=null;browser=null;try{await c?.close();}finally{await b?.close();}};
  const onAbort=()=>{stop().catch(()=>{});};
  const assertActive=page=>{if(closed||remaining()<=0)fail('observer_time_budget');if(violated||page.url()!==targetUrl(hash))fail('observer_navigation_denied');};
  try {
    if(signal?.aborted)fail('observer_time_budget');signal?.addEventListener('abort',onAbort,{once:true});
    timer=setTimeout(onAbort,Math.max(1,remaining()));
    browser=await chromium.launch({headless:true,chromiumSandbox:true,args:['--disable-dev-shm-usage']});
    if(closed){await stop();fail('observer_time_budget');}
    context=await browser.newContext({timezoneId:'UTC',viewport:{width:1280,height:900},serviceWorkers:'block'});
    if(closed){await stop();fail('observer_time_budget');}
    await context.route('**/*',route=>permittedRequest(route.request().url(),route.request().method(),hash)?route.continue():(blocked++,route.abort()));
    const owned=context,page=await owned.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);
    owned.on('page',extra=>{if(extra!==page)extra.close().catch(()=>{});});
    page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&frame.url()!==targetUrl(hash)){violated=true;owned.close().catch(()=>{});}});
    await page.goto(targetUrl(hash),{waitUntil:'domcontentloaded',timeout:10000});
    const inspect=async()=>{assertActive(page);const state=validateObservation(await page.evaluate(readObservation),hash);assertActive(page);lastDiagnostic=state;return state;};
    const pause=async()=>{assertActive(page);await new Promise(resolve=>setTimeout(resolve,200));assertActive(page);};
    const press=async(key,focusedId)=>{assertActive(page);await page.keyboard.press(key);actions.push({key,focused_id_before:focusedId});await pause();return inspect();};
    const focus=async(id,tag,type)=>{
      let state=await inspect();
      for(let i=0;i<MAX_TABS_PER_STEP;i++){
        if(state.focus.id===id && state.focus.tag===tag && state.focus.type===type)break;
        state=await press('Tab',state.focus.id);
      }
      if(state.focus.id!==id || state.focus.tag!==tag || state.focus.type!==type)fail('observer_fixed_control_unreachable');
      return state;
    };
    const advance=async id=>{
      let state=await focus(id,'BUTTON','button');
      state=await press('Enter',id);
      for(let i=0;i<40;i++){
        state=await inspect();
        if(id==='button-next-1'?state.next2_visible:Object.values(state.customer).every(x=>x!==null))return state;
        assertActive(page);await new Promise(resolve=>setTimeout(resolve,100));
      }
      fail('observer_step_not_visible');
    };
    stage='initial_visible_ui';let initial=await inspect();
    for(let i=0;i<40&&(initial.selection['select-service']===null||!readiness&&initial.selection['select-provider']===null);i++){
      assertActive(page);await new Promise(resolve=>setTimeout(resolve,100));initial=await inspect();
    }
    if(initial.selection['select-service']===null||!readiness&&initial.selection['select-provider']===null)fail('observer_initial_ui_not_visible');
    await pause();initial=await inspect();
    let after_selection=null;
    if(readiness){
      for(const [id,value]of[['select-service','1'],['select-provider','2']]){
        stage=id==='select-service'?'readiness_service':'readiness_provider';
        let state=await focus(id,'SELECT','select-one');
        for(const key of['End','Enter'])state=await press(key,state.focus.id);
        for(let i=0;i<40&&(state.selection[id]!==value||id==='select-service'&&state.selection['select-provider']===null);i++){assertActive(page);await new Promise(resolve=>setTimeout(resolve,100));state=await inspect();}
        if(state.selection[id]!==value)fail('observer_fixed_selection_unavailable');
      }
      after_selection=await inspect();
    }
    stage='next1';const after_next1=await advance('button-next-1');
    stage='next2';const after_next2=readiness?null:await advance('button-next-2');
    return {schema_version:SCHEMA,state:readiness?'READINESS_OBSERVATIONS_COLLECTED':'OBSERVATIONS_COLLECTED',observer_path:WORKER_PATH,observer_sha256:workerSha256,
      booking_hash:hash,fresh_context:true,timezone:'UTC',chromium_sandbox:true,service_workers:'block',
      initial,after_selection,after_next1,after_next2,keyboard_actions:actions,blocked_requests:blocked,duration_ms:now()-started};
  } catch(e){e.observer_stage=stage;e.observer_diagnostic=lastDiagnostic;throw e;}
  finally {clearTimeout(timer);signal?.removeEventListener('abort',onAbort);await stop();}
}
async function main() {
  const readiness=process.argv.length===3&&process.argv[2]==='--readiness';
  if(process.getuid?.()!==1000 || !readiness&&(process.argv.length!==4 || process.argv[2]!=='--booking-hash'))fail('observer_arguments_denied');
  const hash=readiness?undefined:validateHash(process.argv[3]),workerSha256=crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  const {chromium}=require('/trusted/node_modules/playwright');
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGTERM',stop);process.once('SIGINT',stop);
  let result;try{result=await observe({chromium,bookingHash:hash,readiness,workerSha256,signal:controller.signal});}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}const json=JSON.stringify(result);
  if(Buffer.byteLength(json)>MAX_OUTPUT_BYTES)fail('observer_output_too_large');process.stdout.write(json+'\n');
}
module.exports={WORKER_PATH,SCHEMA,MAX_OUTPUT_BYTES,MAX_TABS_PER_STEP,DEADLINE_MS,validateHash,parseDate,observationDate,readObservation,validateObservation,permittedRequest,observe};
if(require.main===module)main().catch(e=>{process.stderr.write(JSON.stringify({state:'OBSERVER_ERROR',code:e.code||'observer_failed',stage:e.observer_stage||null,diagnostic:e.observer_diagnostic||null})+'\n');process.exitCode=1;});
