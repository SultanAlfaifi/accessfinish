'use strict';
const form = document.querySelector('#review-form'), status = document.querySelector('#feedback-status');
let started = null, feedback = null, caseIdentity = null;
document.querySelector('#start-review').addEventListener('click', async () => {
  if (started) return;
  const read = async file => { const response = await fetch(file); if (!response.ok) throw Error('The recorded review case could not be loaded.'); return response.json(); };
  try {
    const [featured, files] = await Promise.all([read('featured-case.json'), read('source-context.json')]), run = await read(featured.recording);
    await AccessFinishRecording.validate({featured, files, run});
    caseIdentity = {recorded_run_id: run.id, proposal_sha256: run.proposal_sha256, source_sha256: run.source_sha256, evaluation_index: featured.evaluation_index};
  } catch (error) { document.querySelector('#timer-status').textContent = error.message + ' Refresh or ask your inviter for the reviewed build.'; return; }
  started = new Date();
  document.querySelector('#timer-status').textContent = 'Started at ' + started.toLocaleTimeString('en-GB') + '. Open the workbench, try the tasks, then return here.';
  document.querySelector('#start-review').disabled = true;
});
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!started) { status.textContent = 'Start the timer and try the tasks before preparing feedback.'; return; }
  const data = new FormData(form), finished = new Date();
  feedback = {schema_version: 1, study: 'independent_browser_only_developer_review', reviewed_case: caseIdentity, participant: data.get('participant'), independent_developer_attested: data.get('independent') === 'on',
    started_at_utc: started.toISOString(), finished_at_utc: finished.toISOString(), elapsed_wall_seconds: Math.round((finished - started) / 1000),
    elapsed_time_includes_interruptions: true, completed_without_help: data.get('completed_without_help'),
    provenance_response: data.get('provenance_response'), recording_response: data.get('recording_response'), outcome_response: data.get('outcome_response'),
    approval_response: data.get('approval_response'), failed_attempt_response: data.get('failed_attempt_response'), usefulness: Number(data.get('usefulness')), feedback: data.get('feedback'),
    anonymous_quote_allowed: data.get('anonymous_quote_allowed') === 'on', browser: navigator.userAgent,
    source_url: new URL('./', location.href).href, installation_verified: false, new_execution_verified: false, answers_uploaded_by_page: false};
  document.querySelector('#feedback-preview').textContent = JSON.stringify(feedback, null, 2);
  document.querySelector('#feedback-export').hidden = false; status.textContent = 'Your feedback is ready to download or copy. It has not been uploaded.';
});
document.querySelector('#download-feedback').addEventListener('click', () => {
  if (!feedback) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(feedback, null, 2) + '\n'], {type: 'application/json'})), link = document.createElement('a');
  link.href = url; link.download = 'accessfinish-' + feedback.participant + '-browser-review.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.querySelector('#copy-feedback').addEventListener('click', async () => {
  if (!feedback) return;
  try { await navigator.clipboard.writeText(JSON.stringify(feedback, null, 2)); status.textContent = 'Feedback copied. Send it to your inviter.'; }
  catch { status.textContent = 'Clipboard access was unavailable. Use Download feedback JSON.'; }
});
