import {createRequire} from 'node:module';
const require=createRequire('C:/Users/Rifat/AppData/Roaming/npm/node_modules/firebase-tools/package.json');
const auth=require('./lib/auth.js');
const account=auth.getGlobalDefaultAccount();
if(!account)throw Error('Firebase CLI login required');
const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
async function request(url,method='GET',body){const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(`${r.status}: ${data.error?.message}`);return data;}
if(process.argv[2]==='billing'){
 const billing=await request('https://cloudbilling.googleapis.com/v1/billingAccounts');
 console.log(JSON.stringify(billing.billingAccounts?.map(a=>({name:a.name,displayName:a.displayName,open:a.open}))||[]));
 for(const project of ['personalshop-test','personalshop','test-ownshop'])console.log(JSON.stringify({project,...await request(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`)}));
}
if(process.argv[2]==='link-billing'){
 const billing=(await request('https://cloudbilling.googleapis.com/v1/projects/test-ownshop/billingInfo')).billingAccountName;
 if(!billing)throw Error('Existing test project has no billing account');
 for(const project of ['personalshop-test','personalshop']){
  await request(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`,'PUT',{billingAccountName:billing});
  console.log(`Linked ${project} to the existing billing account.`);
 }
}
if(process.argv[2]==='configure-ci'){
 for(const[project,number]of [['personalshop-test','966768856635'],['personalshop','520568253705']]){
  for(const api of ['iam.googleapis.com','iamcredentials.googleapis.com','sts.googleapis.com','firebasehosting.googleapis.com'])await request(`https://serviceusage.googleapis.com/v1/projects/${number}/services/${api}:enable`,'POST',{});
  const serviceAccount=`personalshop-deploy@${project}.iam.gserviceaccount.com`;
  try{await request(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,'POST',{accountId:'personalshop-deploy',serviceAccount:{displayName:'Personalshop GitHub deployment'}});}catch(e){if(!e.message.startsWith('409:'))throw e;}
  const pool=`projects/${number}/locations/global/workloadIdentityPools/github`;
  try{await request(`https://iam.googleapis.com/v1/projects/${number}/locations/global/workloadIdentityPools?workloadIdentityPoolId=github`,'POST',{displayName:'GitHub Actions'});}catch(e){if(!e.message.startsWith('409:'))throw e;}
  try{await request(`https://iam.googleapis.com/v1/${pool}/providers?workloadIdentityPoolProviderId=personalshop`,'POST',{displayName:'Personalshop repository',oidc:{issuerUri:'https://token.actions.githubusercontent.com'},attributeMapping:{'google.subject':'assertion.sub','attribute.repository':'assertion.repository'},attributeCondition:"assertion.repository == 'Rifat5689/personal-online-shop'"});}catch(e){if(!e.message.startsWith('409:'))throw e;}
  const resource=`https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const policy=await request(resource+':getIamPolicy','POST',{});
  for(const role of ['roles/firebasehosting.admin','roles/firebase.viewer','roles/serviceusage.serviceUsageConsumer']){
   const member=`serviceAccount:${serviceAccount}`;const binding=policy.bindings.find(b=>b.role===role);
   if(binding){if(!binding.members.includes(member))binding.members.push(member);}else policy.bindings.push({role,members:[member]});
  }
  await request(resource+':setIamPolicy','POST',{policy});
  await request(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${serviceAccount}:setIamPolicy`,'POST',{policy:{bindings:[{role:'roles/iam.workloadIdentityUser',members:[`principalSet://iam.googleapis.com/${pool}/attribute.repository/Rifat5689/personal-online-shop`]}]}});
  console.log(`Configured ${project} keyless deployment: ${pool}/providers/personalshop`);
 }
}
