import { Inngest } from "inngest";
import User from "../models/user.model.js"; // Assuming you have a User model defined
import { Clerk } from "@clerk/backend";
// Create a client to send and receive events
export const inngest = new Inngest({ id: "my-app" });
const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * 🔄 Sync user creation from Clerk to your database
 */
export const syncUserCreation = inngest.createFunction(
  { id: "sync-user-creation", name: "Sync User Creation" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    console.log("📦 Incoming clerk/user.created event:", JSON.stringify(event, null, 2));

    const minimalUser = event.data;
    if (!minimalUser || !minimalUser.id) {
      console.warn("⚠️ Missing user ID in event");
      return { success: false, error: "Missing user ID" };
    }

    try {
      // ✅ Fetch full user from Clerk
      const fullUser = await clerk.users.getUser(minimalUser.id);

      const email = fullUser.emailAddresses?.[0]?.emailAddress || "";
      const image = fullUser.imageUrl || minimalUser.image_url || "";

      const userData = {
        clerkId: fullUser.id,
        name: `${fullUser.firstName} ${fullUser.lastName}`,
        email,
        image
      };

      await User.create(userData);
      console.log("✅ User created successfully:", userData);
      return { success: true };
    } catch (error) {
      console.error("❌ Error syncing user creation:", error);
      throw error;
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
        try {
            console.log("📦 Incoming clerk/user.updated event:", JSON.stringify(event, null, 2));

            const user = event.data?.user;
            if (!user || !user.id) {
                console.warn("⚠️ Missing user data in clerk/user.updated event:", event);
                return { success: false, error: "Missing user data" };
            }

            const { id, firstName, lastName, emailAddresses, imageUrl } = user;
            const updatedUserData = {
                name: `${firstName} ${lastName}`,
                email: emailAddresses?.[0]?.emailAddress || "",
                image: imageUrl || "",
            };

            await User.findOneAndUpdate({ clerkId: id }, updatedUserData, { new: true });
            console.log("✅ User updated successfully:", updatedUserData);
            return { success: true };
        } catch (error) {
            console.error("❌ Error syncing user update:", error);
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
        try {
            console.log("📦 Incoming clerk/user.deleted event:", JSON.stringify(event, null, 2));

            const user = event.data?.user;
            if (!user || !user.id) {
                console.warn("⚠️ Missing user data in clerk/user.deleted event:", event);
                return { success: false, error: "Missing user data" };
            }

            await User.findOneAndDelete({ clerkId: user.id });
            console.log("✅ User deleted successfully:", user.id);
            return { success: true };
        } catch (error) {
            console.error("❌ Error syncing user deletion:", error);
            throw error;
        }
    }
);

// Export all Inngest functions
export const functions = [syncUserCreation, syncUserUpdate, syncUserDeletion];