const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const ConsentRecord = require('../models/ConsentRecord');
const RewardPoints = require('../models/RewardPoints');
const { createError } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { EncryptionService } = require('../services/encryption');

const router = express.Router();

// Validation middleware
const validateSignup = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('consent_version').notEmpty().withMessage('Consent version is required'),
  body('privacy_settings').isObject().withMessage('Privacy settings are required'),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// Signup endpoint
router.post('/signup', validateSignup, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const { email, password, consent_version, privacy_settings } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createError('User already exists', 409, 'USER_EXISTS'));
    }

    // Generate user ID and encryption key
    const user_id = uuidv4();
    const encryption_key = EncryptionService.generateKey();
    const salt = EncryptionService.generateSalt();

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      email,
      password_hash,
      salt,
      pseudonymized_id: user_id
    });

    await user.save();

    // Create consent record
    const consentRecord = new ConsentRecord({
      user_id: user._id.toString(),
      consent_version,
      background_tracking_consent: privacy_settings.background_tracking || false,
      data_sharing_consent: privacy_settings.data_sharing || false,
      analytics_consent: privacy_settings.analytics || false,
      consent_timestamp: new Date()
    });

    await consentRecord.save();

    // Initialize reward points
    const rewardPoints = new RewardPoints({
      user_id: user._id.toString(),
      points_balance: 0,
      last_updated: new Date()
    });

    await rewardPoints.save();

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { 
        user_id: user._id.toString(),
        email_hash: user.email,
        pseudonymized_id: user.pseudonymized_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email_hash: user.email,
          pseudonymized_id: user.pseudonymized_id,
          created_at: user.created_at
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// Login endpoint
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return next(createError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return next(createError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
    }

    // Generate JWT tokens
    const accessToken = jwt.sign(
      { 
        user_id: user._id.toString(),
        email_hash: user.email,
        pseudonymized_id: user.pseudonymized_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email_hash: user.email,
          pseudonymized_id: user.pseudonymized_id,
          created_at: user.created_at
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return next(createError('Refresh token required', 400, 'REFRESH_TOKEN_REQUIRED'));
    }

    // Verify refresh token
    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { 
        user_id: user._id.toString(),
        email_hash: user.email,
        pseudonymized_id: user.pseudonymized_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.json({
      success: true,
      data: {
        access_token: accessToken
      }
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(createError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN'));
    }
    next(error);
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return next(createError('User not authenticated', 401, 'UNAUTHORIZED'));
    }

    const user = await User.findById(userId).select('-password_hash -salt');
    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Get latest consent record
    const consentRecord = await ConsentRecord.findOne({ user_id: userId })
      .sort({ consent_timestamp: -1 });

    // Get reward points
    const rewardPoints = await RewardPoints.findOne({ user_id: userId });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email_hash: user.email,
          pseudonymized_id: user.pseudonymized_id,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        consent: consentRecord ? {
          version: consentRecord.consent_version,
          background_tracking: consentRecord.background_tracking_consent,
          data_sharing: consentRecord.data_sharing_consent,
          analytics: consentRecord.analytics_consent,
          timestamp: consentRecord.consent_timestamp
        } : null,
        rewards: rewardPoints ? {
          points_balance: rewardPoints.points_balance,
          last_updated: rewardPoints.last_updated
        } : null
      }
    });

  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('email').optional().isEmail().normalizeEmail(),
  body('privacy_settings').optional().isObject()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array()));
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return next(createError('User not authenticated', 401, 'UNAUTHORIZED'));
    }

    const { email, privacy_settings } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return next(createError('User not found', 404, 'USER_NOT_FOUND'));
    }

    // Update email if provided
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(createError('Email already in use', 400, 'EMAIL_IN_USE'));
      }
      user.email = email;
    }

    await user.save();

    // Update privacy settings if provided
    if (privacy_settings) {
      const consentRecord = new ConsentRecord({
        user_id: userId,
        consent_version: '1.0',
        background_tracking_consent: privacy_settings.background_tracking || false,
        data_sharing_consent: privacy_settings.data_sharing || false,
        analytics_consent: privacy_settings.analytics || false,
        consent_timestamp: new Date()
      });

      await consentRecord.save();
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email_hash: user.email,
          pseudonymized_id: user.pseudonymized_id,
          updated_at: user.updated_at
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// Logout endpoint (client-side token removal)
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    // In a more sophisticated implementation, you might want to blacklist the token
    // For now, we'll just return success and let the client remove the token
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

