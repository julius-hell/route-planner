import { redirect } from "next/navigation"

import { SignOutButton } from "@/components/auth/signout-button"
import { PlannerClient } from "@/components/planner/planner-client"
import { getServerAuthSession } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { serializeTour } from "@/lib/tour-serializer"

export default async function PlannerPage() {
  const session = await getServerAuthSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const tours = await db.query.tours.findMany({
    where: (table, { eq }) => eq(table.userId, session.user.id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    with: {
      points: {
        orderBy: (table, { asc }) => [asc(table.seq)],
      },
      route: true,
    },
  })

  const initialTours = tours.map(serializeTour)

  return (
    <main className="mx-auto w-full max-w-[1400px] space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Bike Tour Planner
          </p>
          <h1 className="text-xl font-semibold">
            Welcome, {session.user.name ?? session.user.email}
          </h1>
        </div>
        <SignOutButton />
      </header>

      <PlannerClient initialTours={initialTours} />
    </main>
  )
}
