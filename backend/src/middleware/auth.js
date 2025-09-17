const jwt = require('jsonwebtoken');
const { createError } = require('./errorHandler');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return next(createError('Access token required', 401, 'UNAUTHORIZED'));
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret);
    req.user = {
      user_id: decoded.user_id,
      email_hash: decoded.email_hash
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      return next(createError('Invalid token', 401, 'INVALID_TOKEN'));
    } else {
      return next(createError('Token verification failed', 401, 'TOKEN_VERIFICATION_FAILED'));
    }
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // Continue without authentication
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(); // Continue without authentication
    }

    const decoded = jwt.verify(token, secret);
    req.user = {
      user_id: decoded.user_id,
      email_hash: decoded.email_hash
    };
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
}

function requireAdmin(req, res, next) {
  // This would check if the user has admin privileges
  // For now, we'll implement a simple check
  const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_KEY;
  
  if (!isAdmin) {
    return next(createError('Admin access required', 403, 'FORBIDDEN'));
  }
  
  next();
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin
};

