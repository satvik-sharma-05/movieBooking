import { Inngest } from "inngest";
import { use } from "react";
import User from "../models/user.model.js"; // Assuming you have a User model defined in models/User.js
// Create a client to send and receive events
export const inngest = new Inngest({ id: "my-app" });

// Ingest function to save user data to the database
export const syncUserCreation = inngest.createFunction(
  {id: "sync-user-creation", name: "Sync User Creation"},
  { event: "clerk/user.created" },
  async ({ event }) => {
    try {
      const { user } = event.data;
      const { id, firstName, lastName , emailAddresses, imageUrl } = user;
      const userData = {
        _id: id,
        name: `${firstName} ${lastName}`,
        email: emailAddresses[0].emailAddress,
        image: imageUrl || "https://res.cloudinary.com/dz1qj3x7h/image/upload/v1735681234/default-user.png",
      };
      await User.create(userData); // Assuming User is a Mongoose model imported at the top
      console.log("User created successfully:", userData);
      // TODO: Save userData to your database here
      return { success: true };
    } catch(error) {
      console.error("Error syncing user creation:", error);
      throw error; // Re-throw the error to ensure it is logged by Inngest
    }
  }
);

// Ingest function to update user data in the database
export const syncUserUpdate = inngest.createFunction(
    { id: "sync-user-update", name: "Sync User Update" },
    { event: "clerk/user.updated" },
    async ({ event }) => {
        try {
            const { user } = event.data;
            const { id, firstName, lastName, emailAddresses, imageUrl } = user;
            const updatedUserData = {
                name: `${firstName} ${lastName}`,
                email: emailAddresses[0].emailAddress,
                image: imageUrl || "https://res.cloudinary.com/dz1qj3x7h/image/upload/v1735681234/default-user.png",
            };
            await User.findByIdAndUpdate(id, updatedUserData, { new: true });
            console.log("User updated successfully:", updatedUserData);
            return { success: true };
        } catch (error) {
            console.error("Error syncing user update:", error);
            throw error;
        }
    }
);


// Inngest function to delete user data from the database
export const syncUserDeletion = inngest.createFunction(
    { id: "sync-user-deletion", name: "Sync User Deletion" },
    { event: "clerk/user.deleted" },
    async ({ event }) => {
        try {
            const { user } = event.data;
            const { id } = user;
            await User.findByIdAndDelete(id);
            console.log("User deleted successfully:", id);
            return { success: true };
        } catch (error) {
            console.error("Error syncing user deletion:", error);
            throw error;
        }
    }
);

// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation, syncUserUpdate, syncUserDeletion];