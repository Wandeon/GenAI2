import { router } from "./trpc";
import { eventsRouter } from "./routers/events";
import { entitiesRouter } from "./routers/entities";
import { topicsRouter } from "./routers/topics";
import { searchRouter } from "./routers/search";
import { llmRunsRouter } from "./routers/llm-runs";
import { dailyBriefingsRouter } from "./routers/daily-briefings";
import { sessionsRouter } from "./routers/sessions";

export const appRouter = router({
  events: eventsRouter,
  entities: entitiesRouter,
  topics: topicsRouter,
  search: searchRouter,
  llmRuns: llmRunsRouter,
  dailyBriefings: dailyBriefingsRouter,
  sessions: sessionsRouter,
});

export type AppRouter = typeof appRouter;
