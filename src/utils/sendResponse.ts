import type { Response } from "express";

type Meta = { page: number; pageSize: number; totalItems: number; totalPages: number };

export function sendResponse<T>(
  res: Response,
  { statusCode = 200, message, data, meta }: { statusCode?: number; message: string; data?: T; meta?: Meta },
) {
  res.status(statusCode).json({ success: true, message, data, meta });
}
