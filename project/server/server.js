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
  try {
    await inngest.send({
      name: "user.created",
      data: {
        id: "user_test789",
        object: "user",
        first_name: "John",
        last_name: "Smith",
        email_addresses: [{ id: "idn_test789", email_address: "john.smith@example.com" }],
        primary_email_address_id: "idn_test789",
        image_url: "https://img.clerk.com/john.png",
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

// 🔔 Inngest webhook handler with logging
app.use("/api/inngest", (req, res, next) => {
  console.log("Inngest request received:", req.method, req.url, req.headers);
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  next();
}, serve({ client: inngest, functions }));

// Clerk middleware (exclude /api/inngest)
app.use(clerkMiddleware({ ignoredRoutes: ["/api/inngest"] }));
app.use("/api/clerk", clerkMiddleware());

// ✅ Health check
app.get("/", (_, res) => res.send("Server is Live!"));
app.get("/favicon.ico", (_, res) => res.status(204).end());

// Vercel serverless handler (remove local listen for production)
export default (req, res) => {
  app(req, res);
};