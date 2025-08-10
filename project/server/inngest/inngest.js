import User from "../models/user.model.js";
import { createClerkClient } from "@clerk/backend";
import inngestPkg from "inngest";


// Create Inngest client
const { Inngest } = inngestPkg;
console.log("🚀 Inngest client initialized wit  :", Object.keys(inngestPkg));
export const inngest = new Inngest({ id: "my-app" });
// Create Clerk client
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * 🔄 Sync user creation from Clerk to your database
 */
export const syncUserCreation = inngest.createFunction(
  { id: "sync-user-creation", name: "Sync User Creation" },
  { event: "clerk/user.created" },
  async ({ event, step }) => {
    console.log("📦 Incoming clerk/user.created event:", JSON.stringify(event, null, 2));

    const minimalUser = event.data;
    if (!minimalUser?.id) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    // Step: Fetch full user from Clerk
    const fullUser = await step.run("fetch-full-user", async () => {
      return await clerk.users.getUser(minimalUser.id);
    });

    // Extract primary email address safely
   const email =
  fullUser.emailAddresses?.find(e => e.id === fullUser.primaryEmailAddressId)?.emailAddress ||
  minimalUser.email_addresses?.[0]?.email_address ||
  "unknown@example.com";

    // Fallback to minimal image if needed
    const image = fullUser.imageUrl || minimalUser.image_url || "";

    // Construct user payload
    const userData = {
      clerkId: fullUser.id,
      name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim(),
      email,
      image,
      createdAt: new Date(fullUser.createdAt),
    };

    // Validate required fields
    if (!userData.clerkId || !userData.email) {
      console.warn("⚠️ Incomplete user data:", userData);
      return { success: false, error: "Missing required fields" };
    }

    // Insert into MongoDB
    await connectDB();
    try {
      await User.create(userData);
      console.log("✅ User created successfully:", userData);
      return { success: true, userId: fullUser.id };
    } catch (error) {
      console.error("❌ Error inserting user into MongoDB:", error);
      return { success: false, error: error.message };
    }
  }
);







/**
 * 🔄 Sync user updates from Clerk to your database
 */
export const syncUserUpdate = inngest.createFunction(
  { id: "sync-user-update", name: "Sync User Update" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    console.log("📦 Incoming clerk/user.updated event:", JSON.stringify(event, null, 2));

    const minimalUser = event.data;
    if (!minimalUser || !minimalUser.id) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    try {
      const fullUser = await clerk.users.getUser(minimalUser.id);
console.log("✅ Fetched full user from Clerk:", fullUser);

      const updatedUserData = {
        name: `${fullUser.firstName} ${fullUser.lastName}`,
        email: fullUser.emailAddresses?.[0]?.emailAddress || "",
        image: fullUser.imageUrl || minimalUser.image_url || "",
      };

      await User.findOneAndUpdate({ clerkId: fullUser.id }, updatedUserData, { new: true });
      console.log("✅ User updated successfully:", updatedUserData);
      return { success: true };
    } catch (error) {
      console.error("❌ Error syncing user update:", error);
      console.error("❌ Clerk SDK error:", error);

      throw error;
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

    try {
      await User.findOneAndDelete({ clerkId: minimalUser.id });
      console.log("✅ User deleted successfully:", minimalUser.id);
      return { success: true };
    } catch (error) {
      console.error("❌ Error syncing user deletion:", error);
      throw error;
    }
  }
);



// Export all Inngest functions
export const functions = [syncUserCreation, syncUserUpdate, syncUserDeletion];

