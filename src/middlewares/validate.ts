import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/ApiError";

type Source = "body" | "query" | "params";

// Parses req[source] with the schema; unknown fields are stripped, so e.g. `role` can never sneak in.
export const validate =
  (schema: ZodType, source: Source = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return next(new ApiError(422, "Validation failed", errors));
    }
    // Express 5 exposes req.query as a getter, so redefine instead of assigning.
    Object.defineProperty(req, source, { value: result.data, writable: true, enumerable: true });
    next();
  };
