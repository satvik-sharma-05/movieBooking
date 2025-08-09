import mongoose from 'mongoose';

const connectDB = async () => { 
    try {

       await mongoose.connect(`${process.env.MONGODB_URI}`);
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connected successfully');
        });
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1); // Exit process with failure
    }
};

export default connectDB;
