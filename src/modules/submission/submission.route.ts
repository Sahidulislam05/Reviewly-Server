import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { submissionLimiter } from "../../middlewares/rateLimiters";
import { validate } from "../../middlewares/validate";
import * as submission from "./submission.controller";
import { createSubmissionSchema, idParamSchema, listQuerySchema, reviewSchema } from "./submission.schema";

export const submissionRouter = Router();

submissionRouter.use(authenticate);

// Student
submissionRouter.post(
  "/",
  authorize("STUDENT"),
  submissionLimiter,
  validate(createSubmissionSchema),
  submission.create,
);
submissionRouter.get("/me", authorize("STUDENT"), validate(listQuerySchema, "query"), submission.listMine);

// Mentor (static paths before /:id)
submissionRouter.get("/stats", authorize("MENTOR"), submission.stats);
submissionRouter.get("/", authorize("MENTOR"), validate(listQuerySchema, "query"), submission.list);
submissionRouter.patch(
  "/:id/status",
  authorize("MENTOR"),
  validate(idParamSchema, "params"),
  validate(reviewSchema),
  submission.review,
);
