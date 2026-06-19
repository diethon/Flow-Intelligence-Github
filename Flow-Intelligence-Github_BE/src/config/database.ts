import mongoose from "mongoose";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/flow_intelligence";

  try {
    await mongoose.connect(uri);
    console.log(`[MongoDB] Connected: ${uri}`);
  } catch (err) {
    console.error("[MongoDB] Connection error:", err);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Disconnected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] Error:", err);
  });
}
