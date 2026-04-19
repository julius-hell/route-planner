import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getServerAuthSession } from "@/lib/auth"

export default async function Page() {
  const session = await getServerAuthSession()

  if (session?.user?.id) {
    redirect("/planner")
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-6 p-6">
      <div className="space-y-3">
        <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
          Bike Tour Planner
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Plan and save your bike tours
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Add waypoints on the map, generate open routes or round trips, and
          keep your tours in one place.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/register">Create account</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  )
}
