import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './config/db.js';
import {clerkMiddleware} from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/inngest.js";
const app = express();
const PORT = process.env.PORT || 3000;

await connectDB();

// Middleware
app.use(express.json());
app.use(cors());

// Initialize Clerk middleware

app.use(clerkMiddleware());
app.use('api/clerk', clerkMiddleware());
// Set up the "/api/inngest" (recommended) routes with the serve handler
app.use("/api/inngest", serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY
}));
// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.get('/', (_, res) => {
  res.send('Server is Live!');
});
app.get('/favicon.ico', (_, res) => res.status(204).end());


app.post('/api/inngest', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['inngest-signature'];
  const signingKey = process.env.INNGEST_SIGNING_KEY;

  const isValid = verifySignature({
    payload: req.body,
    signature,
    signingKey,
  });

  if (!isValid) {
    return res.status(401).send('Signature verification failed');
  }

  // Proceed with webhook logic
  res.status(200).send('Webhook received');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;

