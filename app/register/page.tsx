import { redirect } from "next/navigation"

import { RegisterForm } from "@/components/auth/register-form"
import { getServerAuthSession } from "@/lib/auth"

export default async function RegisterPage() {
  const session = await getServerAuthSession()

  if (session?.user?.id) {
    redirect("/planner")
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <p className="text-sm tracking-[0.12em] text-muted-foreground uppercase">
          Bike Tour Planner
        </p>
        <h1 className="text-2xl font-semibold">Create your account</h1>
      </div>

      <RegisterForm />
    </main>
  )
}
