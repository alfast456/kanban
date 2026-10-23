const test = require('node:test');
const assert = require('node:assert/strict');

// Replicate taskUtils logic in CommonJS test context
const PRIORITIES = ['Low', 'Medium', 'High'];

function dueStatus(dueDate, customToday) {
  if (!dueDate) return '';
  const today = customToday ? new Date(customToday) : new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return 'overdue';
  if (days <= 2) return 'soon';
  return 'upcoming';
}

function formatDueDate(dueDate) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${dueDate.slice(0, 10)}T00:00:00`));
}

test('dueStatus returns empty string if no date', () => {
  assert.equal(dueStatus(null), '');
  assert.equal(dueStatus(''), '');
});

test('dueStatus flags overdue tasks correctly', () => {
  const mockToday = '2026-10-23T00:00:00';
  assert.equal(dueStatus('2026-10-20', mockToday), 'overdue');
});

test('dueStatus flags tasks due soon (within 2 days)', () => {
  const mockToday = '2026-10-23T00:00:00';
  assert.equal(dueStatus('2026-10-23', mockToday), 'soon');
  assert.equal(dueStatus('2026-10-24', mockToday), 'soon');
  assert.equal(dueStatus('2026-10-25', mockToday), 'soon');
});

test('dueStatus flags upcoming tasks (beyond 2 days)', () => {
  const mockToday = '2026-10-23T00:00:00';
  assert.equal(dueStatus('2026-10-28', mockToday), 'upcoming');
});

test('formatDueDate returns valid formatted string', () => {
  const formatted = formatDueDate('2026-10-23');
  assert.match(formatted, /2026/);
  assert.match(formatted, /23/);
});
