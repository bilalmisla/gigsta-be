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
    visitorId: {
      type: String,
      required: true,
      index: true,
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Inquiry', inquirySchema);
