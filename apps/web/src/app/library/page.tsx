// Library - Migrated articles + deep dives
// WordPress content will be migrated here (Phase 7)

export default function LibraryPage() {
  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Library</h1>
        <p className="text-muted-foreground">
          Deep dives, analyses, and articles
        </p>
      </header>

      <main>
        {/* Search/filter */}
        <div className="mb-6">
          <input
            type="search"
            placeholder="Search articles..."
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        {/* Article grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <p className="text-muted-foreground col-span-full">
            TODO: Article cards (migrated from WordPress)
          </p>
        </div>
      </main>
    </div>
  );
}
