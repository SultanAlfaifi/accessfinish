'use strict';
// Captures 2x close-ups of the real page for the demo film (npm run replay must be running):
//   node scripts/capture-film-assets.cjs → media/agent-demo/shots/*.png
// The keyboard scenes come from one verified live run (AF_FILM_KB_RUN), so the film tells that run's story.
const fs = require('node:fs'), path = require('node:path');
const {chromium} = require('playwright');
const URL = process.env.AF_DEMO_URL || 'http://127.0.0.1:4178/';
const KB_RUN = process.env.AF_FILM_KB_RUN || 'agent-2c87e16a520f678b45cbbbeb';
const dir = path.join(__dirname, '../media/agent-demo/shots');

async function main() {
  fs.mkdirSync(dir, {recursive: true});
  const browser = await chromium.launch();
  const page = await (await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 2, reducedMotion: 'reduce', bypassCSP: true})).newPage();
  const shot = async (selector, name) => { const target = page.locator(selector).first(); await target.scrollIntoViewIfNeeded(); await target.screenshot({path: path.join(dir, name + '.png')}); };
  // Open the step whose label matches, e.g. /Attempt 2 · Verify/.
  const open = async pattern => {
    const steps = page.locator('.step > button'), labels = await steps.allInnerTexts(), index = labels.findIndex(label => pattern.test(label));
    if (index < 0) throw Error('No step matches ' + pattern);
    await steps.nth(index).click(); await page.waitForTimeout(250);
  };
  // Keep the detail panel in normal flow so element screenshots show all of it.
  const unstick = () => page.addStyleTag({content: '.detail{position:static!important;max-height:none!important;overflow:visible!important}'});

  await page.goto(URL + '?case=customer-phone'); await page.waitForTimeout(800); await unstick();
  await open(/Attempt 1 · Verify/); await shot('#detail', 'phone-proof');

  const run = JSON.parse(fs.readFileSync(path.join(__dirname, '../evidence/agent-runs', KB_RUN + '.json'), 'utf8'));
  const verifies = run.steps.filter(step => step.kind === 'verify'), wrong = verifies.find(step => step.stage === 'outcome' && !/^Saved for the right date/.test(step.headline));
  const reopen = verifies.find(step => /^Saved for the right date/.test(step.headline));
  if (run.state !== 'verified' || !wrong || !reopen) throw Error(KB_RUN + ' is not a verified run with a wrong save and a reopen failure.');
  await page.goto(URL + '?case=keyboard-date&run=' + KB_RUN); await page.waitForTimeout(800); await unstick();
  await page.click('#show-all').catch(() => {}); await page.waitForTimeout(300);
  await open(/Run the journey on the original code/); await shot('#detail', 'kb-observe');
  await shot('.console', 'kb-console');
  await open(new RegExp('Attempt ' + wrong.attempt + ' · Nemotron proposes')); await shot('#detail', 'kb-propose');
  await open(new RegExp('Attempt ' + wrong.attempt + ' · Verify')); await shot('#detail .compare', 'kb-compare'); await shot('#detail .history', 'kb-history');
  await open(new RegExp('Attempt ' + reopen.attempt + ' · Verify')); await shot('#detail', 'kb-reopen');
  await open(new RegExp('Attempt ' + run.accepted.attempt + ' · Nemotron proposes')); await shot('#detail', 'kb-fix');
  await open(new RegExp('Attempt ' + run.accepted.attempt + ' · Verify')); await shot('#detail', 'kb-proof');
  await browser.close();
  console.log(fs.readdirSync(dir).join(' '));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
