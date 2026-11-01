import { Router } from "express";
import {
  getSignedCustomers,
  signInCustomer,
  loginCustomer,
  registerCustomer,
} from "./customer.controller.js";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import {
  requireRoles,
  requireTenant,
  resolveStore,
} from "../../middlewares/tenant.middleware.js";

const customerRouter = Router();
customerRouter.route("/store/:storeSlug").post(resolveStore, signInCustomer);
customerRouter.route("/store/:storeSlug/signin").post(resolveStore, loginCustomer);
customerRouter.route("/store/:storeSlug/login").post(resolveStore, loginCustomer);
customerRouter.route("/store/:storeSlug/signup").post(resolveStore, registerCustomer);
customerRouter.route("/store/:storeSlug/register").post(resolveStore, registerCustomer);
customerRouter
  .route("/signed")
  .get(
    verifyJwt,
    requireRoles("ADMIN", "ECO"),
    requireTenant,
    getSignedCustomers,
  );

export { customerRouter };

