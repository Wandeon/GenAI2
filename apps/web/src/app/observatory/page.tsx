// Observatory - Multi-lane glass cockpit with real-time events
// Phase 0 deliverable: Time Machine scrubber + 3 lanes + search

export default function ObservatoryPage() {
  return (
    <div className="min-h-screen">
      {/* Header with search */}
      <header className="border-b p-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Observatory</h1>
          <input
            type="search"
            placeholder="Search events, entities, topics..."
            className="flex-1 rounded-md border px-3 py-2"
          />
        </div>

        {/* Time Machine Scrubber - Flagship UX */}
        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={100}
            className="w-full"
            aria-label="Time machine scrubber"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>7 days ago</span>
            <span>NOW</span>
          </div>
        </div>
      </header>

      {/* Multi-lane layout */}
      <main className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {/* Lane 1: Breaking */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Breaking</h2>
          <p className="text-muted-foreground text-sm">
            TODO: Event cards with BREAKING impact
          </p>
        </section>

        {/* Lane 2: Research */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Research</h2>
          <p className="text-muted-foreground text-sm">
            TODO: Papers, benchmarks, datasets
          </p>
        </section>

        {/* Lane 3: Industry */}
        <section className="border rounded-lg p-4">
          <h2 className="font-semibold mb-4">Industry</h2>
          <p className="text-muted-foreground text-sm">
            TODO: Funding, launches, partnerships
          </p>
        </section>
      </main>

      {/* Context Panel (right sidebar on desktop) */}
      {/* TODO: Shows details when event selected */}
    </div>
  );
}
