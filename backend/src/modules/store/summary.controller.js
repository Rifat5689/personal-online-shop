import Order from '../order/order.model.js';
import Product from '../product/product.model.js';
import {asyncHandler} from '../../utils/asyncHandler.js';
import {ApiResponse} from '../../utils/ApiResponse.js';
const netRevenue={$max:[0,{$subtract:['$totalPrice',{$ifNull:['$refundedAmount',0]}]}]};
const paid=['paid','partially_refunded','refunded'];
export const getSummary=asyncHandler(async(req,res)=>{
 const days=req.query.days==='7'?7:30;
 const scope={tenantId:req.store._id};const orders={...scope,resetId:null};
 const[totalOrders,pendingOrders,products,lowStockProducts,revenue,customers,recentOrders,daily]=await Promise.all([
  Order.countDocuments(orders),Order.countDocuments({...orders,status:'pending'}),Product.countDocuments({...scope,deletedAt:null}),Product.countDocuments({...scope,deletedAt:null,isActive:true,stock:{$lt:10}}),
  Order.aggregate([{$match:{...orders,'payment.paymentStatus':{$in:paid},status:{$nin:['cancelled','returned']}}},{$group:{_id:null,total:{$sum:netRevenue}}}]),
  Order.aggregate([{$match:orders},{$group:{_id:'$shippingDetails.phone'}},{$count:'total'}]),
  Order.find(orders).select('-idempotencyKey -requestHash').sort({createdAt:-1}).limit(5),
  Order.aggregate([{$match:{...orders,createdAt:{$gte:new Date(Date.now()-days*86400000)}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt',timezone:'Asia/Dhaka'}},orders:{$sum:1},revenue:{$sum:{$cond:[{$and:[{$in:['$payment.paymentStatus',paid]},{$not:[{$in:['$status',['cancelled','returned']]}]}]},netRevenue,0]}}}},{$sort:{_id:1}}]),
 ]);
 res.json(new ApiResponse(200,{totalOrders,pendingOrders,products,lowStockProducts,totalRevenue:revenue[0]?.total||0,totalCustomers:customers[0]?.total||0,totalViews:req.store.totalViews||0,analyticsAllowed:true,recentOrders,daily,days},'Dashboard fetched'));
});
