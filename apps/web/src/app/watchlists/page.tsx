import { Card, CardContent, CardHeader, CardTitle } from "@genai/ui";

export default function WatchlistsPage() {
  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Watchlists</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder subscriptions view. Watchlist management is coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
