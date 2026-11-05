import { attachLiveAnalytics } from "./src/modules/analytics/live.server.js";
import { attachWhatsAppLive } from "./src/modules/whatsapp/whatsapp.live.js";
import { startAIWorker } from "./src/modules/whatsapp/whatsapp.ai.worker.js";
import { startShoppingWorker } from "./src/modules/whatsapp/whatsapp.shopping.worker.js";
import "dotenv/config";
import connectDB from "./src/config/db.js";
import { app } from "./src/app.js";
import { validateEnv } from "./src/config/validateEnv.js";
import mongoose from "mongoose";
import { stopDatabaseMirror } from "./src/services/database-mirror.service.js";
validateEnv();

const port = process.env.PORT || 5000;
const server = app.listen(port, (error) => {
  if (error) return;
  console.log(`Server is running at port: ${port}`);
});

const stopLiveAnalytics = attachLiveAnalytics(server);
const stopWhatsAppLive = attachWhatsAppLive(server);
const stopAIWorker = startAIWorker();
const stopShoppingWorker = startShoppingWorker();
let shuttingDown = false;
const shutdown = async (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopLiveAnalytics();
  stopWhatsAppLive();
  stopAIWorker();
  stopShoppingWorker();
  const deadline = setTimeout(() => process.exit(exitCode || 1), 10000);
  deadline.unref();
  await new Promise((resolve) => server.close(resolve));
  await stopDatabaseMirror();
  await mongoose.disconnect();
  clearTimeout(deadline);
  process.exitCode = exitCode;
};
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    void shutdown().catch(() => process.exit(1));
  });
server.on("error", () => {
  console.error("HTTP server failed to start. Check the configured port.");
  void shutdown(1).catch(() => process.exit(1));
});
connectDB().catch(() => {
  console.error(
    "MongoDB connection failed. Check database access and configuration.",
  );
  void shutdown(1).catch(() => process.exit(1));
});
