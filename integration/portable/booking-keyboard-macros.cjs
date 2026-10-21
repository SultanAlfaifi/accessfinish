'use strict';
// Fixed keyboard conveniences. No selectors, DOM mutation, HTTP booking, or source changes.
const names=Object.freeze(['browser_prepare_booking','browser_fill_customer','browser_complete_booking']);
const definitions=names.map(name=>({type:'function',function:{name,description:name==='browser_prepare_booking'?
 'Start a fresh booking page, choose the task service/provider using native keyboard only, and press Next to reach the date step. Returns the final UI diagnostic; does not select a date, save a booking, or repair source.':
 name==='browser_fill_customer'?'When focus is first-name on the customer step, type the four task customer values and move between them with Tab. Returns final diagnostic; does not confirm or save the booking.':
 'After your source repair and successful rebuild, execute the complete fixed synthetic booking through native keyboard only. Requires a usable date input and correct UI date/time; returns unresolved UI diagnostics before submission if repair is incomplete. Confirmation remains independently evaluated.',parameters:{type:'object',properties:{},required:[],additionalProperties:false}}}));
const fail=code=>{throw Object.assign(Error(code),{code});};
async function run(name,{invoke,scenario,state,onSubmit=async()=>{}}){
 if(!names.includes(name)||typeof invoke!=='function')fail('invalid_keyboard_macro');
 let actions=0;const step=async(n,args={})=>{if(++actions>(name==='browser_complete_booking'?380:108))fail('keyboard_macro_action_limit');state=await invoke(n,args);return state;};
 const focus=async id=>{for(let i=0;i<=16;i++){if(state?.focus?.id===id)return;if(i===16)break;await step('browser_press',{key:'Tab'});}fail('keyboard_macro_focus_not_reached');};
 const value=id=>state?.inputs?.find(x=>x.id===id)?.value;
 const select=async(id,target)=>{if(String(value(id))===String(target))return;await step('browser_press',{key:'Home'});for(let i=0;i<=16;i++){if(String(value(id))===String(target))return;if(i===16)break;await step('browser_press',{key:'ArrowDown'});}fail('keyboard_macro_value_not_selected');};
 if(name==='browser_prepare_booking'){
  await step('browser_start');await focus('select-service');
  await select('select-service',scenario.service_id);
  if(String(value('select-service'))!==String(scenario.service_id))fail('keyboard_macro_service_not_selected');
  await focus('select-provider');
  await select('select-provider',scenario.provider_id);
  if(String(value('select-provider'))!==String(scenario.provider_id))fail('keyboard_macro_provider_not_selected');
  await focus('button-next-1');await step('browser_press',{key:'Enter'});
  for(let i=0;i<20&&state?.inputs?.some(x=>x.id==='select-service');i++){await new Promise(resolve=>setTimeout(resolve,50));await step('browser_inspect');}
  if(state?.inputs?.some(x=>x.id==='select-service'))fail('keyboard_macro_step_not_advanced');
 }else if(name==='browser_fill_customer'){
  const fields=[['first-name','first_name'],['last-name','last_name'],['email','email'],['phone-number','phone_number']];
  for(const [id,key]of fields){if(state?.focus?.id!==id)fail('keyboard_macro_customer_focus_mismatch');await step('browser_type',{text:scenario.customer[key]});await step('browser_press',{key:'Tab'});}
 }else{
  let submitted=false;const uiFail=code=>{throw Object.assign(Error(code),{uiFailure:true,code});};
  const pause=()=>new Promise(resolve=>setTimeout(resolve,150));
  const key=async k=>{await step('browser_press',{key:k});await pause();return step('browser_inspect');};
  const find=async id=>{for(let i=0;i<60;i++){if(state?.focus?.id===id)return;await key('Tab');}uiFail('booking_focus_not_reached');};
  const wait=async test=>{for(let i=0;i<30;i++){await step('browser_inspect');if(test())return;await pause();}uiFail('booking_expected_ui_not_observed');};
  try{
   state=await run('browser_prepare_booking',{invoke:step,scenario});
   await wait(()=>state.inputs.some(x=>['select-date','af-keyboard-date','native-date','native_date'].includes(x.id)));
   const dateInput=state.inputs.find(x=>['select-date','af-keyboard-date','native-date','native_date'].includes(x.id));await find(dateInput.id);await key('Control+A');
   const [year,month,day]=scenario.date.split('-'),typed=dateInput.type==='date'?scenario.date:day+'/'+month+'/'+year;
   await step('browser_type',{text:typed});await key('Enter');await key('Tab');
   const utcHour=Number(scenario.start.slice(0,2))-3,minute=scenario.start.slice(3,5),slot=new RegExp('^0?'+utcHour+':'+minute+'\\s*(?:am)?$','i');
   await wait(()=>value(dateInput.id)===typed&&new RegExp('0?'+utcHour+':'+minute+'\\s*(?:am)?','i').test(state.body));
   if(value('select-timezone')!=='UTC')uiFail('booking_timezone_mismatch');
   let selected=false;for(let i=0;i<70;i++){if(slot.test((state.focus?.text||'').trim())){await key('Enter');selected=true;break;}await key('Tab');}if(!selected)uiFail('booking_slot_not_keyboard_reachable');
   await find('button-next-2');await key('Enter');await wait(()=>state.inputs.some(x=>x.id==='first-name'));
   for(const [id,k]of [['first-name','first_name'],['last-name','last_name'],['email','email'],['phone-number','phone_number']]){await find(id);await key('Control+A');await step('browser_type',{text:scenario.customer[k]});if(value(id)!==scenario.customer[k])uiFail('booking_customer_echo_mismatch');}
   await find('button-next-3');await key('Enter');await wait(()=>state.body.includes(scenario.customer.email));
   const consent=new Set(['accept-to-terms-and-conditions','accept-to-privacy-policy']),done=new Set();
   for(let i=0;i<60&&state.focus?.id!=='book-appointment-submit';i++){await key('Tab');if(consent.has(state.focus?.id)&&!done.has(state.focus.id)){done.add(state.focus.id);await key('Space');}}
   if(state.focus?.id!=='book-appointment-submit')uiFail('booking_submit_not_keyboard_reachable');
   await onSubmit();submitted=true;await key('Enter');await wait(()=>/\/booking_confirmation\//.test(state.url));
   return {...state,workflow:{status:'confirmation_observed',submitted:true,native_keyboard_only:true}};
  }catch(e){if(!submitted&&e.uiFailure)return {...state,workflow:{status:'unresolved',reason:e.code,submitted:false,native_keyboard_only:true}};throw e;}
 }
 return state;
}
function compact(messages,history){
 const assistant=[];for(let i=2;i<messages.length;i++)if(messages[i].role==='assistant')assistant.push(i);
 if(assistant.length<=2)return;
 const cut=assistant.at(-2),calls=new Map();
 for(const m of messages.slice(2,cut)){
  if(m.role==='assistant')for(const c of m.tool_calls||[])calls.set(c.id,c);
  if(m.role==='tool'){
   const c=calls.get(m.tool_call_id);if(!c)fail('history_compaction_orphan_tool');
   let result,args;try{result=JSON.parse(m.content);args=JSON.parse(c.function.arguments);}catch{fail('history_compaction_invalid_json');}
   history.push({id:c.id,name:c.function.name,args,result:{url:result?.url,focus:result?.focus,changed:result?.changed,status:result?.status,sha256:result?.sha256,recoverable:result?.recoverable,error:result?.error}});
  }
 }
 messages.splice(2,cut-2);
}
module.exports={names,definitions,run,compact};
