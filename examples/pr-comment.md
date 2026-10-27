## AccessFinish: ✅ verified fix found

> **Goal:** A customer who uses only the keyboard books the 09:00 slot on a chosen date, and the booking is saved and reopens with that exact date.

| Attempt | Verdict | What the verifier found |
| :---: | --- | --- |
| 1 | ❌ keyboard | Keyboard user got stuck at the date step: there is no date field to Tab to |
| 2 | ❌ outcome | Confirmation shown, but saved for 2026-11-01 09:00 instead of 2026-11-02 09:00; page code changed the typed date to 01/11/2026 |
| 3 | ❌ keyboard | Keyboard user got stuck at the date step: there is no date field to Tab to |
| 4 | ❌ outcome | Saved for the right date, but reopening the booking showed 2026-10-26 instead of 2026-11-02 |
| 5 | ❌ apply | Rejected before execution: The replacement anchor must match exactly once. |
| 6 | ✅ verified | Saved correctly, reopened in a fresh browser, regression checks passed |

### Why attempt 2 was blocked although the page said "booked"

| | Typed by the user | Saved in the database |
| --- | --- | --- |
| Appointment | `2026-11-02 09:00:00` | `2026-11-01 09:00:00` |

The verifier recorded the code that changed the typed date (DevTools async stack, newest call first):

```text
+0.6s  page code set the date field to "01/11/2026" via setDate ← setDateTimePickerValue ← applyUnavailableDates ← resolveWith ← (XMLHttpRequest.send) ← send ← ajax ← getUnavailableDates ← (setTimeout) ← onMonthChange ← setDate
```

### Why attempt 4 was blocked although the date was saved right

Reopening the booking in a fresh browser: the date field held `select-date="02/11/2026" (hidden)`, then `select-date="26/10/2026"` after **Next**; the customer would see **2026-10-26**.

### Attempt 6: verified

- Saved appointment: `2026-11-02 09:00:00`, reopened in a fresh browser as `2026-11-02`
- Keyboard actions: 149
- [x] Trusted build in an offline sandbox
- [x] Booking completed with the keyboard only
- [x] Saved row read back with a read-only database account
- [x] Booking reopened in a fresh browser
- [x] Mouse booking with different data, using month navigation
- [x] Clearing the date causes no error
- [x] Reserved slot is not offered
- [x] Existing records unchanged
- [x] Sandbox isolation inspected

<details><summary>Patch (74 lines)</summary>

```diff
diff --git a/assets/js/pages/booking.js b/assets/js/pages/booking.js
index 36697fc..c33b9dd 100644
--- a/assets/js/pages/booking.js
+++ b/assets/js/pages/booking.js
@@ -132,6 +132,11 @@ App.Pages.Booking = (function () {
                             '-01',
                     );
 
+                    // Skip if the month has not changed
+                    if (previousMoment.month() === displayedMonthMoment.month() && previousMoment.year() === displayedMonthMoment.year()) {
+                        return;
+                    }
+
                     const monthChangeStep = detectDatepickerMonthChangeStep(previousMoment, displayedMonthMoment);
 
                     App.Http.Booking.getUnavailableDates(
@@ -154,6 +159,11 @@ App.Pages.Booking = (function () {
                             '-01',
                     );
 
+                    // Skip if the month has not changed
+                    if (previousMoment.month() === displayedMonthMoment.month() && previousMoment.year() === displayedMonthMoment.year()) {
+                        return;
+                    }
+
                     const monthChangeStep = detectDatepickerMonthChangeStep(previousMoment, displayedMonthMoment);
 
                     App.Http.Booking.getUnavailableDates(
@@ -423,15 +433,22 @@ App.Pages.Booking = (function () {
 
             // If we are on the first step, fetch unavailable dates and available hours for step 2.
             if ($target.attr('data-step_index') === '1') {
-                const todayMoment = moment();
-
-                App.Utils.UI.setDateTimePickerValue($selectDate, todayMoment.toDate());
-
-                App.Http.Booking.getUnavailableDates(
-                    $selectProvider.val(),
-                    $selectService.val(),
-                    todayMoment.format('YYYY-MM-DD'),
-                );
+                const selectedDate = App.Utils.UI.getDateTimePickerValue($selectDate);
+                if (!selectedDate) {
+                    const todayMoment = moment();
+                    App.Utils.UI.setDateTimePickerValue($selectDate, todayMoment.toDate());
+                    App.Http.Booking.getUnavailableDates(
+                        $selectProvider.val(),
+                        $selectService.val(),
+                        todayMoment.format('YYYY-MM-DD'),
+                    );
+                } else {
+                    App.Http.Booking.getUnavailableDates(
+                        $selectProvider.val(),
+                        $selectService.val(),
+                        moment(selectedDate).format('YYYY-MM-DD'),
+                    );
+                }
             }
 
             // If we are on the 2nd tab then the user should have an appointment hour selected.
diff --git a/application/views/components/booking_time_step.php b/application/views/components/booking_time_step.php
index 617dc3a..8eff1a6 100644
--- a/application/views/components/booking_time_step.php
+++ b/application/views/components/booking_time_step.php
@@ -13,7 +13,7 @@
 
         <div class="row frame-content">
             <div class="col-12 col-lg-6">
-                <div id="select-date" class="mx-auto my-4"></div>
+                <input type="text" id="select-date" class="mx-auto my-4" />
 
             </div>
```
</details>

<sub>Model: nvidia/nemotron-3-super-120b-a12b on Nebius Token Factory · 6 attempts · estimated $0.13 at list price · <a href="https://github.com/SultanAlfaifi/accessfinish/blob/main/evidence/agent-runs/agent-2c87e16a520f678b45cbbbeb.json">raw trace</a></sub>
