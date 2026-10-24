import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../generated/prisma/client";
import { ApiError } from "../utils/ApiError";

export const AUTH_COOKIE = "token";

export type AuthUser = { id: string; role: Role };
export type JwtPayload = { sub: string; role: Role };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// AuthN: "who are you?" Verifies the JWT cookie and trusts the role only after the signature checks out.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE];
  if (!token) return next(new ApiError(401, "Authentication required"));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, "Session expired or invalid, please log in again"));
  }
}
