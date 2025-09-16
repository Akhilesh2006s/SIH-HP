import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { Trip } from '../models/Trip';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { EncryptionService } from '../services/encryption';

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
router.post('/bulk', authenticateToken, validateTripSync, async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const { trips, sync_timestamp } = req.body;
    const userId = req.user!.user_id;

    // Get user's encryption key
    const user = await db('users')
      .where('user_id', userId)
      .select('encryption_key')
      .first();

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    const syncedTrips: string[] = [];
    const failedTrips: Array<{ trip_id: string; error: string }> = [];

    for (const tripData of trips) {
      try {
        // Verify signature
        if (!EncryptionService.verifySignature(
          tripData.encrypted_data,
          tripData.signature,
          user.encryption_key
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
          user.encryption_key
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
        const existingTrip = await db('trips')
          .where('trip_id', trip.trip_id)
          .first();

        if (existingTrip) {
          // Update existing trip
          await db('trips')
            .where('trip_id', trip.trip_id)
            .update({
              ...trip,
              user_id: userId,
              synced: true,
              updated_at: new Date().toISOString()
            });
        } else {
          // Insert new trip
          await db('trips').insert({
            ...trip,
            user_id: userId,
            synced: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
], async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user!.user_id;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get user's encryption key
    const user = await db('users')
      .where('user_id', userId)
      .select('encryption_key')
      .first();

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Get trips from database
    const trips = await db('trips')
      .where('user_id', userId)
      .orderBy('start_time', 'desc')
      .limit(limit)
      .offset(offset);

    // Decrypt trip data
    const decryptedTrips = trips.map(trip => {
      try {
        const decryptedData = EncryptionService.decryptTripData(
          trip.encrypted_data,
          user.encryption_key
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
router.post('/confirm', authenticateToken, validateTripCorrection, async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user!.user_id;
    const { trip_id, corrections } = req.body;

    // Check if trip exists and belongs to user
    const trip = await db('trips')
      .where('trip_id', trip_id)
      .where('user_id', userId)
      .first();

    if (!trip) {
      return next(createError('Trip not found', 404, 'TRIP_NOT_FOUND'));
    }

    // Get user's encryption key
    const user = await db('users')
      .where('user_id', userId)
      .select('encryption_key')
      .first();

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Decrypt trip data
    const decryptedTrip = EncryptionService.decryptTripData(
      trip.encrypted_data,
      user.encryption_key
    );

    // Apply corrections
    const updatedTrip = {
      ...decryptedTrip,
      ...corrections,
      updated_at: new Date().toISOString()
    };

    // Re-encrypt trip data
    const encryptedData = EncryptionService.encryptTripData(updatedTrip, user.encryption_key);

    // Update trip in database
    await db('trips')
      .where('trip_id', trip_id)
      .update({
        encrypted_data: encryptedData,
        updated_at: new Date().toISOString()
      });

    res.json({
      success: true,
      message: 'Trip updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get trip statistics endpoint
router.get('/stats', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.user_id;

    // Get basic trip statistics
    const stats = await db('trips')
      .where('user_id', userId)
      .select(
        db.raw('COUNT(*) as total_trips'),
        db.raw('SUM(duration_seconds) as total_duration'),
        db.raw('SUM(distance_meters) as total_distance'),
        db.raw('AVG(duration_seconds) as avg_duration'),
        db.raw('AVG(distance_meters) as avg_distance')
      )
      .first();

    // Get mode distribution
    const modeStats = await db('trips')
      .where('user_id', userId)
      .select('travel_mode_detected')
      .count('* as count')
      .groupBy('travel_mode_detected');

    // Get purpose distribution
    const purposeStats = await db('trips')
      .where('user_id', userId)
      .select('trip_purpose')
      .count('* as count')
      .groupBy('trip_purpose');

    res.json({
      success: true,
      data: {
        total_trips: stats.total_trips || 0,
        total_duration: stats.total_duration || 0,
        total_distance: stats.total_distance || 0,
        avg_duration: stats.avg_duration || 0,
        avg_distance: stats.avg_distance || 0,
        mode_distribution: modeStats,
        purpose_distribution: purposeStats
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
