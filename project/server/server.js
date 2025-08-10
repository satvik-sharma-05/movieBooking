import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { inngest, functions } from "./inngest/inngest.js";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(cors());

await connectDB();


// Middleware for Clerk authentication
app.use(clerkMiddleware());
app.use("/api/clerk", clerkMiddleware());

// Custom Inngest webhook handler
app.post("/api/inngest", async (req, res) => {
  const rawBody = req.body;

  console.log("📦 Full incoming body:", rawBody);

  // Manually construct the event
  const event = {
    name: "clerk/user.created", // or dynamically infer from headers or payload
    data: rawBody.data,
  };

  if (!event?.data) {
    return res.status(400).json({ error: "Missing event data", body: rawBody });
  }

  try {
    await inngest.send([event]);
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