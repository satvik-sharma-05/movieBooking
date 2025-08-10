import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { inngest, functions } from "./inngest/inngest.js";

const app = express();
const PORT = process.env.PORT || 3000;

await connectDB();

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());
app.use("/api/clerk", clerkMiddleware());

// Custom Inngest webhook handler
app.post("/api/inngest", async (req, res) => {
  const event = req.body;

  console.log("📨 Raw incoming event:", event);

  if (!event?.name || !event?.data) {
    return res.status(400).json({ error: "Invalid event structure" });
  }

  try {
    await inngest.send([
      {
        name: event.name,
        data: event.data,
      },
    ]);

    console.log("✅ Event sent to Inngest");
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Failed to send event", err);
    res.status(500).json({ error: "Failed to send event" });
  }
});

app.get("/", (_, res) => res.send("Server is Live!"));
app.get("/favicon.ico", (_, res) => res.status(204).end());

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export default app;