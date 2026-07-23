require('dotenv').config();
const mongoose = require('mongoose');
const Inquiry = require('./src/models/inquiry.model');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const isDryRun = process.argv.includes('--dry-run');

async function cleanupLegacyInquiryFields() {
  try {
    if (!MONGO_URI) {
      throw new Error('Missing MONGODB_URI (or MONGO_URI) environment variable');
    }
    await mongoose.connect(MONGO_URI);
    console.log('Connected to database');

    const legacyFilter = {
      $or: [
        { visitorId: { $exists: true } },
        { matchedGigIds: { $exists: true } }
      ]
    };

    const totalWithLegacyFields = await Inquiry.countDocuments(legacyFilter);
    console.log(`Found ${totalWithLegacyFields} inquiry records with legacy fields.`);

    if (isDryRun) {
      console.log('Dry run mode enabled. No data was modified.');
      return;
    }

    if (totalWithLegacyFields === 0) {
      console.log('No cleanup needed.');
      return;
    }

    const updateResult = await Inquiry.updateMany(
      legacyFilter,
      {
        $unset: {
          visitorId: '',
          matchedGigIds: ''
        }
      }
    );

    console.log(`Matched documents: ${updateResult.matchedCount}`);
    console.log(`Modified documents: ${updateResult.modifiedCount}`);
    console.log('Legacy fields cleanup completed successfully.');
  } catch (error) {
    console.error('Failed to cleanup inquiry legacy fields:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

cleanupLegacyInquiryFields();
