import User from "../models/user.model.js";
import { createClerkClient } from "@clerk/backend";
import inngestPkg from "inngest";
import connectDB from "../config/db.js";

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

        // ✅ Type guard to validate payload
        if (event.name !== "clerk/user.created" || event.data?.object !== "user") {
            console.warn("⚠️ Received non-user event:", event.name, event.data?.object);
            return { success: false, error: "Invalid event type or object" };
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
        else console.log("✅ Full user fetched from Clerk:", JSON.stringify(fullUser, null, 2));

        // Extract primary email address safely
        const email =
            fullUser.emailAddresses?.find(e => e.id === fullUser.primaryEmailAddressId)?.emailAddress ||
            minimalUser.email_addresses?.[0]?.email_address ||
            "unknown@example.com";

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

        console.log("📦 Final userData to insert:", userData);

        // Validate required fields
        if (!userData.clerkId || !userData.email || !userData.image || !userData.name) {
            console.warn("⚠️ Incomplete user data:", userData);
            return { success: false, error: "Missing required fields" };
        }
        console.log("📥 Event received:", JSON.stringify(event, null, 2));
        await connectDB();
        console.log("🧠 DB connected inside Inngest function");
        try {
            const result = await User.findOneAndUpdate(
                { clerkId: fullUser.id },
                { $setOnInsert: userData },
                { upsert: true, new: true }
            );

            console.log("✅ User synced to MongoDB:", result);
            return { success: true, userId: fullUser.id };
        } catch (error) {
            console.error("❌ MongoDB insert/update failed:", error.message);
            if (error.code === 11000) {
                console.error("⚠️ Duplicate key error:", error.keyValue);
            }
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

