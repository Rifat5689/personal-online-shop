import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
function az(args){const r=spawnSync('az.cmd',args,{encoding:'utf8',shell:true,windowsHide:true});if(r.status!==0)throw Error('Azure operation failed: '+args.slice(0,3).join(' '));return r.stdout.trim()?JSON.parse(r.stdout):null;}
const read=app=>Object.fromEntries(az(['webapp','config','appsettings','list','-g','encrypts_group','-n',app,'-o','json']).map(s=>[s.name,s.value]));
const production=read('originsofbeauty'),testing=read('test-originsofbeauty');
const parse=uri=>{const match=uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/]+)\/([^?]*)/);if(!match)throw Error('Invalid database configuration');return{hosts:match[1],database:match[2]};};
const source=parse(production.MONGODB_URI),target=parse(testing.MONGODB_URI);
if(source.database!=='personalshop_originsofbeauty'||target.database!=='personalshop_originsofbeauty_test'||source.hosts!==target.hosts)throw Error('Expected two separate databases in the same designated cluster');
for(const[app,settings]of [['originsofbeauty',{DATABASE_ROLE:'primary',DB_MIRROR_ENABLED:'true',MONGODB_MIRROR_URI:testing.MONGODB_URI}],['test-originsofbeauty',{DATABASE_ROLE:'test',DB_MIRROR_ENABLED:'false',MONGODB_MIRROR_URI:''}]]){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'personalshop-db-'));const file=path.join(folder,'settings.json');
 try{fs.writeFileSync(file,JSON.stringify(settings));az(['webapp','config','appsettings','set','-g','encrypts_group','-n',app,'--settings','@'+file,'-o','none']);}finally{fs.unlinkSync(file);fs.rmdirSync(folder);}
 console.log(`Configured ${app}: ${settings.DATABASE_ROLE}; replication ${settings.DB_MIRROR_ENABLED==='true'?'production to test':'disabled'}.`);
}
