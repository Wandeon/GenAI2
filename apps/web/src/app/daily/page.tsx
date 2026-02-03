import { Card, CardContent, CardHeader, CardTitle } from "@genai/ui";

export default function DailyPage() {
  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Daily Run</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Placeholder briefing. GM commentary and summaries will land here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
