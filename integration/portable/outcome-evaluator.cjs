'use strict';

// Pure outcome evaluator for OPEN DEVELOPMENT data, not a held-out G3 result.
// Callers own source/DB/server isolation, trustworthy snapshots, clocks and actions.
// Snapshot tables are the SELECT projections from booking-oracle.php; columns not
// selected by that oracle are outside this evaluator's preservation claim.
// No DOM selector, input element, keyboard sequence or proposed repair is required.

const TABLES = ['appointments', 'customers', 'services', 'providers'];
const CUSTOMER_FIELDS = ['first_name', 'last_name', 'email', 'phone_number'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function serialized(value) { return JSON.stringify(canonical(value)); }
function equalRows(a, b) { return serialized(a) === serialized(b); }
function equalTable(a, b) {
  return serialized(a.map(serialized).sort()) === serialized(b.map(serialized).sort());
}

function idOf(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const id = String(value);
  return /^\d+$/.test(id) ? id : null;
}

function indexRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = idOf(row.id);
    if (id === null || map.has(id)) return null;
    map.set(id, row);
  }
  return map;
}

function validSnapshot(snapshot) {
  return snapshot && TABLES.every(table => Array.isArray(snapshot[table]) &&
    snapshot[table].every(row => row && typeof row === 'object' && !Array.isArray(row)));
}

function dateParts(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? parsed : null;
}

function reopenedDate(reopened) {
  if (typeof reopened.selected_date_iso === 'string') return reopened.selected_date_iso;
  // Compatibility only for the saved manual-reference reports; new drivers should
  // supply an independently observed ISO date, not copy task.target_date here.
  const match = typeof reopened.selected_date === 'string' &&
    /^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(reopened.selected_date);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1]);
  if (month < 0) return null;
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function reopenedSameAppointment(reopened, appointment) {
  if (reopened.appointment_id !== undefined) {
    return idOf(reopened.appointment_id) === idOf(appointment.id);
  }
  if (typeof reopened.url !== 'string' || typeof appointment.hash !== 'string' || !appointment.hash) return false;
  try {
    const pathname = new URL(reopened.url).pathname.replace(/\/$/, '');
    return pathname.endsWith('/booking/reschedule/' + encodeURIComponent(appointment.hash));
  } catch { return false; }
}

/**
 * evaluate({before, after, task, reopened, violations}) -> {pass, reasons, nochangecontrols}
 *
 * booking task: {kind:'booking', target_date:'YYYY-MM-DD',
 *   customer:{first_name,last_name,email,phone_number},
 *   start_time?:'09:00:00', duration_minutes?:30}
 * `duration` is also accepted as a minutes alias; conflicting values fail.
 * The protocol must freeze optional business values BEFORE both model attempts.
 * Service 1/provider 2/customer role 3, Booked and is_unavailability=0 are fixed.
 * reopened: {customer, last, selected_date_iso, db_unchanged:true,
 *   appointment_id} OR the actual reschedule URL identifying the added row.
 * Legacy selected_date:'October 5, 2026' is also accepted for saved reports.
 * no-change task: {kind:'no_change'}; reopened:{control_pass:true} must come
 * from the trusted task driver observing the required negative/control behavior.
 * violations must be an explicit array; missing evidence fails closed.
 */
function evaluate({ before, after, task, reopened, violations } = {}) {
  const reasons = [];
  const nochangecontrols = {};
  const fail = reason => { if (!reasons.includes(reason)) reasons.push(reason); };
  const finish = () => ({ pass: reasons.length === 0, reasons, nochangecontrols });

  if (!Array.isArray(violations)) fail('missing_interaction_audit');
  else if (violations.length) fail('interaction_violation');
  if (!validSnapshot(before) || !validSnapshot(after)) {
    fail('invalid_snapshot');
    return finish();
  }
  for (const table of TABLES) nochangecontrols[table + '_unchanged'] = equalTable(before[table], after[table]);
  nochangecontrols.snapshots_unchanged = TABLES.every(table => nochangecontrols[table + '_unchanged']);

  const indexes = {};
  for (const table of ['appointments', 'customers']) {
    indexes[table] = { before: indexRows(before[table]), after: indexRows(after[table]) };
    if (!indexes[table].before || !indexes[table].after) fail('invalid_or_duplicate_' + table + '_id');
  }
  if (reasons.some(reason => reason.startsWith('invalid_or_duplicate_'))) return finish();
  if (!task || !['booking', 'no_change'].includes(task.kind || 'booking')) {
    fail('invalid_task_kind');
    return finish();
  }
  if (task.kind === 'no_change') {
    if (!nochangecontrols.snapshots_unchanged) fail('control_modified_snapshot');
    if (reopened?.control_pass !== true) fail('control_behavior_not_verified');
    return finish();
  }

  for (const table of ['appointments', 'customers']) {
    const { before: oldRows, after: newRows } = indexes[table];
    nochangecontrols['existing_' + table + '_preserved'] = [...oldRows].every(
      ([id, row]) => newRows.has(id) && equalRows(row, newRows.get(id)));
    if (!nochangecontrols['existing_' + table + '_preserved']) fail('existing_' + table + '_changed');
  }
  if (!nochangecontrols.services_unchanged) fail('services_changed');
  if (!nochangecontrols.providers_unchanged) fail('providers_changed');

  const addedAppointments = after.appointments.filter(row => !indexes.appointments.before.has(idOf(row.id)));
  const addedCustomers = after.customers.filter(row => !indexes.customers.before.has(idOf(row.id)));
  if (addedAppointments.length !== 1) fail('expected_exactly_one_new_appointment');
  if (addedCustomers.length !== 1) fail('expected_exactly_one_new_customer');

  const day = dateParts(task.target_date);
  let startTime = task.start_time ?? '09:00:00';
  if (typeof startTime === 'string' && /^\d{2}:\d{2}$/.test(startTime)) startTime += ':00';
  const duration = task.duration_minutes ?? task.duration ?? 30;
  const validTime = typeof startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(startTime);
  const conflictingDuration = task.duration_minutes !== undefined && task.duration !== undefined && task.duration_minutes !== task.duration;
  if (!day || !validTime || !Number.isInteger(duration) || duration < 1 || duration > 1440 || conflictingDuration) fail('invalid_task_schedule');
  const expectedCustomer = task.customer || task.expected_customer;
  if (!expectedCustomer || !CUSTOMER_FIELDS.every(field => typeof expectedCustomer[field] === 'string' && expectedCustomer[field].length > 0)) {
    fail('invalid_task_customer');
  }
  if (reasons.some(reason => reason.startsWith('invalid_task_'))) return finish();

  const expectedStart = task.target_date + ' ' + startTime;
  // Arithmetic treats SQL local wall time as a timezone-free tuple; it does not
  // claim those DB strings are UTC. Provider timezone is the runner's contract.
  const expectedEnd = new Date(new Date(expectedStart.replace(' ', 'T') + 'Z').getTime() + duration * 60000)
    .toISOString().slice(0, 19).replace('T', ' ');
  if (addedAppointments.length === 1) {
    const appointment = addedAppointments[0];
    if (appointment.start_datetime !== expectedStart) fail('wrong_start_datetime');
    if (appointment.end_datetime !== expectedEnd) fail('wrong_end_datetime_or_duration');
    if (idOf(appointment.id_services) !== '1') fail('wrong_service');
    if (idOf(appointment.id_users_provider) !== '2') fail('wrong_provider');
    if (String(appointment.is_unavailability) !== '0') fail('wrong_unavailability_flag');
    if (appointment.status !== 'Booked') fail('wrong_booking_status');
    if (addedCustomers.length === 1 && idOf(appointment.id_users_customer) !== idOf(addedCustomers[0].id)) fail('wrong_customer_relationship');

    // Protect the occupied-slot fixture even if the task configuration is wrong.
    const overlaps = before.appointments.some(row => idOf(row.id_users_provider) === '2' &&
      typeof row.start_datetime === 'string' && typeof row.end_datetime === 'string' &&
      row.start_datetime < expectedEnd && row.end_datetime > expectedStart);
    if (overlaps) fail('requested_slot_overlaps_existing_appointment');
    if (!reopenedSameAppointment(reopened || {}, appointment)) fail('reopen_wrong_or_unverified_appointment');
  }
  if (addedCustomers.length === 1) {
    const customer = addedCustomers[0];
    if (!CUSTOMER_FIELDS.every(field => customer[field] === expectedCustomer[field])) fail('wrong_customer_fields');
    if (idOf(customer.id_roles) !== '3') fail('wrong_customer_role');
  }
  if (!reopened || reopened.customer !== expectedCustomer.first_name || reopened.last !== expectedCustomer.last_name) fail('reopen_customer_mismatch');
  if (!reopened || reopenedDate(reopened) !== task.target_date) fail('reopen_date_mismatch');
  if (reopened?.db_unchanged !== true) fail('reopen_db_preservation_not_verified');
  return finish();
}

module.exports = { evaluate };
