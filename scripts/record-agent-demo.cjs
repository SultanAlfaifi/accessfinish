'use strict';
// Records the demo video from the replay page (npm run replay must be running):
//   node scripts/record-agent-demo.cjs → media/accessfinish-agent-demo.mp4
// Scenes follow media/agent-demo/narration.json. When media/agent-demo/timeline.json
// exists (scripts/narrate.py), each scene lasts exactly as long as its spoken beat and
// the narration is mixed in; otherwise durations are estimated and the video is silent.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), os = require('node:os');
const {chromium} = require('playwright');
const URL = process.env.AF_DEMO_URL || 'http://127.0.0.1:4178/';
const media = path.join(__dirname, '../media'), demo = path.join(media, 'agent-demo');
const out = path.join(media, 'accessfinish-agent-demo.mp4');

// What the page shows during each beat.
const scenes = {
  'hero': async page => { await page.evaluate(() => window.scrollTo(0, 0)); },
  'phone-observe': async page => { await page.click('[data-case=customer-phone]'); await scrollTo(page, '#agent'); await stepClick(page, 0); },
  'phone-propose': async page => { await stepClick(page, 1); },
  'phone-proof': async page => { await stepClick(page, 2); },
  'keyboard-intro': async page => { await page.click('[data-case=keyboard-date]'); await page.waitForTimeout(300); await scrollTo(page, '#agent'); await stepClick(page, 0); },
  'keyboard-attempts': async page => { await page.evaluate(() => window.scrollBy({top: 700, behavior: 'smooth'})); },
  'keyboard-wrong': async page => {
    const wrong = page.locator('.step.fail > button', {hasText: 'saved for'});
    if (await wrong.count()) await wrong.last().click();
  },
  'keyboard-timeline': async page => { await page.evaluate(() => document.querySelector('.history .jump')?.scrollIntoView({behavior: 'smooth', block: 'center'})); },
  'finding': async page => { await scrollTo(page, '#finding'); },
  'facts': async page => { await scrollTo(page, '.facts'); },
  'close': async page => { await scrollTo(page, '.hero'); },
};
const scrollTo = (page, selector) => page.evaluate(sel => document.querySelector(sel).scrollIntoView({behavior: 'smooth', block: 'start'}), selector);
const stepClick = async (page, index) => { await page.locator('.step > button').nth(index).click(); };

async function main() {
  const script = JSON.parse(fs.readFileSync(path.join(demo, 'narration.json'), 'utf8'));
  const timelineFile = path.join(demo, 'timeline.json'), timeline = fs.existsSync(timelineFile) ? JSON.parse(fs.readFileSync(timelineFile, 'utf8')) : null;
  const gap = script.gap_seconds;
  // Beat windows in seconds from the start of the video.
  let at = 0;
  const beats = script.beats.map(beat => {
    const spoken = timeline?.beats.find(item => item.id === beat.id);
    const seconds = spoken ? spoken.end_seconds - spoken.start_seconds : beat.text.split(/\s+/).length / 2.6;
    const window = {...beat, from: at, to: at + seconds + gap}; at = window.to; return window;
  });
  for (const beat of beats) if (!scenes[beat.id]) throw Error('No scene for beat ' + beat.id);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-video-'));
  const browser = await chromium.launch();
  const context = await browser.newContext({viewport: {width: 1600, height: 900}, reducedMotion: 'reduce'});
  const page = await context.newPage(), frames = [];
  await page.goto(URL); await page.waitForTimeout(800);
  // Timestamped screenshots instead of recordVideo: the screencast drops time under load.
  let recording = true;
  const start = Date.now();
  const capture = (async () => {
    while (recording) {
      const time = Date.now(), file = path.join(dir, String(frames.length).padStart(5, '0') + '.jpg');
      await page.screenshot({path: file, type: 'jpeg', quality: 85}); frames.push({file, at: time});
    }
  })();
  for (const beat of beats) {
    await scenes[beat.id](page);
    const wait = start + beat.to * 1000 - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
  }
  const end = Date.now();
  recording = false; await capture; await context.close(); await browser.close();

  // Resample the captured frames onto an exact 30 fps timeline that starts at `start`.
  const seq = path.join(dir, 'seq'); fs.mkdirSync(seq);
  for (let k = 0, j = 0; start + k * 1000 / 30 <= end; k++) {
    const time = start + k * 1000 / 30;
    while (j + 1 < frames.length && frames[j + 1].at <= time) j++;
    fs.linkSync(frames[j].file, path.join(seq, String(k).padStart(6, '0') + '.jpg'));
  }
  const stamp = (s, comma) => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = (s % 60).toFixed(comma ? 3 : 2).padStart(comma ? 6 : 5, '0');
    return `${comma ? String(h).padStart(2, '0') : h}:${String(m).padStart(2, '0')}:${comma ? sec.replace('.', ',') : sec}`; };
  const ass = ['[Script Info]', 'PlayResX: 1600', 'PlayResY: 900', 'WrapStyle: 0', '', '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, BackColour, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV',
    'Style: Cap,Inter,32,&H00FFFFFF,&HC0141D3B,3,14,0,2,180,180,44', '', '[Events]', 'Format: Layer, Start, End, Style, Text',
    ...beats.map(beat => `Dialogue: 0,${stamp(beat.from)},${stamp(beat.to - gap / 2)},Cap,${beat.text}`)].join('\n');
  const assFile = path.join(dir, 'captions.ass'); fs.writeFileSync(assFile, ass);
  fs.writeFileSync(out.replace(/\.mp4$/, '.srt'), beats.map((beat, i) => `${i + 1}\n${stamp(beat.from, true)} --> ${stamp(beat.to - gap / 2, true)}\n${beat.text}\n`).join('\n'));
  const audio = timeline ? ['-i', path.join(demo, timeline.narration_file)] : [];
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(seq, '%06d.jpg'), ...audio, '-vf', `ass=${assFile}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', ...(timeline ? ['-c:a', 'aac', '-b:a', '160k', '-shortest'] : []), out]);
  fs.rmSync(dir, {recursive: true, force: true});
  console.log(JSON.stringify({video: out, seconds: Number(((end - start) / 1000).toFixed(1)), narrated: !!timeline, beats: beats.length}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
