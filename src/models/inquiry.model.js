const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    projectDetails: {
      type: String,
      required: true,
    },
    budget: {
      type: String,
      default: null,
    },
    gigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gig',
      required: false, // Optional, depending on if they started from a specific gig
    },
    files: {
      type: [String],
      default: [],
    },
    webhookSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inquiry', inquirySchema);
