import {spawnSync} from 'node:child_process';
import mongoose from 'mongoose';
const r=spawnSync('az.cmd',['webapp','config','appsettings','list','-g','encrypts_group','-n','test-originsofbeauty','-o','json'],{encoding:'utf8',shell:true,windowsHide:true});
if(r.status!==0)throw Error('Cannot read test configuration');
const uri=JSON.parse(r.stdout).find(s=>s.name==='MONGODB_URI').value;
await mongoose.connect(uri);
try{
 if(mongoose.connection.name!=='personalshop_originsofbeauty_test')throw Error('Demo seeding is test-only');
 const db=mongoose.connection.db;
 // Remove copied SaaS billing records from this new isolated database only.
 for(const name of ['subscriptionrecharges','subscriptionwalletentries','subscriptionaudits'])if((await db.listCollections({name}).toArray()).length)await db.collection(name).drop();
 const store=await db.collection('stores').findOne({slug:'originsofbeauty'});
 const products=await db.collection('products').find({tenantId:store._id,isActive:true,deletedAt:null}).toArray();
 if(!products.length)throw Error('Copy the original catalog before adding demo products');
 const total=Math.max(0,50-products.length);
 for(let i=0;i<total;i++){
  const original=products[i%products.length];
  const {_id,...copy}=original;
  await db.collection('products').insertOne({...copy,_id:new mongoose.Types.ObjectId(),name:`Demo ${i+1} · ${original.name}`,title:`Demo ${i+1} · ${original.name}`,slug:`personalshop-demo-${i+1}`,stock:25,totalSold:0,totalViews:0,demoOnly:true,createdAt:new Date('2025-01-01'),updatedAt:new Date()});
 }
 console.log(`Test catalog: ${products.length} original active products + ${total} demo products = ${products.length+total}.`);
}finally{await mongoose.disconnect();}
