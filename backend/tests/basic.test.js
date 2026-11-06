import test from 'node:test';
import assert from 'node:assert/strict';

test('attendance action accepts only timeIn or timeOut semantics', () => {
  const action = (value) => value === 'timeOut' ? 'timeOut' : 'timeIn';
  assert.equal(action('timeIn'), 'timeIn');
  assert.equal(action('timeOut'), 'timeOut');
  assert.equal(action('anything'), 'timeIn');
});

test('CSV escaping doubles embedded quotes', () => {
  const cell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  assert.equal(cell('A "quoted" name'), '"A ""quoted"" name"');
});
