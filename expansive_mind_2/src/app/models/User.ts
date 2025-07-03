import mongoose from "mongoose";
const bcrypt = require("bcrypt");

//MongoDB Schema Form Submission
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
    submittedAt: {
        type: Date,
        default: Date.now,
    },
});

//Fire a function before document is saved to db - first got to salt the password & hash before storing in db
userSchema.pre("save", async function (next) {
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
