import {spawnSync,spawn} from 'node:child_process';
const result=spawnSync('az.cmd',['webapp','config','appsettings','list','-g','encrypts_group','-n','test-originsofbeauty','-o','json'],{encoding:'utf8',shell:true,windowsHide:true});
if(result.status!==0)throw Error('Cannot read test configuration');
const config=Object.fromEntries(JSON.parse(result.stdout).map(s=>[s.name,s.value]));
const child=spawn(process.execPath,['server.js'],{cwd:'backend',stdio:'inherit',env:{...process.env,...config,NODE_ENV:'development',PORT:'5000',CORS_ORIGIN:'http://localhost:3001'}});
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());child.on('exit',code=>process.exit(code||0));
