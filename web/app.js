'use strict';
const $ = selector => document.querySelector(selector), all = selector => [...document.querySelectorAll(selector)];
let evidence, context, proposal, proposalRecord = null, localMode = false, fixtureReady = false, modelReady = false, currentRun = null, polling = false, analysisBusy = false;
let featured = null, recordedRun = null, selectedRecordedCase = false, recordingSelected = false;
let selectedCaseId = 'keyboard-date', baseCase = null;
let initializing = true, environmentSummary = '';
function tab(name) {
  for (const element of all('.tab-panel')) element.hidden = element.id !== name;
  for (const element of all('.stage')) { const active = element.dataset.tab === name; element.classList.toggle('active', active); element.setAttribute('aria-pressed', String(active)); }
  $('#panel-label').textContent = {blockage: '1 / OBSERVED BLOCKAGE', repair: '2 / SOURCE REVIEW', outcome: '3 / EXECUTION EVIDENCE'}[name];
  const panel = $('#' + name), heading = panel.querySelector('h2');
  heading.tabIndex = -1; heading.focus({preventScroll: true}); panel.scrollIntoView({block: 'start'});
}
async function api(url, data) {
  const response = await fetch(url, data === undefined ? {cache: 'no-store'} : {cache: 'no-store', method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
  let value; try { value = await response.json(); } catch { throw Error('This action requires the local Node app. The recorded example remains available.'); }
  if (!response.ok) throw Error(value.error || 'The operation did not complete.'); return value;
}
function busy() { return analysisBusy || currentRun && !['verified', 'failed', 'interrupted'].includes(currentRun.state); }
function controls() {
  const locked = !!busy();
  $('#run-repair').disabled = locked || !fixtureReady || !proposalRecord || !$('#approve').checked;
  $('#export-patch').disabled = locked || !proposal || !$('#approve').checked;
  $('#load-recorded').disabled = locked || !evidence;
  $('#analyze-button').disabled = locked || !modelReady;
  $('#source-files').disabled = locked || !localMode; $('#approve').disabled = locked || !localMode;
  $('#repair-case').disabled = locked || initializing;
  $('#inspect-recorded-run').hidden = !recordedRun || !selectedRecordedCase;
  $('#inspect-recorded-run').disabled = locked;
}
function clearOutcome() {
  currentRun = null; recordingSelected = false; $('#proof-heading').textContent = 'What this run proves';
  $('#outcome-detail').hidden = true; $('#outcome-checks').replaceChildren(); $('#execution-stages').replaceChildren();
  $('#result-flag').className = 'issue-flag blue'; $('#result-flag').textContent = 'NOT EXECUTED';
  $('#verify-message').textContent = 'This proposal has not been executed. The separate recorded receipt does not verify these changes.';
  $('#run-identity').textContent = ''; $('#recording-label').textContent = 'No execution selected';
  $('#build-state').textContent = $('#interaction-state').textContent = $('#verifier-state').textContent = 'Not executed';
  $('#download-run').disabled = true; $('#refresh-run').hidden = true; $('#task-date').textContent = 'Future date, chosen at execution';
}
function renderEdit(index) {
  const edit = proposal.edits[index]; $('#old-code').textContent = edit.old; $('#new-code').textContent = edit.new;
  all('#file-switch button').forEach((button, i) => { button.classList.toggle('active', i === index); button.setAttribute('aria-pressed', String(i === index)); });
}
function selectProposal(value, record, isRecordedCase = false) {
  clearOutcome(); selectedRecordedCase = isRecordedCase; proposal = value; proposalRecord = record; $('#approve').checked = false; $('#file-switch').replaceChildren();
  value.edits.forEach((edit, index) => {
    const purpose = edit.old.includes('phone_number:') ? 'Customer phone' : edit.path.endsWith('.php') ? 'Date input' : edit.old.includes('onChange:') ? 'Empty date' : edit.old.includes('onMonthChange:') ? 'Month refresh' : edit.old.includes('onYearChange:') ? 'Year refresh' : 'Retain date';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = (index + 1) + ' · ' + purpose; button.title = edit.path;
    button.addEventListener('click', () => renderEdit(index)); $('#file-switch').append(button);
  }); renderEdit(Math.max(0, value.edits.findIndex(edit => edit.path.endsWith('.php'))));
  const fresh = record?.origin === 'nebius';
  const requestRecord = fresh ? record : featured;
  $('#model-request-record').hidden = !requestRecord?.usage || !requestRecord?.attempt_id;
  $('#model-request-evidence').textContent = requestRecord?.usage ?
    (fresh ? 'This request' : 'Recorded request · no new inference') + '\nProvider: Nebius Token Factory\nModel: ' + requestRecord.model +
    '\nAttempt: ' + requestRecord.attempt_id + '\nInput tokens: ' + requestRecord.usage.prompt_tokens + '\nCompletion tokens: ' + requestRecord.usage.completion_tokens +
    '\nEstimated request cost before tax: $' + Number(requestRecord.estimated_cost_usd_excluding_tax).toFixed(6) : '';
  $('#proposal-identity').textContent = 'Proposal SHA-256: ' + (record?.proposal_sha256 || featured?.proposal_sha256 || 'Available after local registration');
  const amended = isRecordedCase && featured?.authorship === 'operator_amended_model';
  const operatorReference = record?.origin === 'operator_reference' || isRecordedCase && featured?.authorship === 'operator_reference';
  const date = featured?.generated_at_utc ? new Date(featured.generated_at_utc).toLocaleDateString('en-US', {timeZone: 'Asia/Riyadh', month: 'long', day: 'numeric', year: 'numeric'}) : 'October 18, 2026';
  $('#source-author').textContent = operatorReference ? 'Operator reference control' : fresh ? 'New Nemotron proposal' : amended ? 'Operator-amended Nemotron proposal' : 'Recorded Nemotron proposal';
  $('#repair-attribution').textContent = operatorReference ? 'An operator-authored reference repair for a deliberately seeded phone fault. This tests the workflow and evaluator; it is not a new Nemotron success. Selecting it starts no execution.' : fresh ? 'New Nemotron-authored proposal, with supplied diagnosis and repair direction. Not applied or tested.' :
    amended ? 'A diagnostic reference: three archived Nemotron edits plus two operator-authored calendar guards. This is not a fresh model-authored repair. Selecting it starts no execution.' :
    'Nemotron authored ' + value.edits.length + (value.edits.length === 1 ? ' edit' : ' edits') + ' on ' + date + ' with supplied diagnosis and repair direction. Selecting the proposal starts no execution.';
  $('#cost').textContent = fresh ? '$' + Number(record.estimated_cost_usd_excluding_tax).toFixed(5) : '$0';
  $('#cost-note').textContent = fresh ? 'This proposal · estimated before tax' : 'Recorded proposal · no new inference';
  $('#execution-message').textContent = !localMode ? 'Browser-only review. Inspect the matching recorded execution. New execution requires the local build, review of the exact patch, and explicit approval.' : fixtureReady ? 'Review the exact changes, then run them against a fresh synthetic fixture. No model call is made by execution.' : 'Run npm run demo:setup in the local build to enable isolated execution. Patch export remains available.';
  controls();
}
async function recorded() {
  const record = localMode ? await api('api/proposals/recorded', {case_id: selectedCaseId}) : null;
  const selected = featured?.proposal || evidence.proposal;
  if (record && (record.proposal_sha256 !== await AccessFinishRecording.digest(selected) || record.source_sha256 !== await AccessFinishRecording.digest(context))) throw Error('The server proposal does not match the displayed source. Refresh before approving.');
  selectProposal(selected, record, true);
  $('#load-recorded').textContent = featured?.authorship === 'operator_reference' ? 'Use operator reference repair' : 'Use recorded Nemotron proposal';
  if (!localMode && recordedRun?.result?.scenario) $('#task-date').textContent = recordedRun.result.scenario.date + ' (recorded)';
}
function renderRun(run, recorded = false) {
  currentRun = run; recordingSelected = recorded;
  const terminal = ['verified', 'failed', 'interrupted'].includes(run.state), verified = run.booking_verified === true && run.state === 'verified';
  $('#result-flag').className = 'issue-flag ' + (verified ? 'success' : terminal ? 'failure' : 'blue');
  $('#result-flag').textContent = (recorded ? 'RECORDED · ' : '') + (verified ? 'VERIFIED FOR THIS RUN' : terminal ? 'VERIFICATION FAILED' : run.state.toUpperCase());
  $('#verify-message').textContent = (recorded ? 'Recorded execution from ' + new Date(run.finished_at_utc).toLocaleDateString('en-US') + '. Opening it starts no model request, build, or verification. ' : '') + (verified ? 'The expected booking was saved and independently reopened with matching data. This result belongs to the exact proposal below.' : run.error || 'Executing the approved repair in a fresh fixture. A successful build alone does not verify the booking.');
  $('#recording-label').textContent = (recorded ? 'Recorded execution ' : 'Execution ') + run.id.slice(4, 12) + ' · ' + run.state;
  $('#proof-heading').textContent = recorded ? 'What this recording proves' : 'What this run proves';
  $('#run-identity').textContent = 'Run: ' + run.id + '\nProposal SHA-256: ' + run.proposal_sha256;
  $('#execution-stages').replaceChildren();
  for (const stage of run.stages) { const item = document.createElement('li'); item.textContent = stage.state + ' · ' + new Date(stage.at_utc).toLocaleTimeString('en-GB'); $('#execution-stages').append(item); }
  const result = run.result;
  $('#build-state').textContent = result?.build?.status === 'TRUSTED_BUILD_PASS' ? 'Passed · ' + result.build.rows.length + ' files' : run.stages.some(s => s.state === 'booking') ? 'Passed' : terminal ? 'Not completed' : 'Pending';
  $('#interaction-state').textContent = result?.keyboard?.workflow?.status === 'confirmation_observed' ? 'Keyboard confirmation observed' : terminal ? 'Not verified' : 'Pending';
  $('#verifier-state').textContent = verified ? 'Storage + fresh reopen matched' : terminal ? 'Did not pass' : 'Pending';
  if (result?.scenario) $('#task-date').textContent = result.scenario.date;
  const booking = result?.booking; $('#outcome-detail').hidden = !booking;
  if (booking) {
    $('#booking-id').textContent = '#' + booking.id; $('#booking-date').textContent = booking.start_datetime.slice(0, 10);
    $('#booking-time').textContent = booking.start_datetime.slice(11, 16) + '–' + booking.end_datetime.slice(11, 16) + ' Asia/Riyadh';
    $('#booking-customer').textContent = result.scenario.customer.first_name + ' ' + result.scenario.customer.last_name;
    $('#booking-service').textContent = booking.id_services + ' / ' + booking.id_users_provider;
    const savedCustomer = result.after?.customers?.find(row => String(row.id) === String(booking.id_users_customer));
    $('#expected-phone').textContent = result.scenario.customer.phone_number;
    $('#stored-phone').textContent = savedCustomer?.phone_number ?? 'Not observed';
    $('#reopened-phone').textContent = result.observer?.after_next2?.customer?.['phone-number'] ?? 'Not observed';
    if (selectedCaseId === 'customer-phone' && savedCustomer?.phone_number !== result.scenario.customer.phone_number)
      $('#verify-message').textContent = 'The booking reached confirmation, but the stored phone differs from the entered phone. This repair did not pass verification.';
    $('#receipt-result').textContent = verified ? 'Saved and reopened with matching expected data' : 'Observed row · outcome checks did not pass';
    $('#outcome-checks').replaceChildren();
    for (const [name, passed] of Object.entries(result.evaluation?.nochangecontrols || {})) {
      if (!passed) continue; const item = document.createElement('li'); item.textContent = name.replaceAll('_', ' '); $('#outcome-checks').append(item);
    }
    for (const [name, passed] of Object.entries({pointer_booking_and_reopen: result.controls?.pass, reserved_slot_not_offered: result.controls?.browser?.reserved_slot_not_offered, cleared_date_without_browser_error: result.controls?.browser?.cleared_date_without_browser_error, container_boundaries_inspected: result.boundaries_verified})) {
      if (passed !== true) continue; const item = document.createElement('li'); item.textContent = name.replaceAll('_', ' '); $('#outcome-checks').append(item);
    }
  }
  $('#download-run').disabled = !terminal; controls();
}
async function poll() {
  if (!currentRun || polling) return; polling = true;
  try {
    const run = await api('api/runs/' + currentRun.id); renderRun(run); $('#refresh-run').hidden = true;
    if (!['verified', 'failed', 'interrupted'].includes(run.state)) setTimeout(poll, 1500);
  } catch (error) { $('#verify-message').textContent = error.message + ' Refresh this same run; do not start another execution.'; $('#refresh-run').hidden = false; }
  finally { polling = false; }
}
function download(data, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], {type: 'application/json'})), anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
all('.stage').forEach(button => button.addEventListener('click', () => tab(button.dataset.tab)));
all('.next-step').forEach(button => button.addEventListener('click', () => tab(button.dataset.target)));
$('#approve').addEventListener('change', controls);
$('#load-recorded').addEventListener('click', () => recorded().catch(error => { $('#execution-message').textContent = error.message; }));
$('#export-patch').addEventListener('click', () => { if ($('#approve').checked) download({proposal, proposal_sha256: proposalRecord?.proposal_sha256 || null, reviewed_by_operator: true, applied_to_host: false}, 'accessfinish-reviewed-patch.json'); });
$('#run-repair').addEventListener('click', async () => {
  if (!proposalRecord || !$('#approve').checked || busy()) return;
  $('#run-repair').disabled = true;
  try { const run = await api('api/runs', {proposal_id: proposalRecord.id, approved_proposal_sha256: proposalRecord.proposal_sha256, reviewed: true}); renderRun(run); tab('outcome'); poll(); }
  catch (error) { $('#execution-message').textContent = error.message; controls(); }
});
$('#refresh-run').addEventListener('click', poll);
$('#inspect-recorded-run').addEventListener('click', async () => {
  if (!selectedRecordedCase || !recordedRun || busy()) return;
  try { await AccessFinishRecording.validate({featured, files: context, run: recordedRun}); renderRun(recordedRun, true); tab('outcome'); }
  catch (error) { clearOutcome(); $('#verify-message').textContent = error.message; tab('outcome'); }
});
$('#download-run').addEventListener('click', () => { if (currentRun) download(currentRun, currentRun.id + '.json'); });
$('#analyze-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!$('#model-consent').checked || busy()) return;
  analysisBusy = true; controls(); $('#model-message').textContent = 'Waiting for one Nemotron proposal. No automatic retry.';
  try {
    const file = $('#source-files').files[0], files = file ? JSON.parse(await file.text()) : context;
    const result = await api('api/analyze', {files: Array.isArray(files) ? files : files.sources || files.files, case_id: selectedCaseId});
    selectProposal(result.proposal, result); $('#model-message').textContent = 'Proposal received. Review before execution.'; tab('repair');
  } catch (error) { $('#model-message').textContent = error.message; }
  finally { analysisBusy = false; controls(); }
});
function caseCopy() {
  const phone = selectedCaseId === 'customer-phone';
  $('#case-source-download').href = phone ? 'cases/customer-phone.json' : 'source-context.json';
  $('#case-description').textContent = phone ? 'Easy!Appointments · deliberately seeded data fault' : 'Easy!Appointments · guided upstream case';
  $('#case-flag').textContent = phone ? 'WRONG DATA SAVED' : 'KEYBOARD BLOCKED';
  $('#case-problem-title').textContent = phone ? 'Booking confirmed. Wrong phone saved.' : 'The calendar looks ready. The keyboard has nowhere to go.';
  $('#case-problem').textContent = phone ? 'The customer enters a phone number, but the booking payload replaces it with a placeholder. Confirmation alone cannot establish that the correct contact data was saved.' : 'The date selector is mounted on a non-focusable element. A keyboard user must be able to choose a future date and finish booking.';
  $('#case-source-name').textContent = phone ? 'booking.js · customer payload' : 'booking_time_step.php';
  $('#case-source-provenance').textContent = phone ? 'deliberately seeded fault' : 'original upstream source';
  $('#case-source-fragment').textContent = phone ? "phone_number: '0000000000'," : '<div id="select-date" class="mx-auto my-4"></div>';
  $('#case-visible-symptom').textContent = phone ? 'Entered: 0000000042 · fault writes: 0000000000' : 'Tab focus moves past the date control';
  $('#case-check-title').textContent = phone ? 'The saved phone must match the entered phone.' : 'The date must survive the whole task.';
  $('#case-check-detail').textContent = phone ? 'A second booking uses a different phone, so hardcoding the first example must fail. The independent reader and fresh browser check the result.' : 'Clearing the input must be safe. Reopening the saved appointment must retain its date.';
  $('#scope-note').textContent = phone ? 'A deliberately seeded, exposed development fault on the recorded working date repair. Reference controls are operator-authored unless explicitly marked as new model proposals.' : 'One guided, exposed upstream case. The diagnosis and repair direction were supplied. The original five-trial evaluation remains separate from the two-case workflow comparison.';
}
async function selectCase(id) {
  const bundle = id === 'keyboard-date' ? baseCase : await api('cases/customer-phone.json');
  if (!bundle || bundle.case_id !== id) throw Error('The selected case could not be loaded. Refresh before reviewing a repair.');
  selectedCaseId = id; context = bundle.files; featured = bundle.featured; recordedRun = bundle.run || null;
  if (recordedRun) await AccessFinishRecording.validate({featured, files: context, run: recordedRun});
  await recorded(); caseCopy(); tab('blockage');
}
$('#repair-case').addEventListener('change', async () => {
  if (initializing || busy()) return;
  analysisBusy = true; proposalRecord = null; $('#approve').checked = false; clearOutcome(); controls();
  $('#environment-note').textContent = 'Loading the selected case and its exact source…';
  try { await selectCase($('#repair-case').value); $('#environment-note').textContent = environmentSummary; }
  catch (error) { $('#repair-case').value = selectedCaseId; $('#environment-note').textContent = error.message; }
  finally { analysisBusy = false; controls(); }
});
async function comparison() {
  try {
    const report = await api('comparison.json');
    if (report.state !== 'completed' || !report.all_expected_outcomes_observed) return;
    $('#comparison-rows').replaceChildren();
    for (const pair of report.pairs) {
      const tr = document.createElement('tr');
      const outcomes = ['conventional', 'accessfinish'].map(workflow => report.records.find(r => r.case_id === pair.case_id && r.variant === pair.variant && r.workflow === workflow));
      const label = (pair.case_id === 'customer-phone' ? 'Saved phone' : 'Keyboard date') + ' / ' + pair.variant;
      for (const [index, text] of [label, ...outcomes.map(row => row.actual_verified ? 'Passed' : row.classification.replaceAll('_', ' '))].entries()) {
        const td = document.createElement('td');
        if (index > 0) { const link = document.createElement('a'); link.href = outcomes[index - 1].evidence; link.textContent = text; link.setAttribute('aria-label', label + ' / ' + outcomes[index - 1].workflow + ': ' + text + '. Inspect evidence.'); td.append(link); }
        else td.textContent = text;
        tr.append(td);
      }
      $('#comparison-rows').append(tr);
    }
    $('#comparison-results').hidden = false; $('#comparison-download').hidden = false;
    $('#comparison-status').textContent = report.pairs.length + ' paired variants completed. Both workflows produced the same correctness outcomes. AccessFinish additionally rejected missing and stale approvals before execution.';
    try {
      const model = await api('phone-model-report.json');
      if (model.state === 'verified_in_both_workflows') {
        $('#phone-model-status').hidden = false; $('#phone-model-download').hidden = false;
        $('#phone-model-status').textContent = 'Separately, ' + model.generations + ' new guided Nemotron proposal for the seeded phone case passed both workflows. These are ' + model.execution_replays + ' execution replays of that proposal, not additional model generations.';
      }
    } catch {}
  } catch { /* A pending experiment never renders completed results. */ }
}
async function init() {
  try { [evidence, context] = await Promise.all([api('evidence.json'), api('source-context.json')]); }
  catch { $('#environment-note').textContent = 'The case data could not be loaded. Refresh the page or check the local files.'; controls(); return; }
  try {
    featured = await api('featured-case.json'); recordedRun = await api(featured.recording);
    await AccessFinishRecording.validate({featured, files: context, run: recordedRun});
  } catch { featured = null; recordedRun = null; }
  baseCase = {case_id: 'keyboard-date', files: context, featured, run: recordedRun};
  caseCopy(); comparison();
  try {
    const report = await api('trial-report.json');
    $('#protocol-summary').textContent = report.evaluation_passed + ' of ' + report.evaluation_requests + ' attempts passed the full frozen procedure. Every failure is retained. Additional model cost: $' + Number(report.estimated_additional_model_cost_usd_excluding_tax).toFixed(6) + ' estimated before tax, across all eight approved requests.';
    for (const row of report.trials.filter(row => row.phase === 'evaluation')) {
      const tr = document.createElement('tr');
      const outcome = row.overall_pass ? 'Passed' : row.build_pass ? 'Failed · calendar control' : 'Failed · build';
      for (const value of [row.index, row.build_pass ? 'Passed' : 'Failed', row.keyboard_booking_pass ? 'Passed' : 'Not verified', outcome]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
      const td = document.createElement('td'), link = document.createElement('a'); link.href = 'records/evaluation-' + row.index + '.json'; link.download = ''; link.textContent = 'Evidence'; link.setAttribute('aria-label', 'Download evidence for evaluation trial ' + row.index); td.append(link); tr.append(td); $('#protocol-rows').append(tr);
    }
    $('#protocol-table-wrap').hidden = false; $('#download-trial-report').hidden = false;
  } catch {}
  try {
    if (document.documentElement.dataset.mode !== 'local') throw Error('Recorded review mode.');
    const status = await api('api/status'); localMode = status.mode === 'local'; fixtureReady = status.fixture_ready; modelReady = status.model_ready;
    $('#environment-note').textContent = fixtureReady ? 'Local workbench · isolated execution ready · synthetic data only' : 'Local workbench · run npm run demo:setup to prepare isolated execution';
    $('#model-message').textContent = modelReady ? 'One paid request. Review the returned source changes before execution.' : 'Configure a server-side Nebius key, verified current prices, and the request budget to enable generation.';
  } catch {
    $('#environment-note').textContent = 'Browser-only recorded review · new execution requires the local build';
    $('#model-message').textContent = 'Fresh generation requires the local Node app and server-side Nebius configuration.';
  }
  environmentSummary = $('#environment-note').textContent;
  $('#local-execution-controls').hidden = !localMode;
  $('#analyze-form').hidden = !localMode; $('#replay-local-guide').hidden = localMode;
  if (!localMode) {
    $('#model-heading').textContent = 'Run a new repair in the local build.';
    $('#source-sharing-explanation').textContent = 'This browser review shows recorded edits and their matching evidence. The local build can request a new proposal using your server-side Nebius configuration.';
    $('[data-tab="repair"] strong').textContent = 'Review the source'; $('[data-tab="repair"] small').textContent = 'Exact recorded changes';
    $('#source-files').disabled = true;
  }
  await recorded();
  initializing = false; controls();
}
init().catch(error => { $('#environment-note').textContent = error.message; });
