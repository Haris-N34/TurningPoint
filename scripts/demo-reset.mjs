// P.2: `pnpm demo:reset`. Demo data lives in the browser, so the reset runs there.
// This prints the reset link and tries to open it in the default browser.
import { spawn } from "node:child_process";

const base = process.env.DEMO_URL ?? "http://localhost:3000";
const url = `${base.replace(/\/$/, "")}/demo/reset`;
console.log(`Open ${url} to clear all local demo data (tp: keys and recordings) and reload the seed.`);
console.log("Or press Ctrl+Shift+D on any page and click Reset everything.");
if (!process.argv.includes("--print")) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).on("error", () => {}).unref();
  } catch {
    // No browser opener here: the link above is enough.
  }
}
