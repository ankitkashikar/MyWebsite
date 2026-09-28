const bulkQaDate = new Date(Date.now() + 3 * 86400000).toISOString();
// Real PostgreSQL sessions in a disposable Docker container. No external DB URL.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const docker = (...args) => execFileSync('docker', args, {encoding:'utf8', timeout:120000}).trim();
const name = `tcb-concurrency-${crypto.randomUUID()}`;
const clients = [];
let started = false, checks = 0;
const test = async (label, fn) => { await fn(); checks++; console.log(`PASS ${label}`); };
try {
  // Fail before making any changes if the required runtime is unavailable.
  docker('version', '--format', '{{.Server.Version}}');
  const pgModule = await import(process.env.PG_MODULE || 'pg');
  const Client = pgModule.Client ?? pgModule.default?.Client;
  assert.equal(typeof Client, 'function', 'PostgreSQL module must export a Client constructor');
  docker('run', '--detach', '--rm', '--name', name,
    '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD=local-test-only',
    '--env', 'POSTGRES_DB=tcb_concurrency', 'postgres:16');
  started = true;
  const port = Number(docker('port', name, '5432/tcp').split(':').at(-1));
  assert.ok(Number.isInteger(port) && port > 0);
  const config = {host:'127.0.0.1', port, database:'tcb_concurrency', user:'postgres',
    password:'local-test-only', connectionTimeoutMillis:1000, statement_timeout:15000};
  async function connect() {
    const c = new Client(config);
    try { await c.connect(); } catch (error) { await c.end().catch(()=>{}); throw error; }
    clients.push(c); return c;
  }
  let observer;
  const deadline = Date.now()+30000;
  while (!observer) {
    try { observer = await connect(); }
    catch(error) { if(Date.now()>deadline) throw error; await delay(100); }
  }
  for (const path of ['./offline_order_fixture.sql',
    '../supabase/migrations/20260920000100_coupon_validation.sql',
    '../supabase/migrations/20260920000200_atomic_orders.sql']) {
    await observer.query(readFileSync(new URL(path, import.meta.url),'utf8'));
  }
  await observer.query("insert into products values ('bulk-other','Second bulk',100,true,'bulk')");
  const a = await connect(), b = await connect();
  for(const c of [a,b]) await c.query('set role service_role');
  const pid = async c => (await c.query('select pg_backend_pid() pid')).rows[0].pid;
  const [observerPid,aPid,bPid] = await Promise.all([observer,a,b].map(pid));
  assert.equal(new Set([observerPid,aPid,bPid]).size,3);
  console.log(`PostgreSQL ${(await observer.query('show server_version')).rows[0].server_version}; three independent backend PIDs verified.`);

  // Poll PostgreSQL's lock graph: a scheduling delay alone does not prove contention.
  async function blockedBy(waiter, blocker) {
    const until = Date.now()+5000;
    while(Date.now()<until) {
      const r = await observer.query('select $2::int = any(pg_blocking_pids($1::int)) blocked',[waiter,blocker]);
      if(r.rows[0].blocked) return;
      await delay(20);
    }
    throw new Error(`Expected backend ${waiter} to wait on ${blocker}`);
  }
  function order(type='normal', patch={}) {
    const id=type==='normal'?'dish':'bulk', price=type==='normal'?199.99:250;
    const request={type,name:'Concurrency Customer',phone:'9123456780',
      address:'Offline test building apartment 12', notes:'', coupon_code:null,
      pincode:'411057',delivery_slot:'Tomorrow 6 PM',event_type:'Office',
      delivery_datetime:bulkQaDate,items:[{id,qty:2}],...patch};
    return {key:crypto.randomUUID(),request,
      money:{subtotal:price*2,discount:0,delivery_fee:0,total:price*2},
      items:[{product_id:id,product_name:type==='normal'?'Dish':'Bulk',
        unit_price:price,quantity:2,line_total:price*2}]};
  }
  const call = (c,p) => c.query('select create_order_atomic($1,$2::jsonb,$3::jsonb,$4::jsonb) result',
    [p.key,JSON.stringify(p.request),JSON.stringify(p.money),JSON.stringify(p.items)]).then(r=>r.rows[0].result);
  // Attach rejection handlers immediately to concurrent operations.
  const outcome = p => p.then(value=>({value}),error=>({error}));
  const counts = async () => (await observer.query(`select
    (select count(*)::int from customers) customers,
    (select count(*)::int from normal_orders) normal,
    (select count(*)::int from bulk_orders) bulk,
    (select count(*)::int from normal_order_items) normal_items,
    (select count(*)::int from bulk_order_items) bulk_items,
    (select count(*)::int from order_requests) requests`)).rows[0];
  async function saved(p, expectedLines=1) {
    const type=p.request.type;
    const rows=(await observer.query(`select o.*, (select count(*)::int from ${type}_order_items i where i.order_id=o.id) lines
      from ${type}_orders o where idempotency_key=$1`,[p.key])).rows;
    assert.equal(rows.length,1); assert.equal(rows[0].lines,expectedLines);
    assert.equal(rows[0].payment_status,'pending');
    assert.equal(Number(rows[0].total),p.money.total);
    assert.equal((await observer.query('select count(*)::int n from order_requests where idempotency_key=$1 and response is not null',[p.key])).rows[0].n,1);
  }
  async function race(first, second, expectedCode) {
    await a.query('begin');
    const winner = await call(a,first);
    const pending = outcome(call(b,second));
    try { await blockedBy(bPid,aPid); }
    finally { await a.query('commit'); }
    const loser = await pending;
    if(expectedCode) assert.equal(loser.error?.code,expectedCode);
    else { assert.ifError(loser.error); assert.deepEqual(loser.value,{...winner,duplicate:true}); }
    await saved(first);
  }
  for(const type of ['normal','bulk']) {
    await test(`${type}: same key blocks then returns committed original`,async()=>{
      const p=order(type), before=await counts(); await race(p,p);
      const after=await counts(); assert.equal(after[type],before[type]+1);
      assert.equal(after.requests,before.requests+1);
    });
    await test(`${type}: changed request blocks then conflicts`,async()=>{
      const p=order(type), before=await counts();
      await race(p,{...p,request:{...p.request,notes:'Changed'}},'P0002');
      const after=await counts(); assert.equal(after[type],before[type]+1);
      assert.equal(after.requests,before.requests+1);
    });
  }
  await test('same key across normal and bulk conflicts after waiting',async()=>{
    const p=order(), second={...order('bulk'),key:p.key}, before=await counts();
    await race(p,second,'P0002'); assert.equal((await counts()).bulk,before.bulk);
  });
  for(const perPhone of [false,true]) {
    await test(`${perPhone?'per-phone':'global'} coupon limit serializes normal/bulk orders`,async()=>{
      const code=perPhone?'PHONEONE':'GLOBALONE';
      await observer.query(`insert into coupons(code,active,kind,value,${perPhone?'per_phone_limit':'usage_limit'}) values($1,true,'flat',1000,1)`,[code]);
      const p=order('normal',{coupon_code:code});
      const second=order('bulk',{coupon_code:code,phone:perPhone?p.request.phone:'9234567801'});
      for(const x of [p,second]) { x.money.discount=10; x.money.total-=10; }
      const before=await counts(); await race(p,second,'P0001');
      const after=await counts(); assert.equal(after.bulk,before.bulk);
      assert.equal(after.requests,before.requests+1);
      assert.equal((await observer.query(`select count(*)::int n from (
        select coupon_code from normal_orders union all select coupon_code from bulk_orders) o where coupon_code=$1`,[code])).rows[0].n,1);
    });
  }
  // Fail after a first line has been written. An observer holds the gate so the
  // retry must overlap the failing statement and wait on its uncommitted key.
  await observer.query(`create function qa_fail_second() returns trigger language plpgsql as $$
    begin if new.product_id in ('other','bulk-other') and current_setting('tcb.qa_fail',true)='on' then
      perform pg_advisory_xact_lock(918273);
      raise exception 'injected second item failure';
    end if; return new; end $$;
    create trigger qa_fail before insert on normal_order_items for each row execute function qa_fail_second();
    create trigger qa_fail before insert on bulk_order_items for each row execute function qa_fail_second();`);
  for(const type of ['normal','bulk']) {
    for(const newCustomer of [false,true]) {
      await test(`${type}: item failure rolls back ${newCustomer?'new':'existing'} customer and waiting retry succeeds`,async()=>{
        const p=order(type,{name:'Retried Customer',phone:newCustomer?(type==='normal'?'9345678012':'9456780123'):'9123456780'});
        const extra=type==='normal'?'other':'bulk-other';
        p.request.items.push({id:extra,qty:1}); p.request.items.sort((x,y)=>x.id<y.id?-1:1);
        p.items.push({product_id:extra,product_name:type==='normal'?'Other':'Second bulk',unit_price:100,quantity:1,line_total:100});
        p.money.subtotal+=100; p.money.total+=100;
        const before=await counts();
        await observer.query('select pg_advisory_lock(918273)');
        await a.query("begin; set local tcb.qa_fail='on'");
        const failed=outcome(call(a,p)); let retry;
        try {
          await blockedBy(aPid,observerPid);
          // Other sessions see none of the unfinished customer/order/line/key writes.
          assert.deepEqual(await counts(),before);
          retry=outcome(call(b,p)); await blockedBy(bPid,aPid);
        } finally { await observer.query('select pg_advisory_unlock(918273)'); }
        const failure=await failed; assert.equal(failure.error?.code,'P0001');
        await a.query('rollback');
        const result=await retry; assert.ifError(result.error); assert.equal(result.value.success,true);
        assert.notEqual(result.value.duplicate,true);
        await saved(p,2);
        const after=await counts();
        assert.equal(after[type],before[type]+1);
        assert.equal(after[type+'_items'],before[type+'_items']+2);
        assert.equal(after.requests,before.requests+1);
        assert.equal(after.customers,before.customers+(newCustomer?1:0));
      });
    }
  }
  console.log(`\n${checks} independent-connection concurrency scenarios passed. Fixture schema only; production compatibility remains unverified.`);
} catch(error) {
  console.error(`CONCURRENCY NOT VERIFIED: ${error.message}`);
  process.exitCode=1;
} finally {
  // End sessions before removing the disposable instance, even on assertion failure.
  await Promise.allSettled(clients.map(c=>c.end()));
  if(started) docker('rm','--force',name);
}
