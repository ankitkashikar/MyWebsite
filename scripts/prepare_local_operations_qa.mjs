import {existsSync,readFileSync,writeFileSync,cpSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),qa=resolve(root,'.local-supabase-qa');
assert.ok(existsSync(qa+'/TCB_LOCAL_QA_ONLY'),'Prepare local checkout QA first');
assert.ok(!existsSync(qa+'/supabase/.temp/project-ref'),'Refusing linked project');
const path=qa+'/supabase/config.toml';let config=readFileSync(path,'utf8');
assert.match(config,/project_id = "tcb-checkout-qa"/);
if(!config.includes('[functions.admin-orders]'))config+='\n[functions.admin-orders]\nverify_jwt = true\n';
writeFileSync(path,config);
for (const name of ['admin-orders','order-status']) {
 cpSync(root+'/supabase/functions/'+name,qa+'/supabase/functions/'+name,{recursive:true});
 const fn=qa+'/supabase/functions/'+name+'/index.ts';
 writeFileSync(fn,readFileSync(fn,'utf8').replaceAll('https://ankitkashikar.github.io','http://127.0.0.1:4173'));
}
const email=`ops-${crypto.randomUUID()}@example.com`;
writeFileSync(qa+'/operations.json',JSON.stringify({email}));
writeFileSync(qa+'/operations.env',`TCB_ADMIN_EMAIL=${email}\n`);
console.log('Prepared local-only operations account configuration; production files unchanged.');
