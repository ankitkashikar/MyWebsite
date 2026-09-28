// Creates an unlinked, disposable project; never edits production configuration.
import {mkdirSync,readFileSync,writeFileSync,copyFileSync,cpSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'), out=resolve(root,'.local-supabase-qa');
if(existsSync(out))throw new Error('QA directory already exists. Keep it for investigation or choose a fresh extracted project.');
mkdirSync(out+'/supabase/migrations',{recursive:true});
writeFileSync(out+'/supabase/config.toml',`project_id = "tcb-checkout-qa"
[api]
enabled = true
port = 55321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
port = 55322
shadow_port = 55320
major_version = 17
[db.seed]
enabled = false
[studio]
enabled = false
[inbucket]
enabled = false
[storage]
enabled = false
[analytics]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:4173"
[edge_runtime]
enabled = true
policy = "per_worker"
[functions.place-order]
verify_jwt = true
[functions.validate-coupon]
verify_jwt = true
[functions.order-status]
verify_jwt = false
`);
copyFileSync(root+'/scripts/fixtures/website-schema-20260920.sql',out+'/supabase/migrations/20260919000000_exported_schema.sql');
for(const file of ['20260920000100_coupon_validation.sql','20260920000200_atomic_orders.sql','20260923000100_delivery_settings.sql','20260923000200_coupon_admin.sql','20260924000100_audit_grants.sql','20260925000100_admin_customers.sql'])copyFileSync(root+'/supabase/migrations/'+file,out+'/supabase/migrations/'+file);
for(const name of ['place-order','validate-coupon','order-status']) {
 cpSync(root+'/supabase/functions/'+name,out+'/supabase/functions/'+name,{recursive:true});
 const file=out+'/supabase/functions/'+name+'/index.ts';
 writeFileSync(file,readFileSync(file,'utf8').replaceAll('https://ankitkashikar.github.io','http://127.0.0.1:4173'));
}
writeFileSync(out+'/TCB_LOCAL_QA_ONLY','Disposable TCB checkout acceptance project. Never link or deploy.\n');
console.log('Prepared isolated .local-supabase-qa project. Only copied CORS origins changed to loopback.');
