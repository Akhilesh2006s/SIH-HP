const express = require('express');
const { body, validationResult } = require('express-validator');
const anonymizationService = require('../services/anonymizationService');
const { createError } = require('../middleware/errorHandler');
const { requireAdmin } = require('../middleware/auth');
const { EncryptionService } = require('../services/encryption');

const router = express.Router();

// All admin routes require admin authentication
router.use(requireAdmin);

// Validation middleware
const validateAnonymizationRequest = [
  body('start_date').isISO8601().withMessage('Invalid start date'),
  body('end_date').isISO8601().withMessage('Invalid end date'),
  body('anonymization_level').isIn(['basic', 'enhanced', 'maximum']).withMessage('Invalid anonymization level'),
  body('aggregation_zones').isArray().withMessage('Aggregation zones must be an array'),
  body('time_bin_size').isInt({ min: 1, max: 60 }).withMessage('Time bin size must be between 1 and 60 minutes'),
];

// Trigger anonymization pipeline endpoint
router.post('/anonymize', validateAnonymizationRequest, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const {
      start_date,
      end_date,
      anonymization_level,
      aggregation_zones,
      time_bin_size
    } = req.body;

    // Generate job ID
    const jobId = EncryptionService.generateSecureRandom(16);

    // Start anonymization process
    try {
      await anonymizationService.anonymizeTrips();
      
      res.json({
        success: true,
        data: {
          job_id: jobId,
          status: 'completed',
          records_processed: 'unknown', // Would need to track this
          completed_at: new Date().toISOString()
        }
      });
    } catch (error) {
      res.json({
        success: false,
        data: {
          job_id: jobId,
          status: 'failed',
          error_message: error.message,
          failed_at: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get system statistics endpoint
router.get('/stats', async (req, res, next) => {
  try {
    const { mongoose } = require('../services/database');
    const User = require('../models/User');
    const Trip = require('../models/Trip');
    const ConsentRecord = require('../models/ConsentRecord');
    const RewardPoints = require('../models/RewardPoints');

    // Get basic counts
    const [
      totalUsers,
      totalTrips,
      totalConsentRecords,
      totalRewardPoints
    ] = await Promise.all([
      User.countDocuments(),
      Trip.countDocuments(),
      ConsentRecord.countDocuments(),
      RewardPoints.countDocuments()
    ]);

    // Get recent activity (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      recentUsers,
      recentTrips,
      recentConsentRecords
    ] = await Promise.all([
      User.countDocuments({ created_at: { $gte: oneDayAgo } }),
      Trip.countDocuments({ created_at: { $gte: oneDayAgo } }),
      ConsentRecord.countDocuments({ created_at: { $gte: oneDayAgo } })
    ]);

    // Get database health
    const dbHealth = mongoose.connection.readyState === 1;

    res.json({
      success: true,
      data: {
        system: {
          database_status: dbHealth ? 'connected' : 'disconnected',
          uptime_seconds: process.uptime(),
          memory_usage: process.memoryUsage(),
          node_version: process.version
        },
        counts: {
          total_users: totalUsers,
          total_trips: totalTrips,
          total_consent_records: totalConsentRecords,
          total_reward_points: totalRewardPoints
        },
        recent_activity: {
          users_registered_24h: recentUsers,
          trips_created_24h: recentTrips,
          consent_updates_24h: recentConsentRecords
        },
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user management data endpoint
router.get('/users', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    const User = require('../models/User');
    const ConsentRecord = require('../models/ConsentRecord');
    const RewardPoints = require('../models/RewardPoints');

    // Build query
    let query = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { pseudonymized_id: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users with pagination
    const users = await User.find(query)
      .select('-password_hash -salt')
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Get additional data for each user
    const usersWithData = await Promise.all(
      users.map(async (user) => {
        const [consentRecord, rewardPoints] = await Promise.all([
          ConsentRecord.findOne({ user_id: user._id.toString() }).sort({ consent_timestamp: -1 }),
          RewardPoints.findOne({ user_id: user._id.toString() })
        ]);

        return {
          id: user._id.toString(),
          email_hash: user.email,
          pseudonymized_id: user.pseudonymized_id,
          created_at: user.created_at,
          updated_at: user.updated_at,
          consent: consentRecord ? {
            version: consentRecord.consent_version,
            data_sharing: consentRecord.data_sharing_consent,
            analytics: consentRecord.analytics_consent,
            background_tracking: consentRecord.background_tracking_consent,
            timestamp: consentRecord.consent_timestamp
          } : null,
          rewards: rewardPoints ? {
            points_balance: rewardPoints.points_balance,
            last_updated: rewardPoints.last_updated
          } : null
        };
      })
    );

    const totalCount = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users: usersWithData,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          has_more: parseInt(offset) + parseInt(limit) < totalCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get audit logs endpoint
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, action, user_id } = req.query;
    const AuditLog = require('../models/AuditLog');

    // Build query
    let query = {};
    if (action) {
      query.action = { $regex: action, $options: 'i' };
    }
    if (user_id) {
      query.$or = [
        { user_id },
        { admin_user_id: user_id }
      ];
    }

    // Get audit logs
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const totalCount = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          has_more: parseInt(offset) + parseInt(limit) < totalCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Export analytics data endpoint
router.post('/export-analytics', [
  body('start_date').isISO8601().withMessage('Invalid start date'),
  body('end_date').isISO8601().withMessage('Invalid end date'),
  body('format').isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  body('data_types').isArray().withMessage('Data types must be an array')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const { start_date, end_date, format, data_types } = req.body;
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    const exportData = {};

    // Generate requested data types
    if (data_types.includes('od_matrix')) {
      exportData.od_matrix = await anonymizationService.generateODMatrix(startDate, endDate);
    }

    if (data_types.includes('heatmap')) {
      exportData.heatmap = await anonymizationService.generateHeatmap(startDate, endDate);
    }

    if (data_types.includes('trip_chains')) {
      exportData.trip_chains = await anonymizationService.generateTripChainPatterns(startDate, endDate);
    }

    // Add metadata
    exportData.metadata = {
      export_type: 'admin_analytics',
      date_range: { start_date, end_date },
      data_types,
      generated_at: new Date().toISOString(),
      generated_by: 'admin'
    };

    // Generate file content
    let fileContent;
    let fileName;
    let mimeType;

    if (format === 'json') {
      fileName = `analytics_export_${Date.now()}.json`;
      fileContent = JSON.stringify(exportData, null, 2);
      mimeType = 'application/json';
    } else if (format === 'csv') {
      fileName = `analytics_export_${Date.now()}.csv`;
      fileContent = convertAnalyticsToCSV(exportData);
      mimeType = 'text/csv';
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileContent);
  } catch (error) {
    next(error);
  }
});

// Helper function to convert analytics data to CSV
function convertAnalyticsToCSV(data) {
  const lines = [];
  
  // Add metadata
  lines.push('Type,Field,Value');
  lines.push('metadata,export_type,' + data.metadata.export_type);
  lines.push('metadata,date_range_start,' + data.metadata.date_range.start_date);
  lines.push('metadata,date_range_end,' + data.metadata.date_range.end_date);
  lines.push('metadata,generated_at,' + data.metadata.generated_at);
  lines.push('');

  // Add OD matrix data
  if (data.od_matrix) {
    lines.push('OD Matrix Data');
    lines.push('Origin Zone,Destination Zone,Trip Count,Total Distance,Avg Duration');
    data.od_matrix.forEach(entry => {
      lines.push(`${entry.origin_zone},${entry.destination_zone},${entry.trip_count},${entry.total_distance},${entry.avg_duration}`);
    });
    lines.push('');
  }

  // Add heatmap data
  if (data.heatmap) {
    lines.push('Heatmap Data');
    lines.push('Zone,Latitude,Longitude,Trip Count,Avg Duration');
    data.heatmap.forEach(zone => {
      lines.push(`${zone.zone},${zone.latitude},${zone.longitude},${zone.trip_count},${zone.avg_duration}`);
    });
    lines.push('');
  }

  // Add trip chain data
  if (data.trip_chains) {
    lines.push('Trip Chain Data');
    lines.push('Pattern ID,Chain Length,Pattern,Frequency,Avg Duration,Avg Distance');
    data.trip_chains.forEach(pattern => {
      lines.push(`${pattern.pattern_id},${pattern.chain_length},${pattern.pattern.join('|')},${pattern.frequency},${pattern.avg_duration},${pattern.avg_distance}`);
    });
  }

  return lines.join('\n');
}

module.exports = router;

