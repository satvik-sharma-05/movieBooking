import User from "../models/user.model.js";
import { createClerkClient } from "@clerk/backend";
import inngestPkg from "inngest";
import connectDB from "../config/db.js";
import dotenv from "dotenv";
dotenv.config({
  path: "C:/Users/sharm/OneDrive/Desktop/movieBooking/project/server/.env",
});

// Create Clerk client
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Create Inngest client
const { Inngest } = inngestPkg;
console.log("🚀 Inngest client initialized with:", Object.keys(inngestPkg));
const inngest = new Inngest({
  id: "my-app",
  name: "movie-booking-server",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  baseUrl: process.env.NODE_ENV === "production" ? "https://inn.gs" : "http://localhost:8288",
});



// 🔍 Confirm env keys loaded
console.log("🔑 Event Key:", process.env.INNGEST_EVENT_KEY);
console.log("🔐 Signing Key:", process.env.INNGEST_SIGNING_KEY);
console.log("Clerk secret key: ",process.env.CLERK_SECRET_KEY);
console.log("");
console.log("🔗 MongoDB URI:", process.env.MONGODB_URI);
console.log("");
console.log("Ingest singing key: ",process.env.INNGEST_SIGNING_KEY);
/**
 * 🔄 Sync user creation from Clerk to your database
 */
export const syncUserCreation = inngest.createFunction(
  { id: "sync-user-creation", name: "Sync User Creation" },
  { event: "clerk/user.created" },
  async ({ event, step }) => {
    const DEBUG = true;

    const log = (...args) => DEBUG ? console.log.apply(console, args) : undefined;
const warn = (...args) => DEBUG ? console.warn.apply(console, args) : undefined;
const errorLog = (...args) => console.error.apply(console, args);

    log("📦 Incoming event:", JSON.stringify(event, null, 2));

    // Connect to DB
    try {
      await connectDB();
      log("🧠 DB connected inside Inngest function");
    } catch (err) {
      errorLog("❌ DB connection failed:", err.message);
      return { success: false, error: "DB connection failed" };
    }

    // Validate event type and object
    if (
      !["user.created", "clerk/user.created", "clerk/user.updated"].includes(event.name) ||
      event.data?.object !== "user"
    ) {
      warn("⚠️ Skipping non-user event:", { name: event.name, object: event.data?.object });
      return { success: false, error: "Non-user event received" };
    }

    const minimalUser = event.data;
    if (!minimalUser?.id) {
      warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    log("✅ User ID validated:", minimalUser.id);

    // Fetch full user from Clerk
    let fullUser;
    try {
      fullUser = await clerk.users.getUser(minimalUser.id);
      log("✅ Fetched full user from Clerk:", JSON.stringify(fullUser, null, 2));
    } catch (err) {
      errorLog("❌ Failed to fetch user from Clerk:", err.message);
      return { success: false, error: "Clerk user fetch failed" };
    }

    if (!fullUser || !fullUser.id || !fullUser.emailAddresses?.length) {
      warn("⚠️ Clerk returned incomplete user:", fullUser);
      return { success: false, error: "Incomplete Clerk user" };
    }

    // Extract email
    const email =
      fullUser.emailAddresses?.find(e => e.id === fullUser.primaryEmailAddressId)?.emailAddress ||
      fullUser.emailAddresses?.[0]?.emailAddress ||
      `${fullUser.id}@clerk.temp`;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      warn("⚠️ No valid email found for user:", fullUser.id, "using fallback:", email);
      return { success: false, error: "No valid email address" };
    }

    log("📧 Extracted email:", email);

    // Construct user data
    const userData = {
      clerkId: fullUser.id,
      name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim(),
      email: email.toLowerCase(),
      image: fullUser.imageUrl || "https://default.image/url.png",
      createdAt: new Date(fullUser.createdAt || Date.now()),
      source: "clerk-webhook",
      authProvider: "clerk",
    };

    if (!userData.clerkId || !userData.name || !userData.email || !userData.image) {
      warn("⚠️ Incomplete user data:", userData);
      return { success: false, error: "Missing required fields" };
    }

    log("✅ User data constructed:", JSON.stringify(userData, null, 2));

    // Upsert user
    try {
      const result = await step.run("upsert-user", async () => {
        return await User.findOneAndUpdate(
          { clerkId: userData.clerkId },
          { $set: userData },
          { upsert: true, new: true, runValidators: true }
        );
      });

      if (!result) {
        warn("⚠️ No document returned from MongoDB upsert");
        return { success: false, error: "MongoDB upsert returned null" };
      }

      log("✅ User synced to MongoDB:", result);
      return { success: true, userId: fullUser.id };
    } catch (err) {
      errorLog("❌ MongoDB insert/update failed:", err.message);
      return { success: false, error: err.message };
    }
  }
);

/**
 * 🔄 Sync user updates from Clerk to your database
 */
export const syncUserUpdate = inngest.createFunction(
  { id: "sync-user-update", name: "Sync User Update" },
  { event: "user.updated" },
  async ({ event }) => {
    console.log("📦 Incoming clerk/user.updated event:", JSON.stringify(event, null, 2));

    const minimalUser = event.data;
    if (!minimalUser || !minimalUser.id) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    await connectDB();

    try {
      const fullUser = await clerk.users.getUser(minimalUser.id);
      console.log("✅ Fetched full user from Clerk:", JSON.stringify(fullUser, null, 2));

      const email =
        fullUser.emailAddresses?.find(e => e.id === fullUser.primaryEmailAddressId)?.emailAddress ||
        minimalUser.email_addresses?.[0]?.email_address ||
        "unknown@example.com";

      if (email === "unknown@example.com") {
        console.warn("⚠️ No valid email found for user:", fullUser.id);
      }

      const image = fullUser.imageUrl || minimalUser.image_url || "https://default.image/url.png";

      const updatedUserData = {
        name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim(),
        email,
        image,
      };

      console.log("📦 Final updatedUserData:", updatedUserData);

      const result = await User.findOneAndUpdate(
        { clerkId: fullUser.id },
        { $set: updatedUserData },
        { new: true, runValidators: true }
      );

      if (!result) {
        console.warn("⚠️ No matching user found in MongoDB for update:", fullUser.id);
        return { success: false, error: "User not found in DB" };
      }

      console.log("✅ User updated successfully:", result);
      return { success: true };
    } catch (error) {
      console.error("❌ Error syncing user update:", error.message, error.stack);
      return { success: false, error: error.message };
    }
  }
);

/**
 * 🗑️ Sync user deletion from Clerk to your database
 */
export const syncUserDeletion = inngest.createFunction(
  { id: "sync-user-deletion", name: "Sync User Deletion" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    console.log("📦 Incoming clerk/user.deleted event:", JSON.stringify(event, null, 2));

    const minimalUser = event.data;
    if (!minimalUser || !minimalUser.id) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    await connectDB();

    try {
      const result = await User.findOneAndDelete({ clerkId: minimalUser.id });
      if (!result) {
        console.warn("⚠️ No user found for deletion:", minimalUser.id);
      } else {
        console.log("✅ User deleted successfully:", minimalUser.id);
      }
      return { success: true };
    } catch (error) {
      console.error("❌ Error syncing user deletion:", error.message, error.stack);
      return { success: false, error: error.message };
    }
  }
);

// Export all Inngest functions
export const functions = [syncUserCreation, syncUserUpdate, syncUserDeletion];

export { inngest };