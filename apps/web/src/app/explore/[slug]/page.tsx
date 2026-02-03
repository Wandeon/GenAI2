// Explore - Entity dossier + relationship graph
// Dossier-first, graph optional (per Architecture Constitution #10)

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ExplorePage({ params }: Props) {
  const { slug } = await params;

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      {/* Entity header */}
      <header className="mb-8">
        <span className="text-sm text-muted-foreground">COMPANY</span>
        <h1 className="text-3xl font-bold capitalize">{slug}</h1>
        <p className="text-muted-foreground mt-2">
          TODO: Entity description from database
        </p>
      </header>

      {/* Dossier tabs */}
      <nav className="flex gap-4 border-b mb-6">
        <button className="px-4 py-2 border-b-2 border-primary font-medium">
          Overview
        </button>
        <button className="px-4 py-2 text-muted-foreground">
          Timeline
        </button>
        <button className="px-4 py-2 text-muted-foreground">
          Relationships
        </button>
        <button className="px-4 py-2 text-muted-foreground">
          Graph
        </button>
      </nav>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          <section>
            <h2 className="font-semibold mb-4">Recent Events</h2>
            <p className="text-muted-foreground">
              TODO: Timeline of events mentioning this entity
            </p>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <section>
            <h3 className="font-semibold mb-2">Related Entities</h3>
            <p className="text-muted-foreground text-sm">
              TODO: Top connected entities
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Topics</h3>
            <p className="text-muted-foreground text-sm">
              TODO: Associated topics
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
