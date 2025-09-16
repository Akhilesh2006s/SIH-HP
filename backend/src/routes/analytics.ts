import express from 'express';
import { query, validationResult } from 'express-validator';
import { db } from '../services/database';
import { createError } from '../middleware/errorHandler';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { EncryptionService } from '../services/encryption';

const router = express.Router();

// Validation middleware
const validateODMatrixRequest = [
  query('start_date').isISO8601().withMessage('Invalid start date'),
  query('end_date').isISO8601().withMessage('Invalid end date'),
  query('time_bins').optional().isArray().withMessage('Time bins must be an array'),
  query('zones').optional().isArray().withMessage('Zones must be an array'),
  query('travel_modes').optional().isArray().withMessage('Travel modes must be an array'),
];

const validateHeatmapRequest = [
  query('start_date').isISO8601().withMessage('Invalid start date'),
  query('end_date').isISO8601().withMessage('Invalid end date'),
  query('time_bins').optional().isArray().withMessage('Time bins must be an array'),
  query('travel_modes').optional().isArray().withMessage('Travel modes must be an array'),
  query('aggregation_level').isIn(['zone', 'grid_100m', 'grid_500m']).withMessage('Invalid aggregation level'),
];

const validateTripChainRequest = [
  query('start_date').isISO8601().withMessage('Invalid start date'),
  query('end_date').isISO8601().withMessage('Invalid end date'),
  query('min_frequency').optional().isInt({ min: 1 }).withMessage('Min frequency must be positive'),
  query('max_pattern_length').optional().isInt({ min: 1, max: 10 }).withMessage('Max pattern length must be between 1 and 10'),
];

// Get OD Matrix endpoint
router.get('/od-matrix', optionalAuth, validateODMatrixRequest, async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const {
      start_date,
      end_date,
      time_bins = [],
      zones = [],
      travel_modes = []
    } = req.query;

    // Build query for anonymized trips
    let query = db('anonymized_trips')
      .select(
        'zone_origin',
        'zone_destination',
        'start_time_bin',
        'travel_mode',
        db.raw('COUNT(*) as trip_count'),
        db.raw('SUM(duration_seconds) as total_duration'),
        db.raw('SUM(distance_meters) as total_distance')
      )
      .whereBetween('start_time_bin', [start_date, end_date])
      .groupBy('zone_origin', 'zone_destination', 'start_time_bin', 'travel_mode');

    // Apply filters
    if (time_bins.length > 0) {
      query = query.whereIn('start_time_bin', time_bins as string[]);
    }

    if (zones.length > 0) {
      query = query.where(function() {
        this.whereIn('zone_origin', zones as string[])
          .orWhereIn('zone_destination', zones as string[]);
      });
    }

    if (travel_modes.length > 0) {
      query = query.whereIn('travel_mode', travel_modes as string[]);
    }

    const results = await query;

    // Format results as OD matrix
    const odMatrix = results.reduce((matrix: any, row: any) => {
      const key = `${row.zone_origin}-${row.zone_destination}-${row.start_time_bin}`;
      if (!matrix[key]) {
        matrix[key] = {
          origin_zone: row.zone_origin,
          destination_zone: row.zone_destination,
          time_bin: row.start_time_bin,
          trip_count: 0,
          total_duration: 0,
          total_distance: 0,
          mode_share: {}
        };
      }
      matrix[key].trip_count += parseInt(row.trip_count);
      matrix[key].total_duration += parseInt(row.total_duration);
      matrix[key].total_distance += parseFloat(row.total_distance);
      matrix[key].mode_share[row.travel_mode] = (matrix[key].mode_share[row.travel_mode] || 0) + parseInt(row.trip_count);
    }, {});

    res.json({
      success: true,
      data: {
        od_matrix: Object.values(odMatrix),
        metadata: {
          start_date,
          end_date,
          total_records: results.length,
          generated_at: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get Heatmap endpoint
router.get('/heatmap', optionalAuth, validateHeatmapRequest, async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const {
      start_date,
      end_date,
      time_bins = [],
      travel_modes = [],
      aggregation_level = 'zone'
    } = req.query;

    // Build query for anonymized trips
    let query = db('anonymized_trips')
      .select(
        'zone_origin as zone_id',
        'start_time_bin',
        'travel_mode',
        db.raw('COUNT(*) as trip_count')
      )
      .whereBetween('start_time_bin', [start_date, end_date])
      .groupBy('zone_origin', 'start_time_bin', 'travel_mode');

    // Apply filters
    if (time_bins.length > 0) {
      query = query.whereIn('start_time_bin', time_bins as string[]);
    }

    if (travel_modes.length > 0) {
      query = query.whereIn('travel_mode', travel_modes as string[]);
    }

    const results = await query;

    // Format results as heatmap data
    const heatmapData = results.map((row: any) => ({
      zone_id: row.zone_id,
      lat: parseFloat(row.zone_id.split('_')[1]) / 1000000, // Convert back from zone ID
      lon: parseFloat(row.zone_id.split('_')[2]) / 1000000,
      trip_count: parseInt(row.trip_count),
      time_bin: row.start_time_bin,
      travel_mode: row.travel_mode,
      created_at: new Date().toISOString()
    }));

    res.json({
      success: true,
      data: {
        heatmap: heatmapData,
        metadata: {
          start_date,
          end_date,
          aggregation_level,
          total_records: results.length,
          generated_at: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get Trip Chain Analysis endpoint
router.get('/trip-chains', optionalAuth, validateTripChainRequest, async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const {
      start_date,
      end_date,
      min_frequency = 5,
      max_pattern_length = 5
    } = req.query;

    // Get trip chains from anonymized data
    const tripChains = await db('anonymized_trips')
      .select(
        'zone_origin',
        'zone_destination',
        'start_time_bin',
        'travel_mode',
        'trip_purpose'
      )
      .whereBetween('start_time_bin', [start_date, end_date])
      .orderBy('start_time_bin');

    // Analyze trip chain patterns
    const chainPatterns: { [key: string]: any } = {};

    // Group trips by time proximity to identify chains
    const timeWindow = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    let currentChain: any[] = [];
    let lastTime = 0;

    for (const trip of tripChains) {
      const tripTime = new Date(trip.start_time_bin).getTime();
      
      if (tripTime - lastTime > timeWindow) {
        // New chain
        if (currentChain.length > 1) {
          const pattern = currentChain.map(t => t.zone_origin).join('->') + '->' + currentChain[currentChain.length - 1].zone_destination;
          if (!chainPatterns[pattern]) {
            chainPatterns[pattern] = {
              chain_pattern: pattern,
              frequency: 0,
              total_duration: 0,
              total_distance: 0,
              modes: new Set(),
              purposes: new Set()
            };
          }
          chainPatterns[pattern].frequency++;
          chainPatterns[pattern].total_duration += currentChain.reduce((sum, t) => sum + t.duration_seconds, 0);
          chainPatterns[pattern].total_distance += currentChain.reduce((sum, t) => sum + t.distance_meters, 0);
          currentChain.forEach(t => {
            chainPatterns[pattern].modes.add(t.travel_mode);
            chainPatterns[pattern].purposes.add(t.trip_purpose);
          });
        }
        currentChain = [trip];
      } else {
        currentChain.push(trip);
      }
      lastTime = tripTime;
    }

    // Process final chain
    if (currentChain.length > 1) {
      const pattern = currentChain.map(t => t.zone_origin).join('->') + '->' + currentChain[currentChain.length - 1].zone_destination;
      if (!chainPatterns[pattern]) {
        chainPatterns[pattern] = {
          chain_pattern: pattern,
          frequency: 0,
          total_duration: 0,
          total_distance: 0,
          modes: new Set(),
          purposes: new Set()
        };
      }
      chainPatterns[pattern].frequency++;
      chainPatterns[pattern].total_duration += currentChain.reduce((sum, t) => sum + t.duration_seconds, 0);
      chainPatterns[pattern].total_distance += currentChain.reduce((sum, t) => sum + t.distance_meters, 0);
      currentChain.forEach(t => {
        chainPatterns[pattern].modes.add(t.travel_mode);
        chainPatterns[pattern].purposes.add(t.trip_purpose);
      });
    }

    // Filter and format results
    const filteredPatterns = Object.values(chainPatterns)
      .filter((pattern: any) => pattern.frequency >= min_frequency)
      .map((pattern: any) => ({
        chain_pattern: pattern.chain_pattern,
        frequency: pattern.frequency,
        average_duration: pattern.total_duration / pattern.frequency,
        average_distance: pattern.total_distance / pattern.frequency,
        modes: Array.from(pattern.modes),
        purposes: Array.from(pattern.purposes),
        created_at: new Date().toISOString()
      }))
      .sort((a: any, b: any) => b.frequency - a.frequency)
      .slice(0, 100); // Limit to top 100 patterns

    res.json({
      success: true,
      data: {
        trip_chains: filteredPatterns,
        metadata: {
          start_date,
          end_date,
          min_frequency,
          max_pattern_length,
          total_patterns: filteredPatterns.length,
          generated_at: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get Mode Share Statistics endpoint
router.get('/mode-share', optionalAuth, [
  query('start_date').isISO8601().withMessage('Invalid start date'),
  query('end_date').isISO8601().withMessage('Invalid end date'),
], async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const { start_date, end_date } = req.query;

    const modeShare = await db('anonymized_trips')
      .select('travel_mode')
      .count('* as count')
      .whereBetween('start_time_bin', [start_date, end_date])
      .groupBy('travel_mode')
      .orderBy('count', 'desc');

    const totalTrips = modeShare.reduce((sum, mode) => sum + parseInt(mode.count), 0);

    const modeShareData = modeShare.map(mode => ({
      mode: mode.travel_mode,
      count: parseInt(mode.count),
      percentage: totalTrips > 0 ? (parseInt(mode.count) / totalTrips * 100).toFixed(1) : 0
    }));

    res.json({
      success: true,
      data: {
        mode_share: modeShareData,
        total_trips: totalTrips,
        metadata: {
          start_date,
          end_date,
          generated_at: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
