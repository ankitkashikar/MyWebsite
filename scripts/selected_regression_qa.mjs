// Offline selected-feature regression only. No Supabase connection or deployment.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const pglite=resolve(root,'.migration-rehearsal/node_modules/@electric-sql/pglite/dist/index.js');
if(!existsSync(pglite)||!existsSync(resolve(root,'.migration-rehearsal/node_modules/linkedom/esm/index.js'))){
 console.error('Missing offline test dependencies. Run: npm install --prefix .migration-rehearsal --no-save --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8 linkedom@0.18.12');process.exit(1);
}
const suites=['menu_options_qa.mjs','backend_scheduling_qa.mjs','bulk_scheduling_qa.mjs','delivery_timezone_qa.mjs','customer_progress_qa.mjs','kitchen_alerts_qa.mjs','customers_dom_qa.mjs','admin_startup_qa.mjs','error_monitoring_qa.mjs','coupon_admin_qa.mjs','delivery_settings_qa.mjs','customers_qa.mjs','migration_upgrade_qa.mjs'];
let failed=0;
for(const suite of suites){
 const r=spawnSync(process.execPath,[resolve(root,'scripts',suite)],{cwd:root,env:{...process.env,PGLITE_MODULE:pglite},encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024});
 const pass=r.status===0&&!r.error;
 console.log(`${pass?'PASS':'FAIL'} ${suite}`);
 console.log((r.stdout||'').trim());
 if(!pass){failed++;console.error(r.error?.message||r.stderr||`Exit: ${r.status}`);}
}
console.log(`${suites.length-failed}/${suites.length} selected offline suites passed. Synthetic data/mocked runtime only; no production or real payment verification.`);
process.exitCode=failed?1:0;
