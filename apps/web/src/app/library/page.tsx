import { Card, CardContent, CardHeader, CardTitle } from "@genai/ui";

export default function LibraryPage() {
  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Library</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder library view for migrated briefs and deep dives.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
