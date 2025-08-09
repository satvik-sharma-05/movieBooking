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
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;

