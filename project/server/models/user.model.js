import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true, // 🔍 speeds up queries by clerkId
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'], // ✅ basic email validation
  },
  image: {
    type: String,
    required: true,
  },
}, {
  timestamps: true, // 🕒 adds createdAt and updatedAt automatically
});

const User = mongoose.model("User", userSchema);
export default User;