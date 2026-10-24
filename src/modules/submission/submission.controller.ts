import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse";
import type { ListQuery } from "./submission.schema";
import * as service from "./submission.service";

export async function create(req: Request, res: Response) {
  const data = await service.createSubmission(req.user!.id, req.body);
  sendResponse(res, { statusCode: 201, message: "Project submitted", data });
}

export async function listMine(req: Request, res: Response) {
  const { items, meta } = await service.listMySubmissions(req.user!.id, req.query as unknown as ListQuery);
  sendResponse(res, { message: "Submissions fetched", data: items, meta });
}

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listSubmissions(req.query as unknown as ListQuery);
  sendResponse(res, { message: "Submissions fetched", data: items, meta });
}

export async function stats(_req: Request, res: Response) {
  sendResponse(res, { message: "Statistics fetched", data: await service.getStats() });
}

export async function review(req: Request, res: Response) {
  const data = await service.reviewSubmission(req.params.id as string, req.user!.id, req.body);
  sendResponse(res, { message: `Submission ${data.status.toLowerCase()}`, data });
}
