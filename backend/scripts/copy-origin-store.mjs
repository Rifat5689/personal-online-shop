import {spawnSync} from 'node:child_process';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {BlobServiceClient,StorageSharedKeyCredential} from '@azure/storage-blob';
import {DefaultAzureCredential} from '@azure/identity';
const targetName=process.argv[2]||'test-originsofbeauty';
if(!['test-originsofbeauty','originsofbeauty'].includes(targetName))throw Error('Unexpected target app');
const az=args=>{const r=spawnSync('az.cmd',args,{encoding:'utf8',shell:true,windowsHide:true});if(r.status!==0)throw Error('Azure configuration read failed');return JSON.parse(r.stdout);};
const config=app=>Object.fromEntries(az(['webapp','config','appsettings','list','-g','encrypts_group','-n',app,'-o','json']).map(s=>[s.name,s.value]));
const sourceConfig=config('myshop'),targetConfig=config(targetName);
const source=await mongoose.createConnection(sourceConfig.MONGODB_URI,{serverSelectionTimeoutMS:20000}).asPromise();
const target=await mongoose.createConnection(targetConfig.MONGODB_URI,{serverSelectionTimeoutMS:20000}).asPromise();
try{
 if(source.host===target.host&&source.name===target.name)throw Error('Source and destination must differ');
 if(!target.name.startsWith('personalshop_originsofbeauty'))throw Error('Refusing a non-personalshop database');
 if((await target.db.listCollections().toArray()).length)throw Error('Target database must be empty; migration never overwrites existing data');
 const store=await source.db.collection('stores').findOne({slug:'originsofbeauty'});
 if(!store)throw Error('Original store not found');
 const account=targetConfig.AZURE_STORAGE_ACCOUNT_NAME;
 const keys=az(['storage','account','keys','list','-g','encrypts_group','-n',account,'-o','json']);
 const storage=new BlobServiceClient(`https://${account}.blob.core.windows.net`,new StorageSharedKeyCredential(account,keys[0].value));
 const container=storage.getContainerClient(targetConfig.AZURE_STORAGE_CONTAINER);
 await container.createIfNotExists({access:'blob'});
 const copied=new Map();
 async function cloneImages(value){
  if(!value||typeof value!=='object'||value instanceof mongoose.Types.ObjectId||value instanceof Date)return;
  if(typeof value.url==='string'&&value.url.includes('.blob.core.windows.net/')){
   const original=value.url;
   if(!copied.has(original)){
    const old=new URL(original);const key=decodeURIComponent(old.pathname.split('/').slice(2).join('/'));
    const response=await fetch(original,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Source image is unavailable');
    const blob=container.getBlockBlobClient(key);await blob.uploadData(Buffer.from(await response.arrayBuffer()),{blobHTTPHeaders:{blobContentType:response.headers.get('content-type')||'image/jpeg',blobCacheControl:'public, max-age=31536000, immutable'}});
    copied.set(original,{url:blob.url,public_id:key});
   }
   Object.assign(value,copied.get(original));
  }
  for(const child of Object.values(value))await cloneImages(child);
 }
 store.managedDemo=false;store.analyticsAccess='allow';store.themeAccess='allow';
 await cloneImages(store);await target.db.collection('stores').insertOne(store);
 const skipped=new Set(['stores','users','platforms','walletentries','recharges','billingaudits']);
 const counts={};
 for(const {name}of await source.db.listCollections().toArray()){
  if(skipped.has(name)||name.startsWith('subscription'))continue;
  const records=await source.db.collection(name).find({tenantId:store._id}).toArray();
  if(!records.length)continue;
  for(const record of records)await cloneImages(record);
  await target.db.collection(name).insertMany(records);counts[name]=records.length;
 }
 const oldAdmin=await source.db.collection('users').findOne({username:'origins',tenantId:store._id});
 const password=await bcrypt.hash('123456',10);
 await target.db.collection('users').insertOne({_id:oldAdmin?._id||new mongoose.Types.ObjectId(),username:'origins',email:oldAdmin?.email||'origins@personalshop.invalid',password,role:'ADMIN',tenantId:store._id,isActive:true,refreshToken:null,analyticsAccess:'allow',themeAccess:'allow',createdAt:new Date(),updatedAt:new Date()});
 if(targetName==='test-originsofbeauty')await target.db.collection('users').insertOne({username:'demouser',email:'demo@personalshop.invalid',password,role:'ADMIN',tenantId:store._id,isActive:true,refreshToken:null,analyticsAccess:'allow',themeAccess:'allow',createdAt:new Date(),updatedAt:new Date()});
 // Replicate data indexes, without platform-wide collections or ownership records.
 for(const name of ['stores','users',...Object.keys(counts)]){
  for(const index of await source.db.collection(name).indexes()){
   if(index.name==='_id_')continue;
   const {key,name:indexName,unique,sparse,partialFilterExpression,expireAfterSeconds}=index;
   await target.db.collection(name).createIndex(key,{name:indexName,...(unique?{unique}:{}),...(sparse?{sparse}:{}),...(partialFilterExpression?{partialFilterExpression}:{}),...(expireAfterSeconds!==undefined?{expireAfterSeconds}:{})});
  }
 }
 console.log(JSON.stringify({target:target.name,store:store.slug,counts,imagesCopied:copied.size}));
}finally{await source.close();await target.close();}
