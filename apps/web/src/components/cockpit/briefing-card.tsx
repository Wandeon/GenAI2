"use client";

import { motion } from "framer-motion";
import { trpc } from "@/trpc";

interface BriefingPayload {
  changedSince?: {
    en: string;
    hr: string;
    highlights: string[];
  };
}

export function BriefingCard() {
  const { data: briefing } = trpc.dailyBriefings.today.useQuery();

  const payload = briefing?.payload as BriefingPayload | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="bg-card border border-border rounded-xl p-5 h-full"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📡</span>
        <h2 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground">
          Dnevni pregled
        </h2>
      </div>

      {payload ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-foreground/90">
            {payload.changedSince?.hr || payload.changedSince?.en || "Nema sažetka."}
          </p>
          {payload.changedSince?.highlights && (
            <ul className="space-y-1">
              {payload.changedSince.highlights.slice(0, 3).map((h: string, i: number) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">▸</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Dnevni pregled još nije generiran.
        </p>
      )}
    </motion.div>
  );
}
