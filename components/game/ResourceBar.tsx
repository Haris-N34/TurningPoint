"use client";

import { motion } from "framer-motion";
import type { Scenario } from "@/lib/engine/schema";

function fmt(v: number, unit?: string) {
  if (unit === "$") return `$${v.toLocaleString("en-CA")}`;
  return unit ? `${v} ${unit}` : String(v);
}

/** Budget, morale and time. Each change animates (C2.2) and is announced to screen readers. */
export function ResourceBar({ scenario, values }: { scenario: Scenario; values: Record<string, number> }) {
  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Resources">
      {Object.entries(scenario.resources).map(([key, r]) => {
        const v = values[key] ?? 0;
        const max = r.max ?? Math.max(r.start * 1.2, v, 1);
        const pct = Math.max(0, Math.min(100, (v / max) * 100));
        const low = pct < 25;
        return (
          <div key={key} className="rounded-xl bg-black/[.04] dark:bg-white/[.06] px-3 py-2" data-testid={`resource-${key}`}>
            <dt className="text-[11px] uppercase tracking-wide opacity-70">{r.label}</dt>
            <dd className="mt-0.5">
              <motion.span
                key={v}
                initial={{ opacity: 0.4, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="block text-sm sm:text-base font-semibold tabular-nums"
                aria-live="polite"
              >
                {fmt(v, r.unit)}
              </motion.span>
              <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden" aria-hidden>
                <motion.div
                  className={`h-full rounded-full ${low ? "bg-orange-600" : "bg-emerald-600"}`}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              {low && <span className="sr-only">Running low</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
