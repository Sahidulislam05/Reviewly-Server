import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

// Runs against DATABASE_URL; every row it creates belongs to a *@test.local user and is deleted afterwards.
const run = Date.now().toString(36);
const email = (n: string) => `${n}-${run}@test.local`;
let server: Server;
let base = "";

async function call(method: string, path: string, body?: unknown, cookie?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, json: (await res.json()) as any };
}
const cookieOf = (h: Headers) => h.get("set-cookie")?.split(";")[0] ?? "";

const project = (i: number) => ({
  projectName: `Test project ${i}`,
  repoUrl: `https://github.com/test-${run}/repo-${i}`,
  liveLink: "https://example.com",
  description: "A test project description that is long enough.",
});

let student = "";
let mentor = "";

beforeAll(async () => {
  server = app.listen(0);
  base = `http://localhost:${(server.address() as { port: number }).port}/api`;

  const signup = await call("POST", "/auth/signup", {
    name: "Test Student",
    email: email("student"),
    password: "Password1",
    role: "MENTOR",
  });
  expect(signup.status).toBe(201);
  expect(signup.json.data.role).toBe("STUDENT"); // client-sent role is ignored
  expect(signup.json.data.passwordHash).toBeUndefined();
  student = cookieOf(signup.headers);

  const login = await call("POST", "/auth/login", {
    email: process.env.SEED_MENTOR_EMAIL,
    password: process.env.SEED_MENTOR_PASSWORD,
  });
  expect(login.status).toBe(200);
  mentor = cookieOf(login.headers);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@test.local` } } });
  server.close();
  await prisma.$disconnect();
});

describe("auth", () => {
  test("wrong email and wrong password give the same 401", async () => {
    const a = await call("POST", "/auth/login", { email: email("nobody"), password: "Password1" });
    const b = await call("POST", "/auth/login", { email: email("student"), password: "Wrong1234" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.message).toBe(b.json.message);
  });

  test("me needs a valid token", async () => {
    expect((await call("GET", "/auth/me")).status).toBe(401);
    expect((await call("GET", "/auth/me", undefined, "token=tampered")).status).toBe(401);
    expect((await call("GET", "/auth/me", undefined, student)).json.data.email).toBe(email("student"));
  });
});

describe("submissions", () => {
  let submissionId = "";

  test("validation errors are per field", async () => {
    const res = await call("POST", "/submissions", { ...project(0), repoUrl: "https://gitlab.com/a/b" }, student);
    expect(res.status).toBe(422);
    expect(res.json.errors[0].field).toBe("repoUrl");
  });

  test("create, then duplicate (different casing) is 409", async () => {
    const created = await call("POST", "/submissions", project(1), student);
    expect(created.status).toBe(201);
    submissionId = created.json.data.id;

    const dup = await call("POST", "/submissions", { ...project(1), repoUrl: `https://www.GitHub.com/TEST-${run}/Repo-1.git/` }, student);
    expect(dup.status).toBe(409);
    expect(dup.json.errors[0].field).toBe("repoUrl");
  });

  test("roles are enforced", async () => {
    expect((await call("GET", "/submissions", undefined, student)).status).toBe(403);
    expect((await call("GET", "/submissions/stats", undefined, student)).status).toBe(403);
    expect((await call("PATCH", `/submissions/${submissionId}/status`, { status: "APPROVED" }, student)).status).toBe(403);
    expect((await call("POST", "/submissions", project(9), mentor)).status).toBe(403);
  });

  test("reject needs a reason; review happens once", async () => {
    const path = `/submissions/${submissionId}/status`;
    expect((await call("PATCH", path, { status: "REJECTED" }, mentor)).status).toBe(422);
    const ok = await call("PATCH", path, { status: "REJECTED", feedback: "Missing README" }, mentor);
    expect(ok.status).toBe(200);
    expect(ok.json.data.feedbacks[0].message).toBe("Missing README");
    expect((await call("PATCH", path, { status: "APPROVED" }, mentor)).status).toBe(409);
    expect((await call("PATCH", "/submissions/nope/status", { status: "APPROVED" }, mentor)).status).toBe(404);
  });

  test("server-side filter and pagination meta", async () => {
    const res = await call("GET", "/submissions?status=REJECTED&pageSize=50", undefined, mentor);
    expect(res.status).toBe(200);
    expect(res.json.data.every((s: { status: string }) => s.status === "REJECTED")).toBe(true);
    expect(res.json.meta.totalItems).toBeGreaterThanOrEqual(1);
    expect((await call("GET", "/submissions?pageSize=500", undefined, mentor)).status).toBe(422);

    const stats = await call("GET", "/submissions/stats", undefined, mentor);
    const { total, pending, approved, rejected } = stats.json.data;
    expect(total).toBe(pending + approved + rejected);
  });

  test("student sees own submissions with feedback", async () => {
    const res = await call("GET", "/submissions/me", undefined, student);
    expect(res.json.data).toHaveLength(1);
    expect(res.json.data[0].status).toBe("REJECTED");
  });

  test("6th submission attempt in 10 minutes is 429", async () => {
    // attempts so far: invalid, create, duplicate = 3
    expect((await call("POST", "/submissions", project(2), student)).status).toBe(201);
    expect((await call("POST", "/submissions", project(3), student)).status).toBe(201);
    const limited = await call("POST", "/submissions", project(4), student);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
  });
});
