import mongoose from '../backend/node_modules/mongoose/index.js';
let input='';for await(const chunk of process.stdin) input+=chunk;
const parsed=JSON.parse(input),settings=Array.isArray(parsed)?parsed:parsed.value;
const value=name=>settings.find(s=>s.name===name)?.value;
const db=await mongoose.createConnection(value('MONGODB_URI'),{serverSelectionTimeoutMS:10000}).asPromise();
try{
 const store=await db.db.collection('stores').findOne({slug:'originsofbeauty'},{projection:{_id:1}});
 const ai=await db.db.collection('whatsappaisettings').aggregate([{$match:{store:store._id}},{$project:{_id:0,enabled:1,model:1,connectionState:1,instructionsLength:{$strLenCP:{$ifNull:['$instructions','']}},keyConfigured:{$ne:[{$ifNull:['$encryptedKey','']},'']}}}]).toArray();
 console.log(JSON.stringify(ai));
 const jobs=await db.db.collection('whatsappaijobs').find({store:store._id},{projection:{status:1,createdAt:1,updatedAt:1,inbound:1,error:1}}).sort({createdAt:-1}).limit(5).toArray();
 for(const job of jobs)console.log(JSON.stringify({status:job.status,error:job.error,createdAt:job.createdAt,durationMs:new Date(job.updatedAt)-new Date(job.createdAt),outboundCount:await db.db.collection('whatsappmessages').countDocuments({aiReplyTo:job.inbound})}));
}finally{await db.close()}
