import { Inngest } from "inngest";
import User from "../models/user.model.js";
import { createClerkClient } from "@clerk/backend";

export const inngest = new Inngest({ id: "my-app" });
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * 🔄 Sync user creation from Clerk to your database
 */
export const syncUserCreation = inngest.createFunction(
  { id: "sync-user-creation", name: "Sync User Creation" },
  { event: "clerk/user.created" },
  async ({ event, step }) => {
    const clerkId = event.data?.id;
    if (!clerkId) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    // Step 1: Fetch full user from Clerk
    const fullUser = await step.run("fetch-user", async () => {
      return await clerk.users.getUser(clerkId);
    });

    // Step 2: Prepare user data
    const userData = {
      clerkId: fullUser.id,
      name: `${fullUser.firstName ?? ""} ${fullUser.lastName ?? ""}`.trim(),
      email: fullUser.emailAddresses?.[0]?.emailAddress ?? "",
      image: fullUser.imageUrl ?? event.data.image_url ?? "",
    };

    // Step 3: Upsert into MongoDB
    await step.run("write-user", async () => {
      await User.updateOne(
        { clerkId: userData.clerkId },
        { $set: userData },
        { upsert: true }
      );
    });

    console.log("✅ User created or updated:", userData);
    return { success: true };
  }
);

/**
 * 🔄 Sync user updates from Clerk to your database
 */
export const syncUserUpdate = inngest.createFunction(
  { id: "sync-user-update", name: "Sync User Update" },
  { event: "clerk/user.updated" },
  async ({ event, step }) => {
    const clerkId = event.data?.id;
    if (!clerkId) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    const fullUser = await step.run("fetch-user", async () => {
      return await clerk.users.getUser(clerkId);
    });

    const updatedUserData = {
      name: `${fullUser.firstName ?? ""} ${fullUser.lastName ?? ""}`.trim(),
      email: fullUser.emailAddresses?.[0]?.emailAddress ?? "",
      image: fullUser.imageUrl ?? event.data.image_url ?? "",
    };

    await step.run("update-user", async () => {
      await User.findOneAndUpdate({ clerkId: fullUser.id }, updatedUserData, { new: true });
    });

    console.log("✅ User updated:", updatedUserData);
    return { success: true };
  }
);

/**
 * 🗑️ Sync user deletion from Clerk to your database
 */
export const syncUserDeletion = inngest.createFunction(
  { id: "sync-user-deletion", name: "Sync User Deletion" },
  { event: "clerk/user.deleted" },
  async ({ event, step }) => {
    const clerkId = event.data?.id;
    if (!clerkId) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    await step.run("delete-user", async () => {
      await User.findOneAndDelete({ clerkId });
    });

    console.log("✅ User deleted:", clerkId);
    return { success: true };
  }
);

// Export all Inngest functions
export const functions = [syncUserCreation, syncUserUpdate, syncUserDeletion];