import type { Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// shortcut: in-memory store resets on restart and is per-instance; use a Redis store when running more than one instance.
const limiter = (windowMinutes: number, limit: number, keyGenerator?: (req: Request) => string) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message: `Too many attempts, please try again in ${windowMinutes} minutes`,
      });
    },
  });

export const globalLimiter = limiter(1, 100);
export const authLimiter = limiter(15, 10);
export const submissionLimiter = limiter(10, 5, (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? ""));
