// Refresh code only in the marked, unlinked local fixture. Preserve DB and credentials.
import {existsSync,readFileSync,writeFileSync,cpSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),qa=resolve(root,'.local-supabase-qa');
assert.ok(existsSync(qa+'/TCB_LOCAL_QA_ONLY'),'Prepare local checkout QA first');
assert.ok(!existsSync(qa+'/supabase/.temp/project-ref'),'Refusing linked project');
const config=readFileSync(qa+'/supabase/config.toml','utf8');
assert.match(config,/^project_id = "tcb-checkout-qa"$/m);
assert.match(config,/^port = 55321$/m);
assert.match(config,/^port = 55322$/m);
for(const name of ['place-order','validate-coupon','order-status','admin-orders']) {
 cpSync(root+'/supabase/functions/'+name,qa+'/supabase/functions/'+name,{recursive:true});
 const file=qa+'/supabase/functions/'+name+'/index.ts';
 writeFileSync(file,readFileSync(file,'utf8').replaceAll('https://ankitkashikar.github.io','http://127.0.0.1:4173'));
}
console.log('Refreshed local QA function code; database and credentials preserved.');
