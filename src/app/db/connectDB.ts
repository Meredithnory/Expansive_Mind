import mongoose from "mongoose";

const CHAT_TTL_INDEX = "message_90_day_ttl";
let droppedLegacyChatTtl = false;

const dropLegacyChatTtlIndex = async () => {
    if (droppedLegacyChatTtl || mongoose.connection.readyState !== 1) {
        return;
    }
    droppedLegacyChatTtl = true;
    try {
        await mongoose.connection
            .collection("messages")
            .dropIndex(CHAT_TTL_INDEX);
    } catch (error) {
        const code = (error as { code?: number }).code;
        if (code !== 27) {
            droppedLegacyChatTtl = false;
            console.warn("Could not drop legacy chat TTL index", error);
        }
    }
};

//MongoDB connection
const connectDB = async () => {
    if (mongoose.connections[0].readyState) {
        await dropLegacyChatTtlIndex();
        return;
    }
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        await dropLegacyChatTtlIndex();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        throw error;
    }
};

export default connectDB;
