import { NextResponse } from "next/server";
import mongoose from "mongoose";

// 1. Connect to MongoDB
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGODB_UR, {
      dbName: "framerForms",
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}

// 2. Define Schema & Model
const FormSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    location: String,
  },
  { timestamps: true }
);

const FormSubmission =
  mongoose.models.FormSubmission ||
  mongoose.model("FormSubmission", FormSchema);

// 3. Handle POST requests (webhook from Framer)
export async function POST(req) {
  try {
    await connectDB();

    const body = await req.json();

    // Optional: verify webhook secret
    const secret = process.env.FRAMER_WEBHOOK_SECRET;
    const headerSecret = req.headers.get("x-webhook-secret");
    if (secret && headerSecret !== secret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
    }

    // Save form submissions
    const submission = new FormSubmission(body);
    await submission.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Error saving form:", err);
    return NextResponse.json(
      { error: "Failed to save submission" },
      { status: 500 }
    );
  }
}
