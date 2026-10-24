'use strict';
// Records the demo video from the replay page (npm run replay must be running):
// node scripts/record-agent-demo.cjs → media/accessfinish-agent-demo.mp4 (captioned, silent).
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), os = require('node:os');
const {chromium} = require('playwright');
const URL = process.env.AF_DEMO_URL || 'http://127.0.0.1:4178/';
const out = path.join(__dirname, '../media/accessfinish-agent-demo.mp4');

async function main() {
  const summary = JSON.parse(fs.readFileSync(path.join(__dirname, '../web/agent-runs/summary.json'), 'utf8'));
  const phone = summary.cases['customer-phone'], keyboard = summary.cases['keyboard-date'];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'af-video-'));
  const browser = await chromium.launch();
  // Timestamped screenshots instead of recordVideo: the screencast drops time under load,
  // which would put the captions out of sync.
  const context = await browser.newContext({viewport: {width: 1600, height: 900}});
  const page = await context.newPage(), cues = [], frames = [];
  await page.goto(URL); await page.waitForTimeout(500);
  const start = Date.now();
  let recording = true;
  const capture = (async () => {
    while (recording) {
      const at = Date.now(), file = path.join(dir, String(frames.length).padStart(5, '0') + '.jpg');
      await page.screenshot({path: file, type: 'jpeg', quality: 85}); frames.push({file, at});
    }
  })();
  const now = () => (Date.now() - start) / 1000;
  const say = async (text, seconds) => { cues.push({from: now(), to: now() + seconds, text}); await page.waitForTimeout(seconds * 1000); };
  const scrollTo = selector => page.evaluate(sel => document.querySelector(sel).scrollIntoView({behavior: 'smooth', block: 'start'}), selector);
  const click = async (selector, index = 0) => { await page.locator(selector).nth(index).click(); await page.waitForTimeout(300); };

  await say('Ask an AI to fix a form and it says "fixed". The page loads, a confirmation appears.', 5);
  await say('But was the user\'s booking actually saved — correctly? AccessFinish checks.', 5);
  await scrollTo('#agent'); await page.waitForTimeout(800);
  await click('[data-case=customer-phone]');
  await say('Here the booking page says success, but the database stored the wrong phone number.', 6);
  await say('AccessFinish runs the journey in a real browser and hands the evidence to NVIDIA Nemotron on Nebius Token Factory. No hints.', 6);
  await click('.step > button', 1);
  await say('Nemotron finds the hardcoded value and proposes a one-line fix.', 6);
  await click('.step > button', 2);
  await say('Each fix is built in a fresh offline sandbox: the database row, a fresh browser, and a second customer with a different number.', 8);
  await say(`${phone.first_attempt} of ${phone.runs} live runs fixed and verified on the first attempt — about half a cent each.`, 6);
  // The keyboard run is long; show its whole timeline at once instead of animating it.
  await page.emulateMedia({reducedMotion: 'reduce'});
  await click('[data-case=keyboard-date]'); await page.waitForTimeout(400);
  await scrollTo('#agent'); await page.locator('.step > button').first().click();
  await say('The harder case: a keyboard user cannot reach the date picker at all.', 6);
  await page.evaluate(() => window.scrollBy({top: 700, behavior: 'smooth'}));
  await say('Nemotron opens source files, proposes fixes, and every attempt is built and tested for real.', 6);
  const wrong = page.locator('.step.fail > button', {hasText: 'saved for'});
  if (await wrong.count()) await wrong.last().click();
  await say('Nemotron makes the date reachable and the page says "booked". But the database holds the wrong day. Rejected.', 7);
  await page.evaluate(() => document.querySelector('.history .jump')?.scrollIntoView({behavior: 'smooth', block: 'center'}));
  await say('The timeline shows why: 0.7 seconds after a page request, with no key pressed, the date resets itself.', 7);
  await scrollTo('#finding'); await page.waitForTimeout(600);
  await say(`${keyboard.wrong_saves_caught} fake "booked" confirmations across ${keyboard.runs} runs. None got through.`, 7);
  await scrollTo('.facts'); await page.waitForTimeout(600);
  await say(`${summary.runs} live runs, $${summary.cost_usd.toFixed(2)} of Nemotron. Fixes that are proven, not promised.`, 6);
  await scrollTo('.hero'); await page.waitForTimeout(600);
  await say('AccessFinish — finish the task, verify the result.', 4);
  recording = false; await capture; await context.close(); await browser.close();
  // Resample the captured frames onto an exact 30 fps timeline.
  const seq = path.join(dir, 'seq'); fs.mkdirSync(seq);
  const end = Date.now();
  for (let k = 0, j = 0; frames[0].at + k * 1000 / 30 <= end; k++) {
    const t = frames[0].at + k * 1000 / 30;
    while (j + 1 < frames.length && frames[j + 1].at <= t) j++;
    fs.linkSync(frames[j].file, path.join(seq, String(k).padStart(6, '0') + '.jpg'));
  }
  const offset = (frames[0].at - start) / 1000;

  const stamp = s => { s = Math.max(0, s - offset); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = (s % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${sec}`; };
  const ass = ['[Script Info]', 'PlayResX: 1600', 'PlayResY: 900', '', '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, BackColour, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV',
    'Style: Cap,Inter,34,&H00FFFFFF,&H C0141D3B,3,14,0,2,160,160,48'.replace('&H C0', '&HC0'), '', '[Events]', 'Format: Layer, Start, End, Style, Text',
    ...cues.map(cue => `Dialogue: 0,${stamp(cue.from)},${stamp(cue.to)},Cap,${cue.text.replace(/\n/g, ' ')}`)].join('\n');
  const assFile = path.join(dir, 'captions.ass'); fs.writeFileSync(assFile, ass);
  fs.writeFileSync(out.replace(/\.mp4$/, '.srt'), cues.map((cue, i) => `${i + 1}\n${stamp(cue.from).replace('.', ',')}0 --> ${stamp(cue.to).replace('.', ',')}0\n${cue.text}\n`).join('\n'));
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(seq, '%06d.jpg'), '-vf', `ass=${assFile}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', out]);
  fs.rmSync(dir, {recursive: true, force: true});
  console.log(JSON.stringify({video: out, seconds: Number(((end - start) / 1000).toFixed(1)), frames: frames.length, captions: cues.length}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
