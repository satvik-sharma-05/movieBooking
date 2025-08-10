import mongoose from 'mongoose';

const connectDB = async () => {
  console.log("🛠 Attempting MongoDB connection...");

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error("🔥 MongoDB connection error:", err.message);
  });
};

export default connectDB;