import {test} from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.TEST_API_URL||'http://localhost:5000/api/v1';
test('deleting a populated category keeps its products and makes category optional',async()=>{
 const session=(await(await fetch(base+'/users/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'demouser',password:'123456'})})).json()).data;
 const headers={Authorization:`Bearer ${session.accessToken}`,'Content-Type':'application/json'};
 const call=(path,method='GET',body)=>fetch(base+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 const category=(await(await call('/categories','POST',{name:'QA category '+randomUUID()})).json()).data;
 const created=[];
 try{
  for(const selection of [category._id,category._id,'',null,undefined]){
   const response=await call('/products','POST',{name:'QA temporary product '+randomUUID(),price:12,stock:2,isActive:false,category:selection});
   assert.equal(response.status,201);const product=(await response.json()).data;created.push(product);
   assert.equal(product.category,selection||null);
  }
  const deleted=await call('/categories/'+category._id,'DELETE');assert.equal(deleted.status,200);
  assert.equal((await deleted.json()).data.updatedProducts,2);
  for(const product of created){const current=(await(await call('/products/'+product._id)).json()).data;assert.equal(current._id,product._id);assert.equal(current.category,null);assert.equal(current.stock,2);}
  const invalid=await call('/products/'+created[0]._id,'PATCH',{category:category._id});assert.equal(invalid.status,400);
  const edited=await call('/products/'+created[0]._id,'PATCH',{category:''});assert.equal(edited.status,200);assert.equal((await edited.json()).data.category,null);
  assert.equal((await call('/categories/'+category._id,'DELETE')).status,404);
 }finally{
  for(const product of created)await call('/products/'+product._id,'DELETE');
  await call('/categories/'+category._id,'DELETE');
 }
});
test('public API isolates the store and rejects platform and admin management',async()=>{
 for(const route of ['/products/store/other-shop','/stores/slug/other-shop','/platform','/subscriptions','/users/admins','/stores/public'])assert.equal((await fetch(base+route)).status,404,route);
 assert.equal((await fetch(base+'/products')).status,401);
});
test('merchant product CRUD and idempotent checkout preserve stock and tracking privacy',async()=>{
 const login=await(await fetch(base+'/users/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'demouser',password:'123456'})})).json();
 const headers={Authorization:`Bearer ${login.data.accessToken}`,'Content-Type':'application/json'};
 const create=await fetch(base+'/products',{method:'POST',headers,body:JSON.stringify({name:'QA temporary product '+randomUUID(),price:100,stock:3,isActive:true})});
 assert.equal(create.status,201);const product=(await create.json()).data;
 let order;
 try{
  const payload={orderItems:[{productId:product._id,quantity:1}],shippingDetails:{name:'QA Test',phone:'01700000000',address:'Test address, Dhaka'},shippingZone:'insideDhaka'};
  const checkoutHeaders={'Content-Type':'application/json','Idempotency-Key':randomUUID()};
  const checkout=()=>fetch(base+'/orders/store/originsofbeauty',{method:'POST',headers:checkoutHeaders,body:JSON.stringify(payload)});
  const response=await checkout();assert.equal(response.status,201);order=(await response.json()).data;
  assert.equal((await(await checkout()).json()).data._id,order._id);
  const current=(await(await fetch(base+'/products/'+product._id,{headers})).json()).data;assert.equal(current.stock,2);
  assert.equal((await fetch(base+'/orders/store/originsofbeauty/'+order._id)).status,401);
  assert.equal((await fetch(base+'/orders/store/originsofbeauty/'+order._id,{headers:{'X-Tracking-Token':order.trackingToken}})).status,200);
 }finally{
  if(order){assert.equal((await fetch(base+'/orders/'+order._id,{method:'PATCH',headers,body:JSON.stringify({status:'cancelled'})})).status,200);}
  const current=(await(await fetch(base+'/products/'+product._id,{headers})).json()).data;assert.equal(current.stock,3);
  assert.equal((await fetch(base+'/products/'+product._id,{method:'DELETE',headers})).status,200);
 }
});
test('original owner can log in; admin data and products belong to the one store',async()=>{
 const response=await fetch(base+'/users/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'origins',password:'123456'})});
 assert.equal(response.status,200);const login=(await response.json()).data;
 const headers={Authorization:`Bearer ${login.accessToken}`};
 const me=(await(await fetch(base+'/users/me',{headers})).json()).data;
 assert.equal(me.store.slug,'originsofbeauty');assert.equal(me.username,'origins');
 const summary=await fetch(base+'/stores/summary',{headers});assert.equal(summary.status,200);assert.ok(Number.isInteger((await summary.json()).data.totalOrders));
 for(const endpoint of ['/categories','/orders','/customers/signed','/orders/customers','/analytics'])assert.equal((await fetch(base+endpoint,{headers})).status,200,endpoint);
 const products=(await(await fetch(base+'/products',{headers})).json()).data;
 assert.ok(products.length>=50);assert.ok(products.every(p=>p.tenantId===me.store._id));
 assert.equal((await fetch(base+'/products',{headers:{...headers,'X-Admin-Id':me._id}})).status,404);
});
test('Azure managed identity accepts an image upload in the isolated test container',{skip:!process.env.TEST_UPLOAD},async()=>{
 const login=(await(await fetch(base+'/users/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'demouser',password:'123456'})})).json()).data;
 const form=new FormData();form.append('images',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'qa.png');
 const response=await fetch(base+'/products/images',{method:'POST',headers:{Authorization:`Bearer ${login.accessToken}`},body:form});
 assert.equal(response.status,201);const images=(await response.json()).data;
 assert.ok(images[0].url.includes('/personalshop-test/'));
 assert.equal((await fetch(images[0].url)).status,200);
});
