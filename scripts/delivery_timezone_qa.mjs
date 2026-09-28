// Execute the actual picker functions with fixed clocks and device timezones.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../menu.html', import.meta.url), 'utf8');
const code = 'const OPEN_HOUR = 16;\n' + html.slice(html.indexOf('  function getBusinessWindow('), html.indexOf('  function renderSlotNowWrap('));
const cases = [
  ['2026-09-23T10:29:59Z', false, 16, '2026-09-23T10:30:00.000Z'],
  ['2026-09-23T10:30:00Z', true, 16, '2026-09-23T10:30:00.000Z'],
  ['2026-09-23T10:30:01Z', true, 15, '2026-09-23T11:00:00.000Z'],
  ['2026-09-23T18:00:00Z', true, 0, null],
  ['2026-09-23T18:29:59Z', true, 0, null],
  ['2026-09-23T18:30:00Z', false, 16, '2026-09-24T10:30:00.000Z'],
  ['2026-12-31T18:30:00Z', false, 16, '2027-01-01T10:30:00.000Z'],
];
let count = 0;
for (const zone of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Asia/Kathmandu', 'Pacific/Auckland']) {
  process.env.TZ = zone;
  for (const [instant, open, slots, first] of cases) {
    const NativeDate = Date;
    class Clock extends NativeDate { constructor(...args) { super(...(args.length ? args : [instant])); } }
    const ctx = vm.createContext({Date: Clock, Intl});
    vm.runInContext(code, ctx);
    assert.equal(vm.runInContext('isOpenNow()', ctx), open);
    const actual = vm.runInContext('generateSlots(0)', ctx);
    assert.equal(actual.length, slots);
    assert.equal(actual[0]?.start.toISOString() ?? null, first);
    assert.equal(vm.runInContext('generateSlots(1).length', ctx), 16);
    assert.match(vm.runInContext('fmtOpenTime(0)', ctx), /4:00\s*pm/i);
    count++;
  }
  console.log(`PASS device timezone ${zone}: opening, rounding, midnight and year rollover`);
}
console.log(`${count} fixed-clock scheduling cases passed; backend scheduling acceptance excluded.`);
