const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { createError } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { EncryptionService } = require('../services/encryption');

const router = express.Router();

// Validation middleware
const validateTripSync = [
  body('trips').isArray().withMessage('Trips must be an array'),
  body('trips.*.trip_id').isUUID().withMessage('Invalid trip ID'),
  body('trips.*.encrypted_data').notEmpty().withMessage('Encrypted data is required'),
  body('trips.*.signature').notEmpty().withMessage('Signature is required'),
  body('sync_timestamp').isISO8601().withMessage('Invalid sync timestamp'),
];

const validateTripCorrection = [
  body('trip_id').isUUID().withMessage('Invalid trip ID'),
  body('corrections').isObject().withMessage('Corrections must be an object'),
];

// Bulk sync trips endpoint
router.post('/bulk', authenticateToken, validateTripSync, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const { trips, sync_timestamp } = req.body;
    const userId = req.user.user_id;

    // Get user's encryption key
    const user = await User.findById(userId).select('salt');

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    const syncedTrips = [];
    const failedTrips = [];

    for (const tripData of trips) {
      try {
        // Verify signature
        if (!EncryptionService.verifySignature(
          tripData.encrypted_data,
          tripData.signature,
          user.salt
        )) {
          failedTrips.push({
            trip_id: tripData.trip_id,
            error: 'Invalid signature'
          });
          continue;
        }

        // Decrypt trip data
        const trip = EncryptionService.decryptTripData(
          tripData.encrypted_data,
          user.salt
        );

        // Validate trip data
        if (!trip.trip_id || !trip.start_time || !trip.end_time) {
          failedTrips.push({
            trip_id: tripData.trip_id,
            error: 'Invalid trip data'
          });
          continue;
        }

        // Check if trip already exists
        const existingTrip = await Trip.findOne({ trip_id: trip.trip_id });

        if (existingTrip) {
          // Update existing trip
          await Trip.findOneAndUpdate(
            { trip_id: trip.trip_id },
            {
              ...trip,
              user_id: userId,
              synced: true,
              updated_at: new Date()
            }
          );
        } else {
          // Insert new trip
          await Trip.create({
            ...trip,
            user_id: userId,
            synced: true
          });
        }

        syncedTrips.push(trip.trip_id);
      } catch (error) {
        console.error('Failed to sync trip:', tripData.trip_id, error);
        failedTrips.push({
          trip_id: tripData.trip_id,
          error: 'Decryption or validation failed'
        });
      }
    }

    res.json({
      success: true,
      data: {
        synced_trips: syncedTrips,
        failed_trips: failedTrips,
        server_timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user trips endpoint
router.get('/', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user.user_id;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Get user's encryption key
    const user = await User.findById(userId).select('salt');

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Get trips from database
    const trips = await Trip.find({ user_id: userId })
      .sort({ start_time: -1 })
      .limit(limit)
      .skip(offset);

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
          user_id: trip.user_id,
          synced: trip.synced,
          created_at: trip.created_at,
          updated_at: trip.updated_at
        };
      } catch (error) {
        console.error('Failed to decrypt trip:', trip.trip_id, error);
        return null;
      }
    }).filter(trip => trip !== null);

    res.json({
      success: true,
      data: {
        trips: decryptedTrips,
        pagination: {
          limit,
          offset,
          total: trips.length,
          has_more: trips.length === limit
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Confirm/correct trip endpoint
router.post('/confirm', authenticateToken, validateTripCorrection, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user.user_id;
    const { trip_id, corrections } = req.body;

    // Check if trip exists and belongs to user
    const trip = await Trip.findOne({ trip_id, user_id: userId });

    if (!trip) {
      return next(createError('Trip not found', 404, 'TRIP_NOT_FOUND'));
    }

    // Get user's encryption key
    const user = await User.findById(userId).select('salt');

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Decrypt trip data
    const decryptedTrip = EncryptionService.decryptTripData(
      trip.encrypted_data,
      user.salt
    );

    // Apply corrections
    const updatedTrip = {
      ...decryptedTrip,
      ...corrections,
      updated_at: new Date()
    };

    // Re-encrypt trip data
    const encryptedData = EncryptionService.encryptTripData(updatedTrip, user.salt);

    // Update trip in database
    await Trip.findOneAndUpdate(
      { trip_id },
      {
        encrypted_data: encryptedData,
        updated_at: new Date()
      }
    );

    res.json({
      success: true,
      message: 'Trip updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get trip statistics endpoint
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    // Get basic trip statistics
    const stats = await Trip.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: null,
          total_trips: { $sum: 1 },
          total_duration: { $sum: '$duration_seconds' },
          total_distance: { $sum: '$distance_meters' },
          avg_duration: { $avg: '$duration_seconds' },
          avg_distance: { $avg: '$distance_meters' }
        }
      }
    ]);

    // Get mode distribution
    const modeStats = await Trip.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: '$travel_mode.detected',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get purpose distribution
    const purposeStats = await Trip.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: '$trip_purpose',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = stats[0] || {
      total_trips: 0,
      total_duration: 0,
      total_distance: 0,
      avg_duration: 0,
      avg_distance: 0
    };

    res.json({
      success: true,
      data: {
        total_trips: result.total_trips,
        total_duration: result.total_duration,
        total_distance: result.total_distance,
        avg_duration: result.avg_duration,
        avg_distance: result.avg_distance,
        mode_distribution: modeStats,
        purpose_distribution: purposeStats
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

