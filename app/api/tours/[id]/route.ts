import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getServerAuthSession } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { tours } from "@/lib/db/schema"
import { notFound, unauthorized } from "@/lib/next-response"
import { serializeTour } from "@/lib/tour-serializer"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteParams) {
  const session = await getServerAuthSession()

  if (!session?.user?.id) {
    return unauthorized()
  }

  const { id } = await context.params

  const tour = await db.query.tours.findFirst({
    where: (table, { and: both, eq: equals }) =>
      both(equals(table.id, id), equals(table.userId, session.user.id)),
    with: {
      points: {
        orderBy: (table, { asc }) => [asc(table.seq)],
      },
      route: true,
    },
  })

  if (!tour) {
    return notFound("Tour not found")
  }

  return NextResponse.json({ tour: serializeTour(tour) })
}

export async function DELETE(_: Request, context: RouteParams) {
  const session = await getServerAuthSession()

  if (!session?.user?.id) {
    return unauthorized()
  }

  const { id } = await context.params

  const deleted = await db
    .delete(tours)
    .where(and(eq(tours.id, id), eq(tours.userId, session.user.id)))
    .returning({ id: tours.id })

  if (deleted.length === 0) {
    return notFound("Tour not found")
  }

  return NextResponse.json({ ok: true })
}
