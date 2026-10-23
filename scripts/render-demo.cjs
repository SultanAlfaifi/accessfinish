'use strict';
// Master compositor: actual CUA UI captures, edited timing, English captions, no audio.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const media = path.resolve(__dirname, '../media'), capture = JSON.parse(fs.readFileSync(path.join(media, 'capture-v02.json'), 'utf8'));
const preview = process.argv.includes('--preview'), fps = 30;
fs.mkdirSync(path.join(media, 'review'), {recursive: true});
const scenes = [
  ['01-opening.jpg', 8, 'ACCESSFINISH / WORKING DEMONSTRATION', 'A source repair. A booking you can prove.\nFor developers and accessibility QA reviewing AI-generated patches.'],
  ['02-blockage.jpg', 12, '1 / OBSERVE THE BLOCKED TASK', 'The original date control was a non-focusable div.\nLoading the page did not prove the keyboard booking could finish.'],
  ['03-model-record.jpg', 12, '2 / NEMOTRON ON NEBIUS TOKEN FACTORY', 'Nemotron 3 Super generated these source edits.\nThe diagnosis and repair direction were supplied. This request is recorded.'],
  ['04-date-input.jpg', 8, '3 / REVIEW THE EXACT PATCH', 'Five proposed edits. The date control becomes keyboard-editable.\nReview the source before approving execution.'],
  ['05-calendar-guard.jpg', 6, 'PRESERVE THE REQUESTED DATE', 'Deferred calendar refreshes can overwrite a typed date.\nThe stored date must match the requested task.'],
  ['06-preserve-date.jpg', 6, 'CHECK THE WHOLE BOOKING PATH', 'Clearing the input must be safe.\nReopening the appointment must retain its date and customer data.'],
  ['07-approved-hash.jpg', 6, '4 / APPROVE THIS EXACT PROPOSAL', 'Approval binds the displayed patch hash to this execution.\nThe fixture is fresh, isolated, and synthetic.'],
  ['LIVE', 50],
  ['09-verified-outcome.jpg', 14, '5 / VERIFIED OUTCOME FOR THIS RUN', 'November 2, 2026 · 09:00–09:30 Asia/Riyadh.\nStorage, fresh reopen, preservation, and regression controls passed.'],
  ['10-all-outcomes.jpg', 10, 'RETAIN THE FAILURES', 'Two of five frozen attempts passed the full procedure.\nTwo failed to compile; one failed a calendar control after keyboard success.'],
  ['01-opening.jpg', 8, 'SOURCE AND LOCAL BUILD / GITHUB.COM/SULTANALFAIFI/ACCESSFINISH', 'One exposed case, with guided source generation.\nBroader repair and screen-reader validation remain open.'],
];
const liveDescriptions = {
  QUEUED: ['FRESH LOCAL EXECUTION / RECORDED MODEL PROPOSAL', 'The approved proposal enters a new isolated execution.\nNo new model request is made during this capture.'],
  PREPARING: ['ISOLATED SYNTHETIC FIXTURE', 'Trusted setup prepares separate source, app, database, and reader roles.\nCandidate execution has no model key or external network.'],
  BUILDING: ['TRUSTED BUILD', 'The patched application is compiled before the keyboard task.\nA build pass alone cannot verify the saved outcome.'],
  BOOKING: ['NATIVE KEYBOARD TASK', 'A fixed native keyboard procedure completes the booking.\nConfirmation remains subject to independent outcome checks.'],
  VERIFYING: ['INDEPENDENT OUTCOME AND REGRESSION CHECKS', 'A SELECT-only reader checks storage; a fresh browser reopens the booking.\nPointer booking, unavailable-slot, and preservation checks also run.'],
  'VERIFIED FOR THIS RUN': ['ACTUAL EXECUTION / CHECKS PASSED', 'The expected booking and regression checks passed for this exact run.\nThe proposal hash remains attached to its evidence.'],
};
const timeline = preview ? [['03-model-record.jpg', 6, scenes[2][2], scenes[2][3]]] : scenes;
const inputs = [], cues = [], assets = new Set(); let seconds = 0;
for (const [file, duration, tag, text] of timeline) {
  if (file !== 'LIVE') { inputs.push({file, duration}); assets.add(file); cues.push({start: seconds, end: seconds + duration, tag, text}); }
  else {
    for (let index = 0; index < 50; index++) {
      const frame = capture.execution_frames[index], description = liveDescriptions[frame.flag];
      if (!description) throw Error('The capture contains an unexpected execution state: ' + frame.flag);
      inputs.push({file: frame.file, duration: 1}); assets.add(frame.file);
      const last = cues.at(-1);
      if (last && last.tag === description[0] && last.end === seconds + index) last.end++;
      else cues.push({start: seconds + index, end: seconds + index + 1, tag: description[0], text: description[1]});
    }
  }
  seconds += duration;
}
for (const file of assets) if (!fs.existsSync(path.join(media, 'raw/v02', file))) throw Error('Missing actual capture: ' + file);
const normalized = path.join(media, 'review/normalized-v02'); fs.mkdirSync(normalized, {recursive: true});
for (const file of assets) {
  const target = path.join(normalized, file.replace(/\.jpg$/, '.png'));
  const result = cp.spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(media, 'raw/v02', file),
    '-vf', 'scale=1600:900:flags=lanczos,format=rgb24', '-frames:v', '1', target], {shell: false, windowsHide: true, encoding: 'utf8'});
  if (result.status !== 0) throw Error('Capture normalization failed: ' + result.stderr);
}
const stem = preview ? 'review/preview-v02' : 'accessfinish-demo-v02';
const inputPath = file => 'review/normalized-v02/' + file.replace(/\.jpg$/, '.png');
const concat = ['ffconcat version 1.0', ...inputs.flatMap(input => ["file '" + inputPath(input.file) + "'", 'duration ' + input.duration]), "file '" + inputPath(inputs.at(-1).file) + "'"].join('\n') + '\n';
fs.writeFileSync(path.join(media, 'video-inputs-v02.ffconcat'), concat);
const assTime = value => { const total = Math.round(value * 100); return `${Math.floor(total / 360000)}:${String(Math.floor(total / 6000) % 60).padStart(2, '0')}:${String(Math.floor(total / 100) % 60).padStart(2, '0')}.${String(total % 100).padStart(2, '0')}`; };
const srtTime = value => { const total = Math.round(value * 1000); return `${String(Math.floor(total / 3600000)).padStart(2, '0')}:${String(Math.floor(total / 60000) % 60).padStart(2, '0')}:${String(Math.floor(total / 1000) % 60).padStart(2, '0')},${String(total % 1000).padStart(3, '0')}`; };
const ass = '[Script Info]\nScriptType: v4.00+\nPlayResX: 1600\nPlayResY: 900\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,Segoe UI,26,&H00FFFFFF,&H00FFFFFF,&H0018254B,&H0018254B,0,0,0,0,100,100,0,0,1,0,0,2,80,80,24,1\nStyle: Tag,Segoe UI,14,&H00EABFAC,&H00EABFAC,&H0018254B,&H0018254B,-1,0,0,0,100,100,1.3,0,1,0,0,2,80,80,99,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' + cues.flatMap(cue => [
  `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Caption,,0,0,0,,${cue.text.replace(/\n/g, '\\N')}`,
  `Dialogue: 1,${assTime(cue.start)},${assTime(cue.end)},Tag,,0,0,0,,${cue.tag}`,
]).join('\n') + '\n';
fs.writeFileSync(path.join(media, 'captions-v02.ass'), ass);
if (!preview) fs.writeFileSync(path.join(media, 'accessfinish-demo-v02.srt'), cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join('\n'));
const args = ['-hide_banner', '-y', '-safe', '0', '-f', 'concat', '-i', 'video-inputs-v02.ffconcat', '-vf', 'fps=30,drawbox=x=0:y=772:w=iw:h=128:color=0x18254b:t=fill,ass=captions-v02.ass,scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p,settb=1/30,setpts=N',
  '-frames:v', String(seconds * fps), '-an', '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-video_track_timescale', '90000', '-movflags', '+faststart', stem + '.mp4'];
console.log(JSON.stringify({render: stem + '.mp4', duration_seconds: seconds, frames: seconds * fps, model_requests: 0, audio: 'silent', capture_mode: capture.capture_mode}));
const child = cp.spawn('ffmpeg', args, {cwd: media, shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
let log = ''; child.stderr.on('data', chunk => { log = (log + chunk).slice(-2000000); });
child.on('close', code => {
  fs.writeFileSync(path.join(media, 'review/render-v02.log'), log);
  if (code !== 0) { console.error(log.slice(-6000)); process.exitCode = 1; return; }
  if (!preview) fs.writeFileSync(path.join(media, 'timeline-v02.json'), JSON.stringify({schema_version: 1, spec: {width: 1600, height: 900, fps: 30, frames: seconds * fps, seconds},
    capture: 'capture-v02.json', output: stem + '.mp4', captions: 'accessfinish-demo-v02.srt', cues, assets: [...assets].map(file => ({file: 'raw/v02/' + file,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(media, 'raw/v02', file))).digest('hex'), provenance: 'Actual CUA capture of the project-owned local workbench; synthetic data'})),
    music: false, audio_streams: 0, continuous_playback_review: 'pending', reviewed: false}, null, 2) + '\n');
  console.log('VIDEO_RENDERED');
});
