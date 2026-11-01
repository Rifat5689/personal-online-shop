// Compatibility helpers used by the original merchant UI and live analytics.
// The standalone shop has no SaaS billing or platform permission dependency.
import Store from '../store/store.model.js';
export const subscriptionConfig=async()=>({});
export const billingStore=async store=>store;
export const entitlement=()=>({plan:'PRO',expired:false,analyticsAllowed:true,themeAllowed:true,status:'ACTIVE',walletPaisa:0});
export async function analyticsAllowedFor(tenantId,user){
 if(user&&String(user.tenantId)!==String(tenantId))return false;
 return !!await Store.exists({_id:tenantId,slug:process.env.STORE_SLUG||'originsofbeauty',status:'ACTIVE'});
}
export const themeAllowedFor=async()=>true;
export const visibleMerchantData=async(_req,value)=>value;
