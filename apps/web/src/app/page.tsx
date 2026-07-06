import Link from 'next/link'
import { AuthStatus } from '@/components/auth-status'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

const features = [
  { title: 'Structured courses', body: 'Modules and lessons with video and reading material.' },
  { title: 'Quizzes & tests', body: 'Optional assessments after each module.' },
  { title: 'Certificates', body: 'Auto-generated the moment a course is completed.' },
]

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center">
          <Logo className="h-8" />
        </div>
        <div className="flex items-center gap-4">
          <AuthStatus />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 text-center sm:py-28">
          <p className="mb-5 inline-block rounded-full border border-border bg-card px-3 py-1 text-xs text-muted">
            Internal learning platform
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Learn, grow, and get certified — all in one place.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            Courses, modules, quizzes and certificates for your whole team.
            Try the theme switch in the top-right corner. ☀️ / 🌙
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-lg bg-accent px-5 py-3 font-medium text-white transition hover:opacity-90"
            >
              Get started
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-border px-5 py-3 font-medium transition hover:bg-card"
            >
              Learn more
            </a>
          </div>
        </section>

        <section id="features" className="grid gap-4 pb-24 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg"
            >
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
