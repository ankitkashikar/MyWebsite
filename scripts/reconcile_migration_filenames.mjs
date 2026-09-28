// Local filesystem only. No database access or migration execution.
import {readFileSync,existsSync,renameSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../supabase/migrations/',import.meta.url);
const mappings=[
  {
    "old": "20260916_order_operations.sql",
    "new": "20260917085405_order_operations.sql",
    "sha256": "a6386fafd1b2bab1cb3699c8e8fb2fe5c8bc7f831166a47b52d5cc9427aafb53"
  },
  {
    "old": "20260917_security_hardening.sql",
    "new": "20260917085433_security_hardening.sql",
    "sha256": "ac12e55f12c72b4eac14f4df2b06cd3a674591587b0fdf29bb0d12511f3da101"
  }
];
const hash=p=>createHash('sha256').update(readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex');
// Validate all files before changing any filenames.
for(const m of mappings){
 const old=new URL(m.old,root), next=new URL(m.new,root);
 if(!existsSync(old)&&!existsSync(next))throw new Error('Missing migration: '+m.old);
 for(const p of [old,next])if(existsSync(p)&&hash(p)!==m.sha256)throw new Error('File differs; stop for review: '+p.pathname);
}
for(const m of mappings){
 const old=new URL(m.old,root),next=new URL(m.new,root);
 if(existsSync(old)){if(existsSync(next))unlinkSync(old);else renameSync(old,next);}
 console.log('PASS local migration filename: '+m.new);
}
console.log('Local filenames reconciled. No database changes.');
