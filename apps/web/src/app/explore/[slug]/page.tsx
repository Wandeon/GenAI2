import { Card, CardContent, CardHeader, CardTitle } from "@genai/ui";

export default async function ExplorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Explore: {slug}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder dossier view. Entity summaries and graphs are Phase 1+.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
