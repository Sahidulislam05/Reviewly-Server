import { z } from "zod";

export const createSubmissionSchema = z.object({
  projectName: z.string().trim().min(3, "Project name must be at least 3 characters").max(80),
  repoUrl: z
    .string()
    .trim()
    .max(200)
    .regex(
      /^https:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+?(\.git)?\/?$/i,
      "Must be a GitHub repository URL (https://github.com/owner/repo)",
    ),
  liveLink: z
    .string()
    .trim()
    .max(200)
    .pipe(z.url({ protocol: /^https$/, hostname: z.regexes.domain, error: "Must be a valid https:// URL" })),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(1000),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export const reviewSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    feedback: z.string().trim().min(5, "Feedback must be at least 5 characters").max(500).optional(),
  })
  .refine((v) => v.status !== "REJECTED" || v.feedback, {
    path: ["feedback"],
    message: "A reason is required when rejecting",
  });

export const idParamSchema = z.object({ id: z.string().min(1) });

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
