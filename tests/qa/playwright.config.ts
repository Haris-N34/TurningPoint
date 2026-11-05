import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

// QA night specs: `pnpm exec playwright test -c tests/qa/playwright.config.ts`.
// Bugs in another agent's area are test.fixme until their owner fixes them.
export default defineConfig({ ...base, testDir: "." , testMatch: /.*\.spec\.ts/ });
