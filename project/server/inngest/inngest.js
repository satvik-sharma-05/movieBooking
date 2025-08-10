import User from "../models/user.model.js";
import { createClerkClient } from "@clerk/backend";
import inngestPkg from "inngest";
import connectDB from "../config/db.js";

// Create Inngest client
const { Inngest } = inngestPkg;
console.log("🚀 Inngest client initialized wit  :", Object.keys(inngestPkg));
const inngest = new Inngest({
  id: "my-app",
  name: "movie-booking-server",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  baseUrl: process.env.NODE_ENV === "production" ? "https://movie-booking-server-psi.vercel.app/api/inngest" : "http://localhost:8288",
});
// Create Clerk client
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * 🔄 Sync user creation from Clerk to your database
 */
export const syncUserCreation = inngest.createFunction(
    { id: "sync-user-creation", name: "Sync User Creation" },
    { event: "user.created" },
    async ({ event, step }) => {
        console.log("📦 Incoming user.created event:", JSON.stringify(event, null, 2));

        // ✅ Validate event structure
        if (
            !["user.created", "clerk/user.created", "clerk/user.updated"].includes(event.name) ||
            event.data?.object !== "user"
        ) {
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

        // 🧠 Step: Fetch full user from Clerk
        const fullUser = {
            id: minimalUser.id,
            firstName: minimalUser.first_name,
            lastName: minimalUser.last_name,
            emailAddresses: minimalUser.email_addresses,
            primaryEmailAddressId: minimalUser.primary_email_address_id,
            imageUrl: minimalUser.image_url,
            createdAt: minimalUser.created_at
        };

        if (!fullUser || !fullUser.id) {
            console.error("❌ Clerk user fetch failed or returned empty");
            return { success: false, error: "Clerk user fetch failed" };
        }

        // 📭 Extract primary email address
        const email =
            fullUser.emailAddresses?.find(e => e.id === fullUser.primaryEmailAddressId)?.emailAddress ||
            "unknown@example.com";

        // 🖼️ Extract image
        const image = fullUser.imageUrl || "https://default.image/url.png";

        // 🧱 Construct user payload
        const userData = {
            clerkId: fullUser.id,
            name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim(),
            email,
            image,
            createdAt: new Date(fullUser.createdAt),
        };

        // ✅ Validate required fields
        if (!userData.clerkId || !userData.name || !userData.email || !userData.image) {
            console.warn("⚠️ Incomplete user data:", userData);
            return { success: false, error: "Missing required fields" };
        }

        console.log("📦 Final userData:", JSON.stringify(userData, null, 2));

        // 🧠 Connect to DB (if needed)
        await connectDB();
        console.log("🧠 DB connected inside Inngest function");

        // 📥 Upsert user into MongoDB
        try {
            const result = await User.findOneAndUpdate(
                { clerkId: userData.clerkId },
                { $set: userData },
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

export { inngest };