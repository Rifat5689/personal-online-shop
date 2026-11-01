import { Router } from "express";
import {
  createOrder,
  getOrder,
  getAllOrders,
  getAdminOrder,
  updateOrder,
  getCustomers,
} from "./order.controller.js";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import {
  requireRoles,
  requireTenant,
  resolveStore,
} from "../../middlewares/tenant.middleware.js";
import { recordRefund } from "./refund.controller.js";
const orderRouter = Router();
orderRouter.route("/store/:storeSlug").post(resolveStore, createOrder);
orderRouter.route("/store/:storeSlug/:id").get(resolveStore, getOrder);
orderRouter.use(verifyJwt, requireRoles("ADMIN", "ECO", "SUPER_ADMIN"));
orderRouter
  .route("/")
  .get(
    (req, res, next) =>
      req.user.role === "SUPER_ADMIN" ? next() : requireTenant(req, res, next),
    getAllOrders,
  );
orderRouter.post("/:id/refund", requireTenant, recordRefund);
orderRouter.route("/customers").get(requireTenant, getCustomers);
orderRouter
  .route("/:id")
  .get(requireTenant, getAdminOrder)
  .patch(requireTenant, updateOrder);
export { orderRouter };
