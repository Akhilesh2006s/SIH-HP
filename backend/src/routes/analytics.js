const express = require('express');
const { query, validationResult } = require('express-validator');
const anonymizationService = require('../services/anonymizationService');
const { createError } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');

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
router.get('/od-matrix', optionalAuth, validateODMatrixRequest, async (req, res, next) => {
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

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Generate OD matrix using anonymization service
    const odMatrix = await anonymizationService.generateODMatrix(startDate, endDate);

    // Apply additional filters if needed
    let filteredMatrix = odMatrix;

    if (zones.length > 0) {
      filteredMatrix = filteredMatrix.filter(entry => 
        zones.includes(entry.origin_zone) || zones.includes(entry.destination_zone)
      );
    }

    if (travel_modes.length > 0) {
      filteredMatrix = filteredMatrix.map(entry => ({
        ...entry,
        mode_distribution: Object.fromEntries(
          Object.entries(entry.mode_distribution).filter(([mode]) => 
            travel_modes.includes(mode)
          )
        )
      }));
    }

    res.json({
      success: true,
      data: {
        od_matrix: filteredMatrix,
        metadata: {
          total_od_pairs: filteredMatrix.length,
          date_range: { start_date, end_date },
          filters_applied: {
            time_bins: time_bins.length > 0 ? time_bins : null,
            zones: zones.length > 0 ? zones : null,
            travel_modes: travel_modes.length > 0 ? travel_modes : null
          },
          generated_at: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get heatmap data endpoint
router.get('/heatmap', optionalAuth, validateHeatmapRequest, async (req, res, next) => {
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

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Generate heatmap data using anonymization service
    const heatmapData = await anonymizationService.generateHeatmap(startDate, endDate);

    // Apply additional filters if needed
    let filteredData = heatmapData;

    if (travel_modes.length > 0) {
      filteredData = filteredData.map(zone => ({
        ...zone,
        mode_distribution: Object.fromEntries(
          Object.entries(zone.mode_distribution).filter(([mode]) => 
            travel_modes.includes(mode)
          )
        )
      }));
    }

    res.json({
      success: true,
      data: {
        heatmap: filteredData,
        metadata: {
          total_zones: filteredData.length,
          aggregation_level,
          date_range: { start_date, end_date },
          filters_applied: {
            time_bins: time_bins.length > 0 ? time_bins : null,
            travel_modes: travel_modes.length > 0 ? travel_modes : null
          },
          generated_at: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get trip chain patterns endpoint
router.get('/trip-chains', optionalAuth, validateTripChainRequest, async (req, res, next) => {
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

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Generate trip chain patterns using anonymization service
    const patterns = await anonymizationService.generateTripChainPatterns(startDate, endDate);

    // Apply frequency and length filters
    const filteredPatterns = patterns.filter(pattern => 
      pattern.frequency >= min_frequency && 
      pattern.chain_length <= max_pattern_length
    );

    res.json({
      success: true,
      data: {
        trip_chains: filteredPatterns,
        metadata: {
          total_patterns: filteredPatterns.length,
          min_frequency,
          max_pattern_length,
          date_range: { start_date, end_date },
          generated_at: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get analytics summary endpoint
router.get('/summary', optionalAuth, async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    let startDate, endDate;
    if (start_date && end_date) {
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    } else {
      // Default to last 30 days
      endDate = new Date();
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Generate all analytics data
    const [odMatrix, heatmapData, tripChains] = await Promise.all([
      anonymizationService.generateODMatrix(startDate, endDate),
      anonymizationService.generateHeatmap(startDate, endDate),
      anonymizationService.generateTripChainPatterns(startDate, endDate)
    ]);

    // Calculate summary statistics
    const totalTrips = odMatrix.reduce((sum, entry) => sum + entry.trip_count, 0);
    const totalDistance = odMatrix.reduce((sum, entry) => sum + entry.total_distance, 0);
    const avgDuration = odMatrix.reduce((sum, entry) => sum + entry.avg_duration, 0) / odMatrix.length || 0;

    // Mode distribution
    const modeDistribution = {};
    odMatrix.forEach(entry => {
      Object.entries(entry.mode_distribution).forEach(([mode, count]) => {
        modeDistribution[mode] = (modeDistribution[mode] || 0) + count;
      });
    });

    res.json({
      success: true,
      data: {
        summary: {
          total_trips,
          total_distance_km: Math.round(totalDistance / 1000),
          avg_duration_minutes: Math.round(avgDuration / 60),
          total_zones: heatmapData.length,
          total_patterns: tripChains.length
        },
        mode_distribution,
        top_od_pairs: odMatrix
          .sort((a, b) => b.trip_count - a.trip_count)
          .slice(0, 10),
        top_zones: heatmapData
          .sort((a, b) => b.trip_count - a.trip_count)
          .slice(0, 10),
        date_range: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        },
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

