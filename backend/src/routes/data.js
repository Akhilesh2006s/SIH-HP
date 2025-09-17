const express = require('express');
const { body, validationResult } = require('express-validator');
const { mongoose } = require('../services/database');
const Trip = require('../models/Trip');
const User = require('../models/User');
const ConsentRecord = require('../models/ConsentRecord');
const RewardPoints = require('../models/RewardPoints');
const RewardTransaction = require('../models/RewardTransaction');
const { createError } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { EncryptionService } = require('../services/encryption');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Validation middleware
const validateDataExportRequest = [
  body('format').isIn(['json', 'csv', 'encrypted']).withMessage('Format must be json, csv, or encrypted'),
  body('include_sensitive').isBoolean().withMessage('Include sensitive must be boolean'),
  body('date_range').optional().isObject().withMessage('Date range must be an object'),
  body('date_range.start_date').optional().isISO8601().withMessage('Invalid start date'),
  body('date_range.end_date').optional().isISO8601().withMessage('Invalid end date'),
];

const validateDataDeleteRequest = [
  body('confirmation_token').notEmpty().withMessage('Confirmation token is required'),
  body('delete_all').isBoolean().withMessage('Delete all must be boolean'),
  body('date_range').optional().isObject().withMessage('Date range must be an object'),
  body('date_range.start_date').optional().isISO8601().withMessage('Invalid start date'),
  body('date_range.end_date').optional().isISO8601().withMessage('Invalid end date'),
];

// Request data export endpoint
router.post('/export', authenticateToken, validateDataExportRequest, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user.user_id;
    const { format, include_sensitive, date_range } = req.body;

    // Generate export ID
    const exportId = EncryptionService.generateSecureRandom(16);

    // Get user's encryption key
    const user = await User.findById(userId).select('salt');

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Build query for user's trips
    let query = { user_id: userId };

    if (date_range) {
      if (date_range.start_date) {
        query.start_time = { $gte: new Date(date_range.start_date) };
      }
      if (date_range.end_date) {
        query.start_time = { ...query.start_time, $lte: new Date(date_range.end_date) };
      }
    }

    const trips = await Trip.find(query).sort({ start_time: -1 });

    // Decrypt trip data
    const decryptedTrips = trips.map(trip => {
      try {
        const decryptedData = EncryptionService.decryptTripData(
          trip.encrypted_data,
          user.salt
        );
        return {
          ...decryptedData,
          trip_id: trip.trip_id,
          synced: trip.synced,
          created_at: trip.created_at,
          updated_at: trip.updated_at
        };
      } catch (error) {
        console.error('Failed to decrypt trip:', trip.trip_id, error);
        return null;
      }
    }).filter(trip => trip !== null);

    // Get user's consent records
    const consentRecords = await ConsentRecord.find({ user_id: userId })
      .sort({ consent_timestamp: -1 });

    // Get user's reward data
    const rewardPoints = await RewardPoints.findOne({ user_id: userId });

    const rewardTransactions = await RewardTransaction.find({ user_id: userId })
      .sort({ created_at: -1 });

    // Prepare export data
    const exportData = {
      user_id: userId,
      export_timestamp: new Date().toISOString(),
      export_format: format,
      trips: decryptedTrips,
      consent_records: consentRecords,
      reward_points: rewardPoints,
      reward_transactions: rewardTransactions,
      metadata: {
        total_trips: decryptedTrips.length,
        date_range: date_range || null,
        include_sensitive,
        generated_at: new Date().toISOString()
      }
    };

    // Generate file based on format
    let fileName;
    let fileContent;

    if (format === 'json') {
      fileName = `user_data_${userId}_${exportId}.json`;
      fileContent = JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      fileName = `user_data_${userId}_${exportId}.csv`;
      fileContent = convertToCSV(exportData);
    } else if (format === 'encrypted') {
      fileName = `user_data_${userId}_${exportId}.enc`;
      fileContent = EncryptionService.encrypt(exportData, user.salt);
    } else {
      return next(createError('Unsupported format', 400, 'UNSUPPORTED_FORMAT'));
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../../uploads/exports');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Write file
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, fileContent);

    // Store export record (this would need a new model for exports)
    // For now, we'll skip this step

    const downloadUrl = `/uploads/exports/${fileName}`;

    res.json({
      success: true,
      data: {
        export_id: exportId,
        download_url: downloadUrl,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        file_size: fileContent.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete user data endpoint
router.post('/delete', authenticateToken, validateDataDeleteRequest, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user.user_id;
    const { confirmation_token, delete_all, date_range } = req.body;

    // Verify confirmation token (in a real implementation, this would be more secure)
    if (confirmation_token !== 'user_confirmed') {
      return next(createError('Invalid confirmation token', 400, 'INVALID_CONFIRMATION_TOKEN'));
    }

    // Build query for trips to delete
    let query = { user_id: userId };

    if (!delete_all && date_range) {
      if (date_range.start_date) {
        query.start_time = { $gte: new Date(date_range.start_date) };
      }
      if (date_range.end_date) {
        query.start_time = { ...query.start_time, $lte: new Date(date_range.end_date) };
      }
    }

    const tripsToDelete = await Trip.find(query);
    const deletedTripIds = tripsToDelete.map(trip => trip.trip_id);

    // Delete trips
    await Trip.deleteMany(query);

    // Delete related data
    if (deletedTripIds.length > 0) {
      await RewardTransaction.deleteMany({ trip_id: { $in: deletedTripIds } });
    }

    // If deleting all data, also delete user account and related records
    if (delete_all) {
      await User.findByIdAndDelete(userId);
      await ConsentRecord.deleteMany({ user_id: userId });
      await RewardPoints.deleteMany({ user_id: userId });
      await RewardTransaction.deleteMany({ user_id: userId });
    }

    res.json({
      success: true,
      message: delete_all ? 'All user data deleted successfully' : 'Selected data deleted successfully',
      data: {
        deleted_trip_count: deletedTripIds.length,
        delete_all,
        deleted_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user's data summary endpoint
router.get('/summary', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    // Get trip count
    const tripCount = await Trip.countDocuments({ user_id: userId });

    // Get data size estimate
    const dataSize = await Trip.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: null,
          total_size: { $sum: { $strLenCP: '$encrypted_data' } }
        }
      }
    ]);

    // Get consent status
    const latestConsent = await ConsentRecord.findOne({ user_id: userId })
      .sort({ consent_timestamp: -1 });

    // Get reward points
    const rewardPoints = await RewardPoints.findOne({ user_id: userId });

    res.json({
      success: true,
      data: {
        user_id: userId,
        trip_count: tripCount,
        estimated_data_size: dataSize[0]?.total_size || 0,
        consent_status: latestConsent ? {
          version: latestConsent.consent_version,
          data_sharing: latestConsent.data_sharing_consent,
          analytics: latestConsent.analytics_consent,
          background_tracking: latestConsent.background_tracking_consent,
          timestamp: latestConsent.consent_timestamp
        } : null,
        reward_points: rewardPoints ? {
          total: rewardPoints.points_balance,
          available: rewardPoints.points_balance,
          redeemed: 0 // This would need to be calculated
        } : null,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to convert data to CSV
function convertToCSV(data) {
  const trips = data.trips || [];
  if (trips.length === 0) {
    return 'No trips found';
  }

  // Get all possible fields from trips
  const fields = new Set();
  trips.forEach((trip) => {
    Object.keys(trip).forEach(key => fields.add(key));
  });

  const fieldArray = Array.from(fields);
  
  // Create CSV header
  const header = fieldArray.join(',');
  
  // Create CSV rows
  const rows = trips.map((trip) => {
    return fieldArray.map(field => {
      const value = trip[field];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

module.exports = router;

