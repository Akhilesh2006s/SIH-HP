import express from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../services/database';
import { createError } from '../middleware/errorHandler';
import { requireAdmin } from '../middleware/auth';
import { EncryptionService } from '../services/encryption';

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

    // Store anonymization job
    await db('anonymization_jobs').insert({
      job_id: jobId,
      status: 'queued',
      start_date,
      end_date,
      anonymization_level,
      aggregation_zones: JSON.stringify(aggregation_zones),
      time_bin_size,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Start anonymization process (in a real implementation, this would be queued)
    processAnonymizationJob(jobId, {
      start_date,
      end_date,
      anonymization_level,
      aggregation_zones,
      time_bin_size
    }).catch(error => {
      console.error('Anonymization job failed:', jobId, error);
    });

    res.json({
      success: true,
      data: {
        job_id: jobId,
        status: 'queued',
        estimated_completion: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        records_processed: 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get anonymization job status endpoint
router.get('/anonymize/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await db('anonymization_jobs')
      .where('job_id', jobId)
      .first();

    if (!job) {
      return next(createError('Job not found', 404, 'JOB_NOT_FOUND'));
    }

    res.json({
      success: true,
      data: {
        job_id: job.job_id,
        status: job.status,
        estimated_completion: job.estimated_completion,
        records_processed: job.records_processed || 0,
        error_message: job.error_message,
        created_at: job.created_at,
        updated_at: job.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get system statistics endpoint
router.get('/stats', async (req, res, next) => {
  try {
    // Get user statistics
    const userStats = await db('users')
      .select(
        db.raw('COUNT(*) as total_users'),
        db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_users'),
        db.raw('COUNT(CASE WHEN created_at >= datetime("now", "-30 days") THEN 1 END) as new_users_30d')
      )
      .first();

    // Get trip statistics
    const tripStats = await db('trips')
      .select(
        db.raw('COUNT(*) as total_trips'),
        db.raw('COUNT(CASE WHEN synced = true THEN 1 END) as synced_trips'),
        db.raw('COUNT(CASE WHEN is_private = false THEN 1 END) as public_trips'),
        db.raw('COUNT(CASE WHEN created_at >= datetime("now", "-30 days") THEN 1 END) as new_trips_30d')
      )
      .first();

    // Get anonymized data statistics
    const anonymizedStats = await db('anonymized_trips')
      .select(
        db.raw('COUNT(*) as total_anonymized_trips'),
        db.raw('COUNT(DISTINCT zone_origin) as unique_origin_zones'),
        db.raw('COUNT(DISTINCT zone_destination) as unique_destination_zones')
      )
      .first();

    // Get consent statistics
    const consentStats = await db('consent_records')
      .select(
        db.raw('COUNT(*) as total_consent_records'),
        db.raw('COUNT(CASE WHEN data_sharing_consent = true THEN 1 END) as data_sharing_consent'),
        db.raw('COUNT(CASE WHEN analytics_consent = true THEN 1 END) as analytics_consent')
      )
      .first();

    res.json({
      success: true,
      data: {
        users: userStats,
        trips: tripStats,
        anonymized_data: anonymizedStats,
        consent: consentStats,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get data quality metrics endpoint
router.get('/data-quality', async (req, res, next) => {
  try {
    // Get plausibility score distribution
    const plausibilityStats = await db('trips')
      .select(
        db.raw('AVG(plausibility_score) as avg_plausibility'),
        db.raw('MIN(plausibility_score) as min_plausibility'),
        db.raw('MAX(plausibility_score) as max_plausibility'),
        db.raw('COUNT(CASE WHEN plausibility_score < 0.5 THEN 1 END) as low_plausibility_count')
      )
      .first();

    // Get sensor data quality
    const sensorStats = await db('trips')
      .select(
        db.raw('AVG(CAST(JSON_EXTRACT(sensor_summary, "$.gps_points_count") AS INTEGER)) as avg_gps_points'),
        db.raw('AVG(CAST(JSON_EXTRACT(sensor_summary, "$.average_speed") AS REAL)) as avg_speed'),
        db.raw('COUNT(CASE WHEN CAST(JSON_EXTRACT(sensor_summary, "$.gps_points_count") AS INTEGER) < 5 THEN 1 END) as low_gps_points_count')
      )
      .first();

    // Get travel mode confidence
    const modeConfidenceStats = await db('trips')
      .select(
        db.raw('AVG(travel_mode_confidence) as avg_mode_confidence'),
        db.raw('COUNT(CASE WHEN travel_mode_confidence < 0.6 THEN 1 END) as low_confidence_count')
      )
      .first();

    res.json({
      success: true,
      data: {
        plausibility: plausibilityStats,
        sensor_data: sensorStats,
        mode_confidence: modeConfidenceStats,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Export anonymized data endpoint
router.post('/export', [
  body('start_date').isISO8601().withMessage('Invalid start date'),
  body('end_date').isISO8601().withMessage('Invalid end date'),
  body('format').isIn(['json', 'csv']).withMessage('Format must be json or csv'),
  body('data_types').isArray().withMessage('Data types must be an array'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const { start_date, end_date, format, data_types } = req.body;

    // Generate export ID
    const exportId = EncryptionService.generateSecureRandom(16);

    // Store export request
    await db('data_exports').insert({
      export_id: exportId,
      start_date,
      end_date,
      format,
      data_types: JSON.stringify(data_types),
      status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Process export (in a real implementation, this would be queued)
    processDataExport(exportId, {
      start_date,
      end_date,
      format,
      data_types
    }).catch(error => {
      console.error('Data export failed:', exportId, error);
    });

    res.json({
      success: true,
      data: {
        export_id: exportId,
        status: 'processing',
        estimated_completion: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        download_url: null
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to process anonymization job
async function processAnonymizationJob(jobId: string, params: any): Promise<void> {
  try {
    // Update job status
    await db('anonymization_jobs')
      .where('job_id', jobId)
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      });

    // Get trips to anonymize
    const trips = await db('trips')
      .whereBetween('start_time', [params.start_date, params.end_date])
      .where('is_private', false)
      .where('synced', true);

    let processedCount = 0;

    for (const trip of trips) {
      // Anonymize trip data
      const anonymizedTrip = {
        trip_id: trip.trip_id,
        zone_origin: EncryptionService.generateZoneId(trip.origin_lat, trip.origin_lon, 100),
        zone_destination: EncryptionService.generateZoneId(trip.destination_lat, trip.destination_lon, 100),
        start_time_bin: EncryptionService.roundToTimeBin(trip.start_time, params.time_bin_size),
        end_time_bin: EncryptionService.roundToTimeBin(trip.end_time, params.time_bin_size),
        duration_seconds: trip.duration_seconds,
        distance_meters: trip.distance_meters,
        travel_mode: trip.travel_mode_detected,
        trip_purpose: trip.trip_purpose,
        num_accompanying: trip.num_accompanying,
        sensor_summary: trip.sensor_summary,
        created_at: new Date().toISOString()
      };

      // Insert anonymized trip
      await db('anonymized_trips').insert(anonymizedTrip);

      processedCount++;

      // Update progress every 100 records
      if (processedCount % 100 === 0) {
        await db('anonymization_jobs')
          .where('job_id', jobId)
          .update({
            records_processed: processedCount,
            updated_at: new Date().toISOString()
          });
      }
    }

    // Mark job as completed
    await db('anonymization_jobs')
      .where('job_id', jobId)
      .update({
        status: 'completed',
        records_processed: processedCount,
        updated_at: new Date().toISOString()
      });

  } catch (error) {
    // Mark job as failed
    await db('anonymization_jobs')
      .where('job_id', jobId)
      .update({
        status: 'failed',
        error_message: error.message,
        updated_at: new Date().toISOString()
      });
  }
}

// Helper function to process data export
async function processDataExport(exportId: string, params: any): Promise<void> {
  try {
    // Update export status
    await db('data_exports')
      .where('export_id', exportId)
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      });

    // Get data based on requested types
    let exportData: any = {};

    if (params.data_types.includes('anonymized_trips')) {
      exportData.anonymized_trips = await db('anonymized_trips')
        .whereBetween('start_time_bin', [params.start_date, params.end_date]);
    }

    if (params.data_types.includes('od_matrix')) {
      // Generate OD matrix data
      exportData.od_matrix = await db('anonymized_trips')
        .select(
          'zone_origin',
          'zone_destination',
          'start_time_bin',
          db.raw('COUNT(*) as trip_count')
        )
        .whereBetween('start_time_bin', [params.start_date, params.end_date])
        .groupBy('zone_origin', 'zone_destination', 'start_time_bin');
    }

    // Generate file (in a real implementation, this would create an actual file)
    const fileName = `export_${exportId}.${params.format}`;
    const downloadUrl = `/uploads/exports/${fileName}`;

    // Mark export as completed
    await db('data_exports')
      .where('export_id', exportId)
      .update({
        status: 'completed',
        download_url: downloadUrl,
        file_size: JSON.stringify(exportData).length,
        updated_at: new Date().toISOString()
      });

  } catch (error) {
    // Mark export as failed
    await db('data_exports')
      .where('export_id', exportId)
      .update({
        status: 'failed',
        error_message: error.message,
        updated_at: new Date().toISOString()
      });
  }
}

export default router;
