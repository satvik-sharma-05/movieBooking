import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { inngest, functions } from "./inngest/inngest.js";
import { serve } from "inngest/express";

console.log("🧠 Running server.js");
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


// 🧪 Local test route to simulate Clerk webhook
app.post("/test-sync", async (req, res) => {
  console.log("🧪 /test-sync route hit - START");
  console.log("Request received:", req.method, req.url);
  try {
    console.log("Sending event to:", inngest.options.baseUrl);
    await inngest.send({
      name: "user.created",
      data: {
        id: "user_test123",
        object: "user",
        first_name: "Test",
        last_name: "User",
        email_addresses: [{ id: "idn_test123", email_address: "test@example.com" }],
        primary_email_address_id: "idn_test123",
        image_url: "https://img.clerk.com/test.png",
        created_at: Date.now(),
      },
    });
    console.log("✅ Send result: Event sent");
    res.send({ success: true, message: "Event sent to Inngest" });
  } catch (err) {
    console.error("❌ Failed to send event:", err.message, err.stack);
    res.status(500).send({ success: false, error: err.message });
  }
  console.log("🧪 /test-sync route hit - END");
});

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





// ✅ Health check
app.get("/", (_, res) => res.send("Server is Live!"));
app.get("/favicon.ico", (_, res) => res.status(204).end());

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export default app;