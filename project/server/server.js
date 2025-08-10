import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { inngest, functions } from "./inngest/inngest.js";
import { serve } from "inngest/express";

// ✅ Load .env from same folder (project/server/.env)
dotenv.config();

// 🔍 Confirm env keys loaded
console.log("🔑 Event Key:", process.env.INNGEST_EVENT_KEY);
console.log("🔐 Signing Key:", process.env.INNGEST_SIGNING_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// ✅ Connect to MongoDB
await connectDB();

// ✅ Clerk middleware
app.use(clerkMiddleware());
app.use("/api/clerk", clerkMiddleware());

// ✅ Inngest middleware

app.use("/api/inngest", serve({ client: inngest, functions }));

// 🔔 Inngest webhook handler
app.post("/api/inngest", async (req, res) => {
  const rawBody = req.body;
  console.log("📦 Incoming Clerk webhook:", JSON.stringify(rawBody, null, 2));

  if (!rawBody?.type || !rawBody?.data) {
    console.warn("⚠️ Invalid Clerk webhook payload");
    return res.status(400).json({ error: "Invalid Clerk webhook payload" });
  }

  const event = {
    name: rawBody.type,
    data: rawBody.data,
  };

  try {
    const result = await inngest.send([event]);
    console.log("✅ Event sent to Inngest:", result);
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("❌ Failed to send event to Inngest:", err.message);
    res.status(500).json({ error: err.message || "Failed to send event" });
  }
});

// 🧪 Local test route to simulate Clerk webhook
app.post("/test/clerk-webhook", async (req, res) => {
  const mockEvent = {
    type: "clerk/user.created",
    data: {
      id: "user_test_123",
      object: "user",
      email_addresses: [
        {
          id: "idn_test_email",
          email_address: "test@example.com",
          object: "email_address",
          verification: {
            status: "verified",
            strategy: "admin",
            object: "verification_admin",
          },
        },
      ],
      image_url: "https://example.com/image.png",
      first_name: "Test",
      last_name: "User",
      created_at: Date.now(),
    },
  };

  console.log("📦 Sending mock event:", JSON.stringify(mockEvent, null, 2));

  try {
    const response = await fetch("http://localhost:3000/api/inngest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockEvent),
    });

    const text = await response.text();
    console.log("📥 Raw response from /api/inngest:", text);

    try {
      const result = JSON.parse(text);
      console.log("📤 Parsed JSON response:", result);
      res.status(200).json({ success: true, result });
    } catch (err) {
      console.error("❌ Failed to parse JSON:", err.message);
      res.status(500).json({ error: "Invalid JSON response from Inngest", raw: text });
    }
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Health check
app.get("/", (_, res) => res.send("Server is Live!"));
app.get("/favicon.ico", (_, res) => res.status(204).end());

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export default app;