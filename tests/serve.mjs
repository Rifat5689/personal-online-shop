import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('store/dist');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.woff2':'font/woff2'};
http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
 if(file===root)file=path.join(root,'index.html');
 if(!fs.existsSync(file))file+='.html';
 if(!fs.existsSync(file)&&!path.extname(new URL(req.url,'http://localhost').pathname))file=path.join(root,'index.html');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
}).listen(3001,()=>console.log('Static storefront on http://localhost:3001'));
