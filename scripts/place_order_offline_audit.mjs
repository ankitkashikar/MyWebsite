const bulkQaDate = new Date(Date.now() + 3 * 86400000).toISOString();
// Runs the actual handler with an in-memory database double. No network/secrets.
// Requires Node 24+. These are handler tests, not PostgreSQL/integration tests.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../supabase/functions/place-order/index.ts', import.meta.url), 'utf8');
const code = stripTypeScriptTypes(source.replace(/^import .*createClient.*;$/m, ''));
const base = () => ({ type: 'normal', idempotency_key: '12345678-1234-4123-8123-123456789abc', name: 'Test Customer', phone: '9123456780', address: 'Test building, apartment 12, Test Road', pincode: '411057', items: [{id: 'dish', qty: 2}], payment_method: 'upi', delivery_slot: 'Today 6 PM' });

async function invoke(payload, options = {}) {
  const writes = [];
  let handler;
  const products = options.products ?? [{id: 'dish', name: 'Test dish', price: 199, active: true, order_type: payload.type}];
  const db = {
    rpc: async (name, args) => {
      if(name==='consume_security_rate_limit')return {data:true};
      if(name==='lookup_order_request')return {data:options.existing ? {...options.existing,success:true,duplicate:true}:null};
      if(name==='quote_coupon')return {error:{code:'P0001'}};
      assert.equal(name,'create_order_atomic');
      writes.push({table:payload.type+'_orders',row:args.p_order});
      writes.push({table:payload.type+'_order_items',row:args.p_items});
      return {data:{success:true,order_number:'CBD-2026-000999',total:args.p_order.total}};
    },
    from(table) {
      let row, operation, ids, channel;
      const result = () => {
        if (table === 'products') return {data: products.filter(p => ids.includes(p.id) && p.order_type === channel)};
        if (operation === 'upsert') { writes.push({table, row}); return {data: {id: 'customer'}}; }
        if (operation === 'insert') {
          writes.push({table, row});
          return {data: {id: 'order', order_number: 'CBD-2026-000999', total: row.total}};
        }
        return {data: options.existing ?? null};
      };
      const q = {
        select() { return q; },
        eq(k, v) { if (k === 'order_type') channel = v; return q; },
        in(k, v) { ids = v; return q; },
        insert(v) { row = v; operation = 'insert'; return q; },
        upsert(v) { row = v; operation = 'upsert'; return q; },
        single: async () => result(), maybeSingle: async () => result(),
        then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
      };
      return q;
    },
  };
  runInNewContext(code, {
    createClient: () => db, Deno: {env: {get: () => 'offline-test-placeholder'}, serve: h => {handler = h;}},
    Request, Response, TextEncoder, crypto, console: {error() {},warn() {}},
  });
  const response = await handler(new Request('https://offline.invalid/place-order', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)}));
  return {status: response.status, body: await response.json(), writes};
}

let passed = 0;
async function check(name, action) { await action(); passed++; console.log(`PASS ${name}`); }
function order(result) { return result.writes.find(w => w.table.endsWith('_orders'))?.row; }
for (const type of ['normal', 'bulk']) {
  for (const price of [0, 1, -1]) {
    await check(`${type}: forged money (${price}) and paid state ignored`, async () => {
      const result = await invoke({...base(), type, delivery_datetime: bulkQaDate, items: [{id: 'dish', qty: 2, price, unit_price: price}], subtotal: 0, total: 0, grand_total: 0, discount: 99999, discountPercent: 100, delivery_charge: -999, tax: -999, payment_amount: 1, payment_status: 'paid', payment_reference: 'FORGED'});
      assert.equal(result.status, 200);
      assert.equal(result.body.total, 398);
      assert.equal(order(result).subtotal, 398);
      assert.equal(order(result).discount, 0);
      assert.equal(order(result).payment_status, 'pending');
      assert.equal(order(result).payment_reference, undefined);
      assert.equal(result.writes.find(w => w.table.endsWith('_order_items')).row[0].unit_price, 199);
    });
  }
}
for (const qty of [0, -1, 0.5, 51, 1000000, '2']) {
  await check(`invalid normal quantity ${JSON.stringify(qty)} rejected`, async () => {
    const result = await invoke({...base(), items: [{id: 'dish', qty}]});
    assert.equal(result.status, 400); assert.equal(result.writes.length, 0);
  });
}
for (const products of [[], [{id: 'dish', price: 199, active: false, order_type: 'normal'}], [{id: 'dish', price: 199, active: true, order_type: 'bulk'}]]) {
  await check('missing/inactive/wrong-channel product rejected', async () => {
    const result = await invoke(base(), {products}); assert.equal(result.status, 400); assert.equal(result.writes.length, 0);
  });
}
await check('duplicate lines consolidated and correctly priced', async () => {
  const result = await invoke({...base(), items: [{id: 'dish', qty: 1}, {id: 'dish', qty: 2}]});
  assert.equal(result.body.total, 597);
  const lines = result.writes.find(w => w.table.endsWith('_order_items')).row;
  assert.equal(lines.length, 1); assert.equal(lines[0].quantity, 3);
});
await check('existing idempotency key returns existing order without inserts', async () => {
  const result = await invoke(base(), {existing: {order_number: 'CBD-2026-000999', total: 398}});
  assert.equal(result.body.duplicate, true); assert.equal(result.writes.length, 0);
});
for (const change of [{pincode: '000000'}, {payment_method: 'cod'}]) {
  await check('invalid PIN/payment method rejected', async () => {
    const result = await invoke({...base(), ...change}); assert.equal(result.status, 400); assert.equal(result.writes.length, 0);
  });
}
for (const type of ['normal', 'bulk']) {
  const payload = {...base(), type, delivery_datetime: bulkQaDate};
  const product = price => ({id: 'dish', name: 'Test dish', price, active: true, order_type: type});
  for (const price of [null, undefined, 0, '0.00', -1, '-1', '', ' ', true, false, [], {}, NaN, Infinity, -Infinity, 'NaN', 'Infinity', '1e2', '0x10', ' 199 ', '+199', '01.00', 1.005, '1.001', '199.000', 100000000, '9007199254740991']) {
    await check(`${type}: invalid catalogue price ${String(price)} rejected before writes`, async () => {
      const result = await invoke(payload, {products: [product(price)]});
      assert.equal(result.status, 500);
      assert.equal(result.body.success, false);
      assert.equal(result.body.message, 'Could not price this order.');
      assert.equal(result.writes.length, 0);
    });
  }
  for (const [price, qty, expected] of [[0.1, 3, 0.3], ['0.01', 3, 0.03], [19.99, 3, 59.97], ['199.90', 2, 399.8], ['199', 2, 398], ['1.2', 3, 3.6], ['99999999.99', 1, 99999999.99]]) {
    await check(`${type}: ${price} x ${qty} has exact currency result`, async () => {
      const result = await invoke({...payload, items: [{id: 'dish', qty}]}, {products: [product(price)]});
      assert.equal(result.status, 200);
      assert.equal(result.body.total, expected);
      assert.equal(order(result).subtotal, expected);
      assert.equal(order(result).total, expected);
      assert.equal(order(result).payment_status, 'pending');
      const line = result.writes.find(w => w.table.endsWith('_order_items')).row[0];
      assert.equal(line.unit_price, Number(price));
      assert.equal(line.line_total, expected);
    });
  }
  await check(`${type}: mixed decimal lines sum exactly`, async () => {
    const result = await invoke({...payload, items: [{id: 'dish', qty: 1}, {id: 'other', qty: 1}]}, {products: [product(0.1), {...product(0.2), id: 'other'}]});
    assert.equal(result.status, 200); assert.equal(result.body.total, 0.3);
  });
  await check(`${type}: duplicate decimal lines consolidate exactly`, async () => {
    const result = await invoke({...payload, items: [{id: 'dish', qty: 1}, {id: 'dish', qty: 2}]}, {products: [product(0.1)]});
    assert.equal(result.body.total, 0.3);
    assert.equal(result.writes.find(w => w.table.endsWith('_order_items')).row.length, 1);
  });
  await check(`${type}: line overflow rejected before writes`, async () => {
    const result = await invoke(payload, {products: [product('99999999.99')]});
    assert.equal(result.status, 500); assert.equal(result.writes.length, 0);
  });
  await check(`${type}: aggregate overflow rejected before writes`, async () => {
    const result = await invoke({...payload, items: [{id: 'dish', qty: 1}, {id: 'other', qty: 1}]}, {products: [product('50000000.00'), {...product('50000000.00'), id: 'other'}]});
    assert.equal(result.status, 500); assert.equal(result.writes.length, 0);
  });
}
for (const coupon_code of ['FAKE100', {code: 'FAKE', discount: 9999}, ['TEN', 'FLAT']]) {
  await check('invalid or unverifiable coupon rejected before writes', async () => {
    const result = await invoke({...base(), coupon_code});
    assert.equal(result.status, 400); assert.equal(result.writes.length, 0);
  });
}
console.log(`\n${passed} protection checks passed. Probing known gaps separately:`);
// Observations, deliberately not security acceptance assertions. Fixes should
// turn these into rejection tests in subsequent development steps.
for (const [label, payload, options] of [
  ['arbitrary delivery slot accepted', {...base(), delivery_slot: 'not-a-real-slot'}, {}],
]) {
  const result = await invoke(payload, options);
  console.log(`OBSERVATION ${label}: HTTP ${result.status}; total=${result.body.total}; storedCoupon=${order(result)?.coupon_code}`);
}
