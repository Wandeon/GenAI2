"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@genai/trpc";

export const trpc = createTRPCReact<AppRouter>();
