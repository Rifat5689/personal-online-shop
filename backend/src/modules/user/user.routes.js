import { Router } from "express";
import { logIn, logOut, refreshToken, register } from "./user.controller.js";
import { verifyJwt } from "../../middlewares/auth.middleware.js";
import { requireRoles } from "../../middlewares/tenant.middleware.js";
import {
  getAdminDetails,
  me,
  getAdmins,
  createAdmin,
  updateAdmin,
} from "./admin.controller.js";

const userRouter = Router();
userRouter.route("/me").get(verifyJwt, me);
userRouter.route("/auth/login").post(logIn);
userRouter.route("/auth/logout").post(verifyJwt, logOut);
userRouter.route("/auth/refreshtoken").post(refreshToken);

export { userRouter };
