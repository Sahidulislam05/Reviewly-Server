import type { CookieOptions, Request, Response } from "express";
import { isProduction } from "../../config/env";
import { AUTH_COOKIE } from "../../middlewares/authenticate";
import { sendResponse } from "../../utils/sendResponse";
import * as authService from "./auth.service";

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript (and XSS) cannot read the token
  secure: isProduction,
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

export async function signup(req: Request, res: Response) {
  const user = await authService.signup(req.body);
  res.cookie(AUTH_COOKIE, authService.signToken(user), cookieOptions);
  sendResponse(res, { statusCode: 201, message: "Account created", data: user });
}

export async function login(req: Request, res: Response) {
  const user = await authService.login(req.body);
  res.cookie(AUTH_COOKIE, authService.signToken(user), cookieOptions);
  sendResponse(res, { message: "Logged in", data: user });
}

export function logout(_req: Request, res: Response) {
  const { maxAge: _, ...clearOptions } = cookieOptions;
  res.clearCookie(AUTH_COOKIE, clearOptions);
  sendResponse(res, { message: "Logged out" });
}

export async function me(req: Request, res: Response) {
  sendResponse(res, { message: "Current user", data: await authService.getMe(req.user!.id) });
}
