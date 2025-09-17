const express = require('express');
const { body, query, validationResult } = require('express-validator');
const rewardsService = require('../services/rewardsService');
const { createError } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all reward routes
router.use(authenticateToken);

// Get user's current points
router.get('/points', async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    if (!userId) {
      return next(createError('User not authenticated', 401, 'UNAUTHORIZED'));
    }

    const points = await rewardsService.getUserPoints(userId);
    
    res.json({
      success: true,
      data: {
        points_balance: points,
        user_id: userId
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get user's reward history
router.get('/history', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user.user_id;
    if (!userId) {
      return next(createError('User not authenticated', 401, 'UNAUTHORIZED'));
    }

    const limit = parseInt(req.query.limit) || 50;
    const history = await rewardsService.getUserRewardHistory(userId, limit);
    
    res.json({
      success: true,
      data: {
        transactions: history,
        total_count: history.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Redeem points
router.post('/redeem', [
  body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('description').isString().isLength({ min: 1, max: 255 }).withMessage('Description is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user.user_id;
    if (!userId) {
      return next(createError('User not authenticated', 401, 'UNAUTHORIZED'));
    }

    const { points, description } = req.body;
    
    const transaction = await rewardsService.redeemPoints(userId, points, description);
    
    res.json({
      success: true,
      data: {
        transaction,
        new_balance: await rewardsService.getUserPoints(userId)
      }
    });
  } catch (error) {
    if (error.message === 'Insufficient points for redemption') {
      return next(createError('Insufficient points for redemption', 400, 'INSUFFICIENT_POINTS'));
    }
    next(error);
  }
});

// Get leaderboard (anonymized)
router.get('/leaderboard', [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await rewardsService.getLeaderboard(limit);
    
    res.json({
      success: true,
      data: {
        leaderboard,
        total_entries: leaderboard.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Verify a trip (manual verification)
router.post('/verify-trip', [
  body('trip_id').isUUID().withMessage('Valid trip ID is required'),
  body('is_verified').isBoolean().withMessage('Verification status must be boolean')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user.user_id;
    if (!userId) {
      return next(createError('User not authenticated', 401, 'UNAUTHORIZED'));
    }

    const { trip_id, is_verified } = req.body;
    
    await rewardsService.verifyTrip(trip_id, is_verified);
    
    res.json({
      success: true,
      message: is_verified ? 'Trip verified successfully' : 'Trip verification removed'
    });
  } catch (error) {
    if (error.message === 'Trip not found') {
      return next(createError('Trip not found', 404, 'TRIP_NOT_FOUND'));
    }
    next(error);
  }
});

// Admin: Get fraud statistics
router.get('/admin/fraud-stats', [
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    // Check if user is admin (this would be implemented in auth middleware)
    if (!req.user.isAdmin) {
      return next(createError('Admin access required', 403, 'FORBIDDEN'));
    }

    const { start_date, end_date } = req.query;
    
    let startDate;
    let endDate;
    
    if (start_date) {
      startDate = new Date(start_date);
    }
    if (end_date) {
      endDate = new Date(end_date);
    }

    const fraudStats = await rewardsService.getFraudStatistics(startDate, endDate);
    
    res.json({
      success: true,
      data: fraudStats
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Get all reward transactions
router.get('/admin/transactions', [
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('user_id').optional().isUUID().withMessage('Invalid user ID'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    // Check if user is admin
    if (!req.user.isAdmin) {
      return next(createError('Admin access required', 403, 'FORBIDDEN'));
    }

    const { start_date, end_date, user_id, limit } = req.query;
    
    // This would need to be implemented in the rewards service
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        transactions: [],
        total_count: 0,
        message: 'Admin transaction view not yet implemented'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

