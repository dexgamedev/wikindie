import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-text">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Not found</h1>
        <Link className="mt-4 inline-block text-accent" to="/">
          Back home
        </Link>
      </div>
    </main>
  )
}
