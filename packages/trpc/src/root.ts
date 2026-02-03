import { router } from "./trpc";
import { eventsRouter } from "./routers/events";
import { entitiesRouter } from "./routers/entities";
import { topicsRouter } from "./routers/topics";

export const appRouter = router({
  events: eventsRouter,
  entities: entitiesRouter,
  topics: topicsRouter,
});

export type AppRouter = typeof appRouter;
