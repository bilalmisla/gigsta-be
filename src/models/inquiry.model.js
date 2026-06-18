const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false,
      default: null,
    },
    email: {
      type: String,
      required: false,
      default: null,
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
    fileUploadChoice: {
      type: String,
      enum: ['yes','no', null],
      default: null,
    },
    extractedContent: {
      type: [
        {
          fileName: String,
          fileType: String,
          extractedText: String,
          summary: String,
          keyDetails: [String],
        }
      ],
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
