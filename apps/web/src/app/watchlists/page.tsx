// Watchlists - User subscriptions with catch-up
// Server-side sessions with HttpOnly cookie (per Architecture Constitution #5)

export default function WatchlistsPage() {
  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Watchlists</h1>
        <p className="text-muted-foreground">
          Track entities and topics that matter to you
        </p>
      </header>

      <main className="space-y-6">
        {/* Create new watchlist */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Create Watchlist</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Watchlist name..."
              className="w-full rounded-md border px-3 py-2"
            />
            <input
              type="text"
              placeholder="Add entities or topics..."
              className="w-full rounded-md border px-3 py-2"
            />
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
              Create
            </button>
          </div>
        </section>

        {/* Existing watchlists */}
        <section>
          <h2 className="font-semibold mb-4">Your Watchlists</h2>
          <p className="text-muted-foreground">
            TODO: List of watchlists with unseen event counts
          </p>
        </section>
      </main>
    </div>
  );
}
