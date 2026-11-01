import { readFileSync } from "node:fs";
let release = "development";
try { release = JSON.parse(readFileSync(new URL("../../build-info.json", import.meta.url), "utf8")).commit; } catch { /* Local development has no deployment manifest. */ }
export { release };
