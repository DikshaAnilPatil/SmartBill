import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    // IMPORTANT:
    // This connects every expense to the logged-in user.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    date: {
      type: Date,
      required: true,
    },

    paymentMode: {
      type: String,
      required: true,
      trim: true,
    },

    reference: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Paid",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Expense", expenseSchema);