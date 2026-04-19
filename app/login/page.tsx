import Link from "next/link"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/auth/login-form"
import { getServerAuthSession } from "@/lib/auth"

export default async function LoginPage() {
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
        <h1 className="text-2xl font-semibold">Sign in to your account</h1>
      </div>

      <LoginForm />

      <p className="text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-primary underline-offset-4 hover:underline"
        >
          Register now
        </Link>
      </p>
    </main>
  )
}
