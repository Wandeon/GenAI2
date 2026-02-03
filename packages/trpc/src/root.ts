import { router } from "./trpc";
import { eventsRouter } from "./routers/events";
import { entitiesRouter } from "./routers/entities";
import { topicsRouter } from "./routers/topics";
import { searchRouter } from "./routers/search";

export const appRouter = router({
  events: eventsRouter,
  entities: entitiesRouter,
  topics: topicsRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
