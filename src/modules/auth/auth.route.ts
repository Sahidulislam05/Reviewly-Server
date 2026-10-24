import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authLimiter } from "../../middlewares/rateLimiters";
import { validate } from "../../middlewares/validate";
import * as auth from "./auth.controller";
import { loginSchema, signupSchema } from "./auth.schema";

export const authRouter = Router();

authRouter.post("/signup", authLimiter, validate(signupSchema), auth.signup);
authRouter.post("/login", authLimiter, validate(loginSchema), auth.login);
authRouter.post("/logout", auth.logout);
authRouter.get("/me", authenticate, auth.me);
