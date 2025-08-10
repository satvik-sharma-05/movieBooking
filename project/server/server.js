import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { inngest, functions } from "./inngest/inngest.js";
import { serve } from "inngest/express";
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

  // Clerk sends events with `type` and `data`
  if (!rawBody?.type || !rawBody?.data) {
    console.warn("⚠️ Invalid Clerk webhook payload:", rawBody);
    return res.status(400).json({ error: "Invalid Clerk webhook payload" });
  }

  const event = {
    name: rawBody.type, // e.g. "clerk/user.created"
    data: rawBody.data,
  };

  try {
    await inngest.send([event]);
    console.log("✅ Event sent to Inngest:", event.name);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Failed to send event to Inngest", err);
    res.status(500).json({ error: "Failed to send event" });
  }
});

app.post("/test/clerk-webhook", async (req, res) => {
  const mockEvent = {
    name: "clerk/user.created",
    data: {
      id: "user_test_123",
      object: "user",
      email_addresses: [{ email_address: "test@example.com" }],
      image_url: "https://example.com/image.png",
      first_name: "Test",
      last_name: "User",
      created_at: Date.now(),
    },
  };

  try {
    const response = await fetch("https://movie-booking-server-psi.vercel.app/api/inngest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockEvent),
    });

    const result = await response.json();
    console.log("📤 Inngest response:", result);
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("❌ Failed to send event to Inngest:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_, res) => res.send("Server is Live!"));
app.get("/favicon.ico", (_, res) => res.status(204).end());

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export default app;