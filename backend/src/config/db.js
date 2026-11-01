import mongoose from "mongoose";
import { startDatabaseMirror } from "../services/database-mirror.service.js";

const connectDB = async () => {
  const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    autoIndex: process.env.NODE_ENV !== "production",
  });
  startDatabaseMirror();
  console.log(
    `\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}`,
  );
};

export default connectDB;
