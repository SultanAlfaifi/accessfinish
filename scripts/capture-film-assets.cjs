'use strict';
// Captures 2x close-ups of the real page for the demo film (npm run replay must be running):
//   node scripts/capture-film-assets.cjs → media/agent-demo/shots/*.png
const fs = require('node:fs'), path = require('node:path');
const {chromium} = require('playwright');
const URL = process.env.AF_DEMO_URL || 'http://127.0.0.1:4178/';
const dir = path.join(__dirname, '../media/agent-demo/shots');

async function main() {
  fs.mkdirSync(dir, {recursive: true});
  const browser = await chromium.launch();
  const page = await (await browser.newContext({viewport: {width: 1440, height: 1000}, deviceScaleFactor: 2, reducedMotion: 'reduce', bypassCSP: true})).newPage();
  const shot = async (selector, name) => { const target = page.locator(selector).first(); await target.scrollIntoViewIfNeeded(); await target.screenshot({path: path.join(dir, name + '.png')}); };
  const step = async index => { await page.locator('.step > button').nth(index).click(); await page.waitForTimeout(250); };
  // Keep the detail panel in normal flow so element screenshots show all of it.
  const unstick = () => page.addStyleTag({content: '.detail{position:static!important;max-height:none!important;overflow:visible!important}'});
  await page.goto(URL); await page.waitForTimeout(800); await unstick();

  await page.click('[data-case=customer-phone]'); await page.waitForTimeout(400);
  await step(0); await shot('#detail', 'phone-observe');
  await step(1); await shot('#detail', 'phone-propose');
  await step(2); await shot('#detail', 'phone-proof');
  await shot('.console', 'phone-console');

  await page.click('[data-case=keyboard-date]'); await page.waitForTimeout(400);
  await step(0); await shot('#detail', 'kb-observe');
  await shot('.console', 'kb-console');
  await page.locator('.step.fail > button', {hasText: 'saved for'}).last().click(); await page.waitForTimeout(250);
  await shot('#detail', 'kb-wrong');
  await shot('#detail .compare', 'kb-compare');
  await shot('#detail .history', 'kb-history');
  await shot('#finding', 'finding');
  await browser.close();
  console.log(fs.readdirSync(dir).join(' '));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
