import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: [true, 'Clerk ID is required'],
    unique: true,
    index: true,
    immutable: true // 🛡️ Cannot be changed after creation
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
    index: true
  },
  image: {
    type: String,
    required: [true, 'Profile image is required'],
    validate: {
      validator: (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      message: props => `${props.value} is not a valid URL`
    }
  },
  emailVerified: {
    type: Boolean,
    default: false,
    required: true
  },
  lastSignedIn: {
    type: Date,
    required: false
  },
  metadata: {
    signUpMethod: {
      type: String,
      enum: ['email', 'oauth', 'invite'],
      default: 'email'
    },
    externalAccounts: [{
      provider: {
        type: String,
        enum: ['google', 'github', 'facebook', 'apple', 'microsoft'],
        required: true
      },
      providerId: {
        type: String,
        required: true
      }
    }]
  },
  deleted: {
    type: Boolean,
    default: false,
    select: false // 🚫 Hidden from queries by default
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v; // Remove version key
      delete ret.deleted; // Hide deleted flag
      return ret;
    }
  },
  toObject: {
    virtuals: true
  },
  optimisticConcurrency: true // 🚀 Enable optimistic concurrency control
});

// 📇 Compound index for better query performance
userSchema.index({ email: 1, clerkId: 1 });

// 🔍 Query helper for active users
userSchema.query.active = function() {
  return this.where({ deleted: false });
};

// 🛑 Pre-hook for soft delete
userSchema.pre('find', function() {
  this.where({ deleted: false });
});

userSchema.pre('findOne', function() {
  this.where({ deleted: false });
});

// 🎯 Instance method to soft delete
userSchema.methods.softDelete = async function() {
  this.deleted = true;
  await this.save();
  return this;
};

// 🔄 Virtual for formatted name
userSchema.virtual('nameFormatted').get(function() {
  return this.name.trim();
});

// 🔄 Virtual for avatar URL with size parameter
userSchema.virtual('avatar').get(function() {
  if (this.image.includes('img.clerk.com')) {
    return `${this.image}?width=200&height=200`;
  }
  return this.image;
});

const User = mongoose.model('User', userSchema);

export default User;