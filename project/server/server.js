import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { inngest, functions } from "./inngest/inngest.js";
import { serve } from "inngest/express";
import { Webhook } from 'svix';
import { headers } from 'next/headers';

console.log("🧠 Initializing server...");

// Load environment variables
dotenv.config();

// Environment validation
const requiredEnvVars = [
  'MONGODB_URI',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*'
}));

// Database connection
try {
  await connectDB();
  console.log("✅ MongoDB connected successfully");
} catch (err) {
  console.error("❌ MongoDB connection failed:", err);
  process.exit(1);
}

// Clerk webhook handler
app.post('/api/clerk/webhook', async (req, res) => {
  console.log("📩 Clerk webhook received");
  try {
    const payload = req.body;
    const headersList = headers();
    
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    const svixHeaders = {
      'svix-id': headersList.get('svix-id'),
      'svix-timestamp': headersList.get('svix-timestamp'),
      'svix-signature': headersList.get('svix-signature'),
    };
    
    const evt = wh.verify(JSON.stringify(payload), svixHeaders);
    
    console.log(`🔔 Clerk event: ${evt.type}`);

    // Trigger Inngest event
    await inngest.send({
      name: `clerk/${evt.type}`,
      data: evt.data
    });
    
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Test endpoint
app.post("/test-sync", async (req, res) => {
  console.log("🧪 Test sync endpoint hit");
  try {
    await inngest.send({
      name: "clerk/user.created",
      data: {
        id: "user_test_" + Math.random().toString(36).substring(2, 8),
        object: "user",
        first_name: "Test",
        last_name: "User",
        email_addresses: [{
          id: "email_test_" + Math.random().toString(36).substring(2, 8),
          email_address: `test${Math.floor(Math.random() * 1000)}@example.com`
        }],
        primary_email_address_id: "email_test_123",
        image_url: "https://img.clerk.com/test.png",
        created_at: Date.now(),
      },
    });
    res.json({ success: true, message: "Test event sent" });
  } catch (err) {
    console.error("❌ Test sync error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Inngest endpoint
app.use("/api/inngest", serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY
}));

// Clerk middleware (exclude webhook and Inngest endpoints)
app.use(clerkMiddleware({
  ignoredRoutes: [
    '/api/clerk/webhook',
    '/api/inngest',
    '/test-sync'
  ]
}));

// Health check
app.get("/health", (_, res) => res.json({
  status: "healthy",
  db: "connected",
  clerk: "configured",
  inngest: "ready"
}));

// Start server
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log("🔗 Endpoints:");
    console.log(`- Health check: http://localhost:${PORT}/health`);
    console.log(`- Test sync: http://localhost:${PORT}/test-sync`);
    console.log(`- Inngest: http://localhost:${PORT}/api/inngest`);
    console.log(`- Clerk webhook: http://localhost:${PORT}/api/clerk/webhook`);
  });
}

export default app;