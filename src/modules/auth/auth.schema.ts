import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().toLowerCase().max(120).pipe(z.email("Enter a valid email")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters") // bcrypt only uses the first 72 bytes
    .regex(/[a-z]/i, "Password must contain a letter")
    .regex(/\d/, "Password must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
