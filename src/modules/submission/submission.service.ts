import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/ApiError";
import { normalizeRepoUrl } from "../../utils/normalizeRepoUrl";
import type { CreateSubmissionInput, ListQuery, ReviewInput } from "./submission.schema";

const submissionSelect = {
  id: true,
  projectName: true,
  repoUrl: true,
  liveLink: true,
  description: true,
  status: true,
  reviewedAt: true,
  createdAt: true,
  // Loaded in the same query as the submissions (no N+1).
  student: { select: { id: true, name: true, email: true } },
  feedbacks: {
    select: { id: true, message: true, createdAt: true, mentor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.SubmissionSelect;

export async function createSubmission(studentId: string, input: CreateSubmissionInput) {
  try {
    return await prisma.submission.create({
      data: { ...input, repoUrlNormalized: normalizeRepoUrl(input.repoUrl), studentId },
      select: submissionSelect,
    });
  } catch (e) {
    // The unique constraint decides, so two simultaneous requests cannot both succeed.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "This repository has already been submitted", [
        { field: "repoUrl", message: "This repository has already been submitted" },
      ]);
    }
    throw e;
  }
}

async function paginate(where: Prisma.SubmissionWhereInput, { page, pageSize }: ListQuery) {
  const [items, totalItems] = await prisma.$transaction([
    prisma.submission.findMany({
      where,
      select: submissionSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.submission.count({ where }),
  ]);
  return { items, meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } };
}

// No IDOR: the student id comes from the verified token, never from the request.
export const listMySubmissions = (studentId: string, query: ListQuery) =>
  paginate({ studentId, ...(query.status && { status: query.status }) }, query);

// Filtering happens in the database query, not in the browser.
export const listSubmissions = (query: ListQuery) => paginate(query.status ? { status: query.status } : {}, query);

export async function getStats() {
  const groups = await prisma.submission.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const [pending, approved, rejected] = [count("PENDING"), count("APPROVED"), count("REJECTED")];
  return { total: pending + approved + rejected, pending, approved, rejected };
}

export async function reviewSubmission(id: string, mentorId: string, { status, feedback }: ReviewInput) {
  await prisma.$transaction(async (tx) => {
    // Only PENDING can move; the WHERE makes check-and-update one atomic step.
    const { count } = await tx.submission.updateMany({
      where: { id, status: "PENDING" },
      data: { status, reviewedAt: new Date() },
    });
    if (count === 0) {
      const exists = await tx.submission.findUnique({ where: { id }, select: { id: true } });
      throw exists
        ? new ApiError(409, "This submission has already been reviewed")
        : new ApiError(404, "Submission not found");
    }
    if (feedback) await tx.feedback.create({ data: { message: feedback, submissionId: id, mentorId } });
  });
  return prisma.submission.findUniqueOrThrow({ where: { id }, select: submissionSelect });
}
