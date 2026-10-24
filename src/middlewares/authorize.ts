import type { NextFunction, Request, Response } from "express";
import type { Role } from "../generated/prisma/client";
import { ApiError } from "../utils/ApiError";

// AuthZ: "what are you allowed to do?" Runs after authenticate.
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) return next(new ApiError(403, "You do not have access to this resource"));
    next();
  };
