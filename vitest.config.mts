import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Let unit tests render small components (React automatic JSX).
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.ts", "content/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/qa/**/*.test.ts"],
    environment: "node",
  },
});
