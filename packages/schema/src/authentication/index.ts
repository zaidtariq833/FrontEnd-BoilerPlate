import { z } from "zod"

export const signInSchema = z.object({
  email: z.string({ required_error: "Email is required" }).email({ message: "Email is required." }),
  password: z.string({ required_error: "password is required." })
})

export type TSignInSchema = z.infer<typeof signInSchema>