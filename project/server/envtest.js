import dotenv from "dotenv";
dotenv.config({ path: "./.env" }); // ✅ Correct path for project/server/.env
console.log("✅ CLERK_SECRET_KEY:", process.env.CLERK_SECRET_KEY);
console.log("✅ INNGEST_EVENT_KEY:", process.env.INNGEST_EVENT_KEY);
console.log("✅ MONGODB_URI:", process.env.MONGODB_URI);