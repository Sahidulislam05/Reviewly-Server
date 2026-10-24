import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { globalLimiter } from "./middlewares/rateLimiters";
import { authRouter } from "./modules/auth/auth.route";
import { submissionRouter } from "./modules/submission/submission.route";

export const app = express();

app.set("trust proxy", 1); // the Next.js proxy forwards the real client IP
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(globalLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "OK" });
});
app.use("/api/auth", authRouter);
app.use("/api/submissions", submissionRouter);

app.use(notFound);
app.use(errorHandler);
