'use strict';
// Fixed trusted regression driver. It does not execute model-supplied commands.
const assert = require('node:assert/strict');
async function run({chromium, scenario}) {
  const browser = await chromium.launch({headless: true, chromiumSandbox: true});
  const context = await browser.newContext({timezoneId: 'UTC', locale: 'en-US'});
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:8080' ? route.continue() : route.abort();
  });
  const chooseDate = async iso => {
    const date = new Date(iso + 'T12:00:00Z'), year = date.getUTCFullYear(), month = date.getUTCMonth();
    for (let step = 0; step < 15; step++) {
      const shownYear = Number(await page.locator('.flatpickr-calendar .cur-year').inputValue());
      const shownMonth = Number(await page.locator('.flatpickr-monthDropdown-months').inputValue());
      if (shownYear === year && shownMonth === month) break;
      await page.locator((shownYear * 12 + shownMonth < year * 12 + month) ? '.flatpickr-next-month' : '.flatpickr-prev-month').click();
      await page.waitForTimeout(1000);
      if (step === 14) throw Error('Calendar navigation exceeded its bounded month budget.');
    }
    const label = new Intl.DateTimeFormat('en-US', {month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'}).format(date);
    const day = page.locator('.flatpickr-day[aria-label="' + label + '"]:not(.prevMonthDay):not(.nextMonthDay)');
    assert.equal(await day.count(), 1); assert.ok(!String(await day.getAttribute('class')).includes('flatpickr-disabled'));
    const response = page.waitForResponse(response => response.url().endsWith('/booking/get_available_hours') && response.request().postData()?.includes(iso));
    await day.click(); await (await response).finished(); await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.querySelectorAll('.available-hour').length > 0);
  };
  try {
    await page.goto('http://127.0.0.1:8080/booking', {waitUntil: 'networkidle'});
    await page.locator('#select-service').selectOption(String(scenario.service_id));
    await page.locator('#select-provider').selectOption(String(scenario.provider_id));
    await page.locator('#button-next-1').click();
    await chooseDate(scenario.date);
    // The UTC test browser displays the seeded 10:00 Riyadh reservation at 07:00.
    const reservedSlotAbsent = await page.getByRole('button', {name: '7:00 am', exact: true}).count() === 0;
    assert.ok(reservedSlotAbsent, 'The seeded unavailable slot was offered.');
    const dateInput = page.locator('input#select-date');
    await dateInput.fill(''); await dateInput.press('Tab'); await page.waitForTimeout(350);
    assert.deepEqual(errors, [], 'Clearing the date raised a browser error.');
    await chooseDate(scenario.pointer_date);
    await page.getByRole('button', {name: '6:00 am', exact: true}).click();
    await page.locator('#button-next-2').click();
    for (const [id, key] of [['first-name', 'first_name'], ['last-name', 'last_name'], ['email', 'email'], ['phone-number', 'phone_number']]) await page.locator('#' + id).fill(scenario.pointer_customer[key]);
    await page.locator('#button-next-3').click();
    for (const id of ['accept-to-terms-and-conditions', 'accept-to-privacy-policy']) {
      const consent = page.locator('#' + id); if (await consent.isVisible()) await consent.check();
    }
    await page.locator('#book-appointment-submit').click(); await page.waitForURL(/\/booking_confirmation\//);
    assert.deepEqual(errors, []);
    return {pass: true, reserved_slot_not_offered: true, cleared_date_without_browser_error: true,
      pointer_confirmation_observed: true, calendar_navigation_observed: true, browser_timezone: 'UTC', page_errors: errors};
  } finally { await context.close(); await browser.close(); }
}
module.exports = {run};
