import { Card, CardContent, CardHeader, CardTitle } from "@genai/ui";

export default function ObservatoryPage() {
  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Observatory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder cockpit view. Phase 0 will wire real-time event lanes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
