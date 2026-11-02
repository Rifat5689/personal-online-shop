// Reads secrets from hidden stdin; updates only the designated testing app.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write("Ready for WhatsApp settings JSON on stdin (hidden).\n");
let input = "";
for await (const chunk of process.stdin) { input += chunk; if (input.includes("\n") || input.includes("\r")) break; }
const settings = JSON.parse(input.trim());
const allowed = ["META_WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_PHONE_NUMBER_ID", "META_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "META_GRAPH_API_VERSION"];
if (Object.keys(settings).some(key => !allowed.includes(key)) || Object.values(settings).some(value => typeof value !== "string" || !value)) throw Error("Invalid settings");
const folder = mkdtempSync(join(tmpdir(), "whatsapp-testing-"));
try {
  const file = join(folder, "settings.json");
  writeFileSync(file, JSON.stringify(settings));
  const result = spawnSync("az.cmd", ["webapp", "config", "appsettings", "set", "-g", "encrypts_group", "-n", "test-originsofbeauty", "--settings", "@" + file, "--output", "none", "--only-show-errors"], { shell: true, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  if (result.status !== 0) throw Error("Azure testing settings update failed; no credentials printed");
  console.log("Updated testing WhatsApp settings. No other app settings changed.");
} finally { rmSync(folder, { recursive: true, force: true }); }
process.exit(0);
