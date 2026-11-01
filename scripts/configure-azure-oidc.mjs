import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const repo='Rifat5689/personal-online-shop';
function command(binary,args){const r=spawnSync(binary,args,{encoding:'utf8',shell:true,windowsHide:true});if(r.status!==0)throw Error('Command failed: '+args.slice(0,3).join(' ')+' '+r.stderr);return r.stdout.trim()?JSON.parse(r.stdout):null;}
const az=args=>command('az.cmd',[...args,'-o','json']);
const account=az(['account','show']);
const name='personalshop-github-deploy';
const matches=az(['ad','app','list','--display-name',name]);
if(matches.length>1)throw Error('Ambiguous deployment application name');
const app=matches[0]||az(['ad','app','create','--display-name',name,'--sign-in-audience','AzureADMyOrg']);
let principal=az(['ad','sp','list','--filter',`"appId eq '${app.appId}'"`])[0];
if(!principal)principal=az(['ad','sp','create','--id',app.appId]);
const existing=az(['ad','app','federated-credential','list','--id',app.id]);
const repository=command('gh.exe',['api',`repos/${repo}`]);
const immutableRepo=`${repository.owner.login}@${repository.owner.id}/${repository.name}@${repository.id}`;
for(const environment of ['testing','production']){
 const subject=`repo:${immutableRepo}:environment:${environment}`;
 if(existing.some(c=>c.subject===subject&&c.issuer==='https://token.actions.githubusercontent.com'))continue;
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'personalshop-oidc-'));const file=path.join(folder,'credential.json');
 try{fs.writeFileSync(file,JSON.stringify({name:`github-${environment}`,issuer:'https://token.actions.githubusercontent.com',subject,audiences:['api://AzureADTokenExchange']}));const previous=existing.find(c=>c.name===`github-${environment}`);az(['ad','app','federated-credential',previous?'update':'create','--id',app.id,...(previous?['--federated-credential-id',previous.id]:[]),'--parameters','@'+file]);}finally{fs.unlinkSync(file);fs.rmdirSync(folder);}
}
for(const name of ['test-originsofbeauty','originsofbeauty']){
 const scope=`/subscriptions/${account.id}/resourceGroups/encrypts_group/providers/Microsoft.Web/sites/${name}`;
 az(['role','assignment','create','--assignee-object-id',principal.id,'--assignee-principal-type','ServicePrincipal','--role','"Website Contributor"','--scope',scope]);
 console.log(`Deployment permission granted only on ${name}.`);
}
for(const[name,value]of Object.entries({AZURE_CLIENT_ID:app.appId,AZURE_TENANT_ID:account.tenantId,AZURE_SUBSCRIPTION_ID:account.id})){
 const r=spawnSync('gh.exe',['variable','set',name,'--body',value,'--repo',repo],{encoding:'utf8',shell:true,windowsHide:true});if(r.status!==0)throw Error('Cannot set GitHub variable '+name);
}
console.log('Configured Azure OIDC without creating a client secret.');
