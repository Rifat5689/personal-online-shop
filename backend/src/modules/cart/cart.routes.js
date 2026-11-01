import { Router } from "express";
import { verifyJwt } from "../../middlewares/auth.middleware.js";

const cartRouter = Router();

// Storefront carts are persisted per tenant in the client. Legacy unscoped carts
// must not expose data until a tenant migration is explicitly configured.
cartRouter.use(verifyJwt);
cartRouter.route("/").all((req, res) =>
  res.status(410).json({
    success: false,
    statusCode: 410,
    message: "Use the store-specific storefront cart",
    errors: [],
  }),
);
export { cartRouter };
