// Daily Run - Ritual briefing with GM commentary
// "What changed since you were gone" format

export default function DailyRunPage() {
  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Daily Run</h1>
        <p className="text-muted-foreground">
          GM • 12 izvora • visoka pouzdanost
        </p>
      </header>

      <main className="space-y-8">
        {/* Top 5 events */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Ključni događaji</h2>
          <p className="text-muted-foreground">
            TODO: Top 5 ranked events with GM summaries
          </p>
        </section>

        {/* What changed */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Što se promijenilo</h2>
          <p className="text-muted-foreground">
            TODO: Entity state changes, new relationships
          </p>
        </section>

        {/* GM Prediction */}
        <section>
          <h2 className="text-xl font-semibold mb-4">GM Prognoza</h2>
          <p className="text-muted-foreground">
            TODO: What to watch this week (marked as speculation)
          </p>
        </section>

        {/* Catch up button */}
        <div className="pt-4">
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
            Pusti 47 događaja (2x brzina)
          </button>
        </div>
      </main>
    </div>
  );
}
