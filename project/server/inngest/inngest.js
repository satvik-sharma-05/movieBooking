import User from "../models/user.model.js";
import { createClerkClient } from "@clerk/backend";
import { Inngest } from "inngest";
import connectDB from "../config/db.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Clerk client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
});

// Initialize Inngest
const inngest = new Inngest({
  id: "movie-booking-app",
  name: "Movie Booking Server",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  baseUrl: process.env.NODE_ENV === "production" 
    ? "https://inn.gs" 
    : "http://localhost:8288"
});

// Enhanced logger with context
const createLogger = (context) => ({
  log: (...args) => console.log(`[${new Date().toISOString()}] [${context}]`, ...args),
  warn: (...args) => console.warn(`[${new Date().toISOString()}] [${context}] WARN:`, ...args),
  error: (...args) => console.error(`[${new Date().toISOString()}] [${context}] ERROR:`, ...args),
  debug: (...args) => process.env.DEBUG === "true" ? 
    console.debug(`[${new Date().toISOString()}] [${context}] DEBUG:`, ...args) : null
});

// Helper function to validate user data
const validateUserData = (userData) => {
  if (!userData?.id) throw new Error("Missing user ID");
  if (!userData?.email_addresses?.length) throw new Error("No email addresses found");
  return true;
};

// Helper function to get primary email
const getPrimaryEmail = (user) => {
  return user.email_addresses?.find(e => e.id === user.primaryEmailAddressId) || 
         user.email_addresses?.[0];
};

/**
 * Sync user creation from Clerk to database
 */
export const syncUserCreation = inngest.createFunction(
  { 
    id: "sync-user-creation",
    name: "Sync User Creation",
    retries: 3,
    idempotency: "event.user.id" // Ensure we don't process same user multiple times
  },
  { event: "clerk/user.created" },
  async ({ event, step }) => {
    const log = createLogger("user-creation");
    log.debug("Incoming event:", JSON.stringify(event, null, 2));

    try {
      // Validate event data
      validateUserData(event.data);

      // Connect to DB
      await step.run("db-connect", async () => {
        try {
          await connectDB();
          log.log("Database connected successfully");
        } catch (err) {
          log.error("Database connection failed:", err);
          throw err;
        }
      });

      // Get full user data from Clerk
      const fullUser = await step.run("get-clerk-user", async () => {
        try {
          const user = await clerk.users.getUser(event.data.id);
          log.debug("Fetched user from Clerk:", JSON.stringify(user, null, 2));
          return user;
        } catch (err) {
          log.error("Failed to fetch user from Clerk:", err);
          throw err;
        }
      });

      // Prepare user data
      const primaryEmail = getPrimaryEmail(fullUser);
      if (!primaryEmail?.emailAddress) {
        throw new Error("No valid email address found");
      }

      const userData = {
        clerkId: fullUser.id,
        name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim() || "Anonymous",
        email: primaryEmail.emailAddress.toLowerCase(),
        image: fullUser.imageUrl || "/default-avatar.png",
        emailVerified: primaryEmail.verification?.status === "verified",
        createdAt: new Date(fullUser.createdAt),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        metadata: {
          signUpMethod: fullUser.externalAccounts?.length ? "oauth" : "email",
          externalAccounts: fullUser.externalAccounts?.map(acc => ({
            provider: acc.provider,
            id: acc.providerUserId
          }))
        }
      };

      // Upsert user in database
      const result = await step.run("upsert-user", async () => {
        try {
          const doc = await User.findOneAndUpdate(
            { clerkId: userData.clerkId },
            { $set: userData },
            { 
              upsert: true, 
              new: true, 
              runValidators: true,
              setDefaultsOnInsert: true 
            }
          );
          log.log("User upserted successfully:", doc._id);
          return doc;
        } catch (err) {
          log.error("Database upsert failed:", err);
          throw err;
        }
      });

      return {
        success: true,
        userId: result._id,
        clerkId: result.clerkId,
        email: result.email
      };

    } catch (error) {
      log.error("Failed to process user creation:", error);
      throw error;
    }
  }
);

/**
 * Sync user updates from Clerk to database
 */
export const syncUserUpdate = inngest.createFunction(
  { 
    id: "sync-user-update",
    name: "Sync User Updates",
    retries: 3,
    idempotency: "event.user.id"
  },
  { event: "clerk/user.updated" },
  async ({ event, step }) => {
    const log = createLogger("user-update");
    log.debug("Incoming update event:", JSON.stringify(event, null, 2));

    try {
      // Validate event data
      validateUserData(event.data);

      // Connect to DB
      await step.run("db-connect", async () => {
        try {
          await connectDB();
          log.log("Database connected successfully");
        } catch (err) {
          log.error("Database connection failed:", err);
          throw err;
        }
      });

      // Get full user data from Clerk
      const fullUser = await step.run("get-clerk-user", async () => {
        try {
          const user = await clerk.users.getUser(event.data.id);
          log.debug("Fetched updated user from Clerk:", JSON.stringify(user, null, 2));
          return user;
        } catch (err) {
          log.error("Failed to fetch updated user from Clerk:", err);
          throw err;
        }
      });

      // Prepare update data
      const primaryEmail = getPrimaryEmail(fullUser);
      if (!primaryEmail?.emailAddress) {
        throw new Error("No valid email address found");
      }

      const updateData = {
        name: `${fullUser.firstName || ""} ${fullUser.lastName || ""}`.trim() || "Anonymous",
        email: primaryEmail.emailAddress.toLowerCase(),
        image: fullUser.imageUrl || "/default-avatar.png",
        emailVerified: primaryEmail.verification?.status === "verified",
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        "metadata.externalAccounts": fullUser.externalAccounts?.map(acc => ({
          provider: acc.provider,
          id: acc.providerUserId
        }))
      };

      // Update user in database
      const result = await step.run("update-user", async () => {
        try {
          const doc = await User.findOneAndUpdate(
            { clerkId: fullUser.id },
            { $set: updateData },
            { new: true, runValidators: true }
          );
          
          if (!doc) {
            log.warn("User not found in database, creating new record");
            return await User.create({
              clerkId: fullUser.id,
              ...updateData,
              createdAt: new Date(fullUser.createdAt)
            });
          }
          
          log.log("User updated successfully:", doc._id);
          return doc;
        } catch (err) {
          log.error("Database update failed:", err);
          throw err;
        }
      });

      return {
        success: true,
        userId: result._id,
        clerkId: result.clerkId,
        action: result.createdAt === result.updatedAt ? "created" : "updated"
      };

    } catch (error) {
      log.error("Failed to process user update:", error);
      throw error;
    }
  }
);

/**
 * Sync user deletion from Clerk to database
 */
export const syncUserDeletion = inngest.createFunction(
  { 
    id: "sync-user-deletion",
    name: "Sync User Deletion",
    retries: 3
  },
  { event: "clerk/user.deleted" },
  async ({ event, step }) => {
    const log = createLogger("user-deletion");
    log.debug("Incoming deletion event:", JSON.stringify(event, null, 2));

    try {
      if (!event.data?.id) {
        throw new Error("Missing user ID in deletion event");
      }

      // Connect to DB
      await step.run("db-connect", async () => {
        try {
          await connectDB();
          log.log("Database connected successfully");
        } catch (err) {
          log.error("Database connection failed:", err);
          throw err;
        }
      });

      // Delete user from database
      const result = await step.run("delete-user", async () => {
        try {
          const doc = await User.findOneAndDelete({ clerkId: event.data.id });
          
          if (!doc) {
            log.warn("User not found in database during deletion");
            return { deleted: false };
          }
          
          log.log("User deleted successfully:", doc._id);
          return { deleted: true, userId: doc._id };
        } catch (err) {
          log.error("Database deletion failed:", err);
          throw err;
        }
      });

      // Optionally: Archive data instead of hard delete
      // await User.updateOne(
      //   { clerkId: event.data.id },
      //   { $set: { deleted: true, deletedAt: new Date() } }
      // );

      return {
        success: true,
        ...result
      };

    } catch (error) {
      log.error("Failed to process user deletion:", error);
      throw error;
    }
  }
);

// Export all functions
export const functions = [
  syncUserCreation,
  syncUserUpdate,
  syncUserDeletion
];

export { inngest };