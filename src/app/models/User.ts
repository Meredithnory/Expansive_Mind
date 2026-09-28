import mongoose from "mongoose";
import { DEFAULT_PROFILE_COLOR, PROFILE_COLOR_IDS } from "../lib/profile-colors";
import { BADGE_ROLES, BADGE_SLOTS, BIO_MAX, FIELD_MAX } from "../lib/lab-badge";
const bcrypt = require("bcrypt");

//MongoDB Schema Form User Submission
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: [true, "Please enter a password"],
        minLength: [6, "Minimum password length is 6 characters"],
    },
    tokenVersion: {
        type: Number,
        default: 0,
        min: 0,
    },
    passwordResetTokenHash: {
        type: String,
        index: true,
        sparse: true,
        select: false,
    },
    passwordResetExpiresAt: {
        type: Date,
        select: false,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    plan: {
        type: String,
        enum: ["free", "pro"],
        default: "free",
        index: true,
    },
    accessOverride: {
        type: String,
        enum: ["pro", null],
        default: null,
        index: true,
    },
    profileColor: {
        type: String,
        enum: PROFILE_COLOR_IDS,
        default: DEFAULT_PROFILE_COLOR,
    },
    // Lab badge: what the reader's character wears and their name tag. The
    // coat color is profileColor above. Public on forum and group profiles.
    badge: {
        role: { type: String, enum: [...BADGE_ROLES, null], default: null },
        field: { type: String, maxlength: FIELD_MAX, default: "" },
        head: { type: String, enum: BADGE_SLOTS.head.map((item) => item.id), default: "none" },
        hand: { type: String, enum: BADGE_SLOTS.hand.map((item) => item.id), default: "none" },
        neck: { type: String, enum: BADGE_SLOTS.neck.map((item) => item.id), default: "none" },
        sidekick: { type: String, enum: BADGE_SLOTS.sidekick.map((item) => item.id), default: "none" },
        effect: { type: String, enum: BADGE_SLOTS.effect.map((item) => item.id), default: "none" },
    },
    bio: {
        type: String,
        maxlength: BIO_MAX,
        default: "",
    },
    subscriptionStatus: {
        type: String,
        enum: [
            "none",
            "trialing",
            "active",
            "past_due",
            "canceled",
            "unpaid",
        ],
        default: "none",
    },
    stripeCustomerId: {
        type: String,
        sparse: true,
        unique: true,
    },
    stripeSubscriptionId: {
        type: String,
        sparse: true,
        unique: true,
    },
    stripePriceId: {
        type: String,
    },
    subscriptionCurrentPeriodEnd: {
        type: Date,
    },
    adminTotpEnabled: {
        type: Boolean,
        default: false,
    },
    adminTotpSecret: {
        type: String,
        select: false,
    },
    adminTotpLastStep: {
        type: Number,
        select: false,
    },
});

//Fire a function before document is saved to db - first got to salt the password & hash before storing in db
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        next();
        return;
    }
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

//Fire a function after document has been saved to db
userSchema.post("save", function (doc, next) {
    next();
});

/// storing userSchema under the name "user" into db
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
