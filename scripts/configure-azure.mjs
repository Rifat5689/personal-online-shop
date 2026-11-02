import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const az=(args)=>{const r=spawnSync('az.cmd',args,{encoding:'utf8',shell:true,windowsHide:true});if(r.status!==0)throw Error('Azure command failed: '+args.slice(0,3).join(' '));return r.stdout.trim()?JSON.parse(r.stdout):null;};
// Read one JSON document from stdin; secrets never appear in source or output.
console.log('Ready for database credential JSON on stdin.');
let input='';for await(const chunk of process.stdin){input+=chunk;if(input.includes('\n'))break;}
const credential=JSON.parse(input);
const source=az(['webapp','config','appsettings','list','-g','encrypts_group','-n','myshop','-o','json']);
const value=name=>source.find(s=>s.name===name)?.value;
const settings={NODE_ENV:'production',STORE_SLUG:'originsofbeauty',DATABASE_ROLE:'standalone',DB_MIRROR_ENABLED:'false',ACCESS_TOKEN_VALIDITY:'15m',REFRESH_TOKEN_VALIDITY:'7d',SCM_DO_BUILD_DURING_DEPLOYMENT:'false',WEBSITES_CONTAINER_START_TIME_LIMIT:'1800',AZURE_STORAGE_ACCOUNT_NAME:value('AZURE_STORAGE_ACCOUNT_NAME')};
for(const [app,db,container,site] of [['test-originsofbeauty','personalshop_originsofbeauty_test','personalshop-test','test-originsofbeauty'],['originsofbeauty','personalshop_originsofbeauty','personalshop-production','originsofbeauty']]){
 const uri=`mongodb://${encodeURIComponent(credential.username)}:${encodeURIComponent(credential.password)}@ac-qq6u3ih-shard-00-00.g6jmw0b.mongodb.net:27017,ac-qq6u3ih-shard-00-01.g6jmw0b.mongodb.net:27017,ac-qq6u3ih-shard-00-02.g6jmw0b.mongodb.net:27017/${db}?ssl=true&replicaSet=atlas-1004fb-shard-0&authSource=admin`;
 const config={...settings,MONGODB_URI:uri,ACCESS_TOKEN_SECRET:randomBytes(48).toString('hex'),REFRESH_TOKEN_SECRET:randomBytes(48).toString('hex'),AZURE_STORAGE_CONTAINER:container,CORS_ORIGIN:`https://${site}.web.app,http://localhost:3001`};
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'personalshop-settings-'));const file=path.join(folder,'settings.json');
 try{fs.writeFileSync(file,JSON.stringify(config));az(['webapp','config','appsettings','set','-g','encrypts_group','-n',app,'--settings','@'+file,'-o','none']);}finally{fs.unlinkSync(file);fs.rmdirSync(folder);}
 const identity=az(['webapp','identity','assign','-g','encrypts_group','-n',app,'-o','json']);
 const account=az(['storage','account','show','-g','encrypts_group','-n',settings.AZURE_STORAGE_ACCOUNT_NAME,'--query','id','-o','json']);
 az(['role','assignment','create','--assignee-object-id',identity.principalId,'--assignee-principal-type','ServicePrincipal','--role','"Storage Blob Data Contributor"','--scope',account,'-o','none']);
 console.log(`Configured ${app}, isolated database ${db}, storage ${container}.`);
}
