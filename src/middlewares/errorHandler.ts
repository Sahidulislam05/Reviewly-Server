import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

// Never leak stack traces or database errors to the client.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, errors: err.errors });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, message: "Malformed JSON body" });
  }
  console.error(err);
  res.status(500).json({ success: false, message: "Something went wrong, please try again later" });
}
