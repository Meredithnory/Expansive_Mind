import mongoose from "mongoose";
import { CONTACT_TOPICS } from "../lib/contact";

/** A Contact-page message, kept so the admin feedback inbox can show it. */
const contactMessageSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, maxlength: 80 },
        email: { type: String, required: true, maxlength: 254 },
        topic: { type: String, required: true, enum: CONTACT_TOPICS },
        message: { type: String, required: true, maxlength: 1500 },
        status: {
            type: String,
            enum: ["new", "done"],
            default: "new",
            index: true,
        },
        /** Whether the notice email to Meredith was accepted. */
        emailed: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false },
);

contactMessageSchema.index({ createdAt: -1 });

const ContactMessage =
    mongoose.models.ContactMessage ||
    mongoose.model("ContactMessage", contactMessageSchema);

export default ContactMessage;
