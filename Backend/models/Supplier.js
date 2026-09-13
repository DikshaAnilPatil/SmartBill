import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    contact: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
      validate: {
        validator: function (value) {
          if (!value || String(value).trim() === "") return true;
          return /^\d{10}$/.test(String(value).trim());
        },
        message: "Contact number must be exactly 10 digits.",
      },
    },

    email: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    gst: {
      type: String,
      default: "",
    },

    openingBalance: {
      type: Number,
      default: 0,
    },

    balance: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);