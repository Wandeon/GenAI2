import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">GenAI Observatory</h1>
      <p className="text-muted-foreground mb-8">World State AI Observatory</p>

      <nav className="flex flex-col gap-4 text-center">
        <Link
          href="/observatory"
          className="text-primary hover:underline"
        >
          Observatory (Multi-lane cockpit)
        </Link>
        <Link
          href="/daily"
          className="text-primary hover:underline"
        >
          Daily Run (GM briefing)
        </Link>
        <Link
          href="/explore/anthropic"
          className="text-primary hover:underline"
        >
          Explore (Entity dossier)
        </Link>
        <Link
          href="/watchlists"
          className="text-primary hover:underline"
        >
          Watchlists
        </Link>
        <Link
          href="/library"
          className="text-primary hover:underline"
        >
          Library
        </Link>
      </nav>
    </div>
  );
}
