import {spawnSync} from 'node:child_process';
const repo='Rifat5689/personal-online-shop';
function command(binary,args,input){const r=spawnSync(binary,args,{input,encoding:'utf8',shell:true,windowsHide:true});if(r.status!==0)throw Error('Command failed: '+args.slice(0,3).join(' '));return r.stdout;}
for(const[app,secret]of [['test-originsofbeauty','AZURE_PROFILE_TEST'],['originsofbeauty','AZURE_PROFILE_PRODUCTION']]){
 const profile=command('az.cmd',['webapp','deployment','list-publishing-profiles','-g','encrypts_group','-n',app,'--xml']);
 command('gh.exe',['secret','set',secret,'--repo',repo],profile);
 console.log(`Saved ${secret} directly to GitHub Actions secrets.`);
}
