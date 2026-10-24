import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthUser, JwtPayload } from "../../middlewares/authenticate";
import { ApiError } from "../../utils/ApiError";
import type { LoginInput, SignupInput } from "./auth.schema";

const userSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const;

// Compared against when the email does not exist, so both failure paths take the same time.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

export const signToken = (user: AuthUser) =>
  jwt.sign({ sub: user.id, role: user.role } satisfies JwtPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
  });

export async function signup({ name, email, password }: SignupInput) {
  try {
    return await prisma.user.create({
      // role is never taken from the client: every signup is a STUDENT
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: "STUDENT" },
      select: userSelect,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "An account with this email already exists", [
        { field: "email", message: "An account with this email already exists" },
      ]);
    }
    throw e;
  }
}

export async function login({ email, password }: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Invalid email or password");
  const { passwordHash: _, updatedAt: __, ...safeUser } = user;
  return safeUser;
}

export async function getMe(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw new ApiError(401, "Account no longer exists");
  return user;
}
