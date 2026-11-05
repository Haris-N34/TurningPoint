"use client";

import { useEffect } from "react";
import { purgePracticeData } from "@/lib/practice/practice";
import { media } from "@/lib/store/media";
import { store } from "@/lib/store/store";

/** Runs on every page load: practice data older than 24 hours is deleted from this device (C8.1). */
export function Housekeeping() {
  useEffect(() => {
    purgePracticeData(store(), media, new Date()).catch(() => {});
  }, []);
  return null;
}
