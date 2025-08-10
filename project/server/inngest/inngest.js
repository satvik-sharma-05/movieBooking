import User from "../models/user.model.js";
import { createClerkClient } from "@clerk/backend";
import inngestPkg from "inngest";
import connectDB from "../config/db.js";

// Create Inngest client
const { Inngest } = inngestPkg;
console.log("🚀 Inngest client initialized wit  :", Object.keys(inngestPkg));
export const inngest = new Inngest({
    id:"my-app",
     name: "movie-booking-server",
     eventKey: process.env.INNGEST_EVENT_KEY,
     signingKey: process.env.INNGEST_SIGNING_KEY,
});
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
        console.log("🧪 Debug: event.name =", event.name);
        console.log("🧪 Debug: event.data =", JSON.stringify(event.data, null, 2));

        // ✅ Type guard to validate payload
        if (!event?.name?.startsWith("clerk/user.") || event.data?.object !== "user") {
            console.warn("⚠️ Invalid event structure:", {
                name: event?.name,
                object: event?.data?.object,
            });
            return { success: false, error: "Invalid Clerk webhook payload" };
        }

        const minimalUser = event.data;
        if (!minimalUser?.id) {
            console.warn("⚠️ Missing user ID in event");
            return { success: false, error: "Missing user ID" };
        }

        // Step: Fetch full user from Clerk
        const fullUser = await step.run("fetch-full-user", async () => {
            console.log("🔍 Fetching full user from Clerk:", minimalUser.id);
            try {
                const user = await clerk.users.getUser(minimalUser.id);
                console.log("✅ Clerk user fetched:", user.emailAddresses?.[0]?.emailAddress);
                return user;
            } catch (err) {
                console.error("❌ Clerk fetch failed:", err.message);
                throw new Error("Clerk fetch failed");
            }
        });

        if (!fullUser || !fullUser.id) {
            console.error("❌ Clerk user fetch failed or returned empty");
            return { success: false, error: "Clerk user fetch failed" };
        }

        console.log("✅ Full user fetched from Clerk:", JSON.stringify(fullUser, null, 2));

        // Extract primary email address safely
        const email =
            fullUser.emailAddresses?.find(e => e.id === fullUser.primaryEmailAddressId)?.emailAddress ||
            minimalUser.email_addresses?.[0]?.email_address ||
            "test@example.com"; // ✅ fallback for dev


        console.log("📭 Email addresses from Clerk:", fullUser.emailAddresses);

        if (email === "unknown@example.com") {
            console.warn("⚠️ No valid email found for user:", fullUser.id);
        }

        // Fallback to image
        const image =
            fullUser.imageUrl || minimalUser.image_url || "https://default.image/url.png";

       
        // Construct user payload
        const userData = {
            clerkId: fullUser.id,
            name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim(),
            email,
            image,
            createdAt: new Date(fullUser.createdAt),
        };
// ✅ Now validate
if (!userData.clerkId || !userData.image || !userData.name) {
  console.warn("⚠️ Incomplete user data:", userData);
  return { success: false, error: "Missing required fields" };
}

        console.log("📦 Final userData to insert:", userData);

        // Validate required fields
        if (!userData.clerkId || !userData.email || !userData.image || !userData.name) {
            console.warn("⚠️ Incomplete user data:", userData);
            return { success: false, error: "Missing required fields" };
        }

        await connectDB();
        console.log("🧠 DB connected inside Inngest function");

        console.log("📦 Attempting to insert user:", userData);

        try {
            const result = await User.findOneAndUpdate(
                { clerkId: fullUser.id },
                { $setOnInsert: userData },
                { upsert: true, new: true }
            );

            if (!result) {
                console.warn("⚠️ No document returned from MongoDB upsert");
            } else {
                console.log("✅ User synced to MongoDB:", result);
            }

            return { success: true, userId: fullUser.id };
        } catch (error) {
            console.error("❌ MongoDB insert/update failed:", error);
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

            const image =
                fullUser.imageUrl || minimalUser.image_url || "https://default.image/url.png";

            const updatedUserData = {
                name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim(),
                email,
                image,
            };

            console.log("📦 Final updatedUserData:", updatedUserData);

            const result = await User.findOneAndUpdate(
                { clerkId: fullUser.id },
                { $set: updatedUserData },
                { new: true }
            );

            if (!result) {
                console.warn("⚠️ No matching user found in MongoDB for update:", fullUser.id);
                return { success: false, error: "User not found in DB" };
            }

            console.log("✅ User updated successfully:", result);
            return { success: true };
        } catch (error) {
            console.error("❌ Error syncing user update:", error.message);
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

