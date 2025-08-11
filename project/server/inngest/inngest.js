import User from "../models/user.model.js";
import { createClerkClient } from "@clerk/backend";
import inngestPkg from "inngest";
import connectDB from "../config/db.js";

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

/**
 * 🔄 Sync user creation from Clerk to your database
 */
export const syncUserCreation = inngest.createFunction(
  { id: "sync-user-creation", name: "Sync User Creation" },
  { event: "user.created" },
  async ({ event, step }) => {
    console.log("📦 Incoming user.created event:", JSON.stringify(event, null, 2));

    if (
      !["user.created", "clerk/user.created", "clerk/user.updated"].includes(event.name) ||
      event.data?.object !== "user"
    ) {
      console.warn("⚠️ Invalid event structure:", { name: event?.name, object: event?.data?.object });
      return { success: false, error: "Invalid Clerk webhook payload" };
    }

    const minimalUser = event.data;
    if (!minimalUser?.id) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    let fullUser;
    try {
      fullUser = await clerk.users.getUser(minimalUser.id);
      console.log("✅ Fetched full user from Clerk:", JSON.stringify(fullUser, null, 2));
    } catch (error) {
      console.error("❌ Failed to fetch user from Clerk:", error.message, error.stack);
      return { success: false, error: "Clerk user fetch failed" };
    }

    const email =
      fullUser.emailAddresses?.find(e => e.id === fullUser.primaryEmailAddressId)?.emailAddress ||
      fullUser.emailAddresses?.[0]?.emailAddress ||
      `${fullUser.id}@clerk.temp`;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      console.warn("⚠️ No valid email found for user:", fullUser.id, "using fallback:", email);
      return { success: false, error: "No valid email address" };
    }
    console.log("📧 Extracted email:", email);

    const image = fullUser.imageUrl || "https://default.image/url.png";
    const userData = {
      clerkId: fullUser.id,
      name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim(),
      email,
      image,
      createdAt: new Date(fullUser.createdAt || Date.now()),
    };

    if (!userData.clerkId || !userData.name || !userData.email || !userData.image) {
      console.warn("⚠️ Incomplete user data:", userData);
      return { success: false, error: "Missing required fields" };
    }

    console.log("📦 Final userData:", JSON.stringify(userData, null, 2));
    await connectDB();
    console.log("🧠 DB connected inside Inngest function");

    try {
      const result = await User.findOneAndUpdate(
        { clerkId: userData.clerkId },
        { $set: userData },
        { upsert: true, new: true, runValidators: true }
      );
      if (!result) console.warn("⚠️ No document returned from MongoDB upsert");
      else console.log("✅ User synced to MongoDB:", result);
      return { success: true, userId: fullUser.id };
    } catch (error) {
      console.error("❌ MongoDB insert/update failed:", error.message, error.stack);
      return { success: false, error: error.message };
    }
  }

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