import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { badRequest } from "@/lib/next-response"

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(8).max(100),
})

export async function POST(request: Request) {
  const json = await request.json().catch(() => null)
  const parsed = registerSchema.safeParse(json)

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input")
  }

  const existingUser = await db.query.users.findFirst({
    where: (table, { eq: equals }) => equals(table.email, parsed.data.email),
  })

  if (existingUser) {
    return badRequest("Email is already in use")
  }

  const passwordHash = await hash(parsed.data.password, 10)

  await db.insert(users).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash,
  })

  return NextResponse.json({ ok: true })
}
