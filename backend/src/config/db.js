import mongoose from "mongoose";
import { startDatabaseMirror } from "../services/database-mirror.service.js";
import { Conversation, Message, Receipt, AISettings, AIJob } from "../modules/whatsapp/whatsapp.model.js";

const connectDB = async () => {
  const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    autoIndex: process.env.NODE_ENV !== "production",
  });
  // Production disables automatic indexes; deduplication requires these before accepting events.
  await Promise.all([Conversation.createIndexes(), Message.createIndexes(), Receipt.createIndexes(), AISettings.createIndexes(), AIJob.createIndexes()]);
  startDatabaseMirror();
  console.log(
    `\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}`,
  );
};

export default connectDB;
