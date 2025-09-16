import express from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../services/database';
import { createError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { EncryptionService } from '../services/encryption';
import path from 'path';
import fs from 'fs';

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
router.post('/export', authenticateToken, validateDataExportRequest, async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user!.user_id;
    const { format, include_sensitive, date_range } = req.body;

    // Generate export ID
    const exportId = EncryptionService.generateSecureRandom(16);

    // Get user's encryption key
    const user = await db('users')
      .where('user_id', userId)
      .select('encryption_key')
      .first();

    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Build query for user's trips
    let query = db('trips').where('user_id', userId);

    if (date_range) {
      if (date_range.start_date) {
        query = query.where('start_time', '>=', date_range.start_date);
      }
      if (date_range.end_date) {
        query = query.where('start_time', '<=', date_range.end_date);
      }
    }

    const trips = await query.orderBy('start_time', 'desc');

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
    const consentRecords = await db('consent_records')
      .where('user_id', userId)
      .orderBy('consent_timestamp', 'desc');

    // Get user's reward data
    const rewardPoints = await db('reward_points')
      .where('user_id', userId)
      .first();

    const rewardTransactions = await db('reward_transactions')
      .where('user_id', userId)
      .orderBy('created_at', 'desc');

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
    let fileName: string;
    let fileContent: string;

    if (format === 'json') {
      fileName = `user_data_${userId}_${exportId}.json`;
      fileContent = JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      fileName = `user_data_${userId}_${exportId}.csv`;
      fileContent = convertToCSV(exportData);
    } else if (format === 'encrypted') {
      fileName = `user_data_${userId}_${exportId}.enc`;
      fileContent = EncryptionService.encrypt(exportData, user.encryption_key);
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

    // Store export record
    await db('user_data_exports').insert({
      export_id: exportId,
      user_id: userId,
      file_name: fileName,
      file_path: filePath,
      file_size: fileContent.length,
      format,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      created_at: new Date().toISOString()
    });

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
router.post('/delete', authenticateToken, validateDataDeleteRequest, async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user!.user_id;
    const { confirmation_token, delete_all, date_range } = req.body;

    // Verify confirmation token (in a real implementation, this would be more secure)
    if (confirmation_token !== 'user_confirmed') {
      return next(createError('Invalid confirmation token', 400, 'INVALID_CONFIRMATION_TOKEN'));
    }

    // Build query for trips to delete
    let query = db('trips').where('user_id', userId);

    if (!delete_all && date_range) {
      if (date_range.start_date) {
        query = query.where('start_time', '>=', date_range.start_date);
      }
      if (date_range.end_date) {
        query = query.where('start_time', '<=', date_range.end_date);
      }
    }

    const tripsToDelete = await query;
    const deletedTripIds = tripsToDelete.map(trip => trip.trip_id);

    // Delete trips
    await query.del();

    // Delete related data
    if (deletedTripIds.length > 0) {
      await db('reward_transactions')
        .whereIn('trip_id', deletedTripIds)
        .del();
    }

    // If deleting all data, also delete user account and related records
    if (delete_all) {
      await db('users').where('user_id', userId).del();
      await db('consent_records').where('user_id', userId).del();
      await db('reward_points').where('user_id', userId).del();
      await db('reward_transactions').where('user_id', userId).del();
      await db('user_data_exports').where('user_id', userId).del();
    }

    // Log deletion for audit purposes
    await db('data_deletions').insert({
      user_id: userId,
      delete_all,
      date_range: date_range ? JSON.stringify(date_range) : null,
      deleted_trip_count: deletedTripIds.length,
      deleted_trip_ids: JSON.stringify(deletedTripIds),
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      created_at: new Date().toISOString()
    });

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

// Get data export status endpoint
router.get('/export/:exportId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.user_id;
    const { exportId } = req.params;

    const exportRecord = await db('user_data_exports')
      .where('export_id', exportId)
      .where('user_id', userId)
      .first();

    if (!exportRecord) {
      return next(createError('Export not found', 404, 'EXPORT_NOT_FOUND'));
    }

    // Check if export has expired
    const isExpired = new Date(exportRecord.expires_at) < new Date();

    res.json({
      success: true,
      data: {
        export_id: exportRecord.export_id,
        file_name: exportRecord.file_name,
        file_size: exportRecord.file_size,
        format: exportRecord.format,
        download_url: isExpired ? null : `/uploads/exports/${exportRecord.file_name}`,
        expires_at: exportRecord.expires_at,
        is_expired: isExpired,
        created_at: exportRecord.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user's data summary endpoint
router.get('/summary', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.user_id;

    // Get trip count
    const tripCount = await db('trips')
      .where('user_id', userId)
      .count('* as count')
      .first();

    // Get data size estimate
    const dataSize = await db('trips')
      .where('user_id', userId)
      .sum('length(encrypted_data) as total_size')
      .first();

    // Get consent status
    const latestConsent = await db('consent_records')
      .where('user_id', userId)
      .orderBy('consent_timestamp', 'desc')
      .first();

    // Get reward points
    const rewardPoints = await db('reward_points')
      .where('user_id', userId)
      .first();

    res.json({
      success: true,
      data: {
        user_id: userId,
        trip_count: tripCount?.count || 0,
        estimated_data_size: dataSize?.total_size || 0,
        consent_status: latestConsent ? {
          version: latestConsent.consent_version,
          data_sharing: latestConsent.data_sharing_consent,
          analytics: latestConsent.analytics_consent,
          background_tracking: latestConsent.background_tracking_consent,
          timestamp: latestConsent.consent_timestamp
        } : null,
        reward_points: rewardPoints ? {
          total: rewardPoints.total_points,
          available: rewardPoints.available_points,
          redeemed: rewardPoints.redeemed_points
        } : null,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to convert data to CSV
function convertToCSV(data: any): string {
  const trips = data.trips || [];
  if (trips.length === 0) {
    return 'No trips found';
  }

  // Get all possible fields from trips
  const fields = new Set<string>();
  trips.forEach((trip: any) => {
    Object.keys(trip).forEach(key => fields.add(key));
  });

  const fieldArray = Array.from(fields);
  
  // Create CSV header
  const header = fieldArray.join(',');
  
  // Create CSV rows
  const rows = trips.map((trip: any) => {
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

export default router;
