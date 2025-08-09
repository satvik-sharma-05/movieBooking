import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
    _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true, // Automatically generate ObjectId
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
  },
  image : {
    type: String,
    required: true,
  } 
});

const User = mongoose.model("User", userSchema);
export default User;
