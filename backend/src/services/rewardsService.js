const { v4: uuidv4 } = require('uuid');
const { mongoose } = require('./database');
const Trip = require('../models/Trip');
const RewardTransaction = require('../models/RewardTransaction');
const RewardPoints = require('../models/RewardPoints');

class RewardsService {
  constructor() {
    this.POINTS_PER_KM = 1;
    this.POINTS_PER_MINUTE = 0.1;
    this.BONUS_MULTIPLIERS = {
      walking: 1.5,
      cycling: 1.3,
      public_transport: 1.2,
      private_vehicle: 1.0
    };
    this.FRAUD_PENALTIES = {
      low: 10,
      medium: 25,
      high: 50,
      severe: 100
    };
    this.MIN_TRIP_DISTANCE = 100; // meters
    this.MIN_TRIP_DURATION = 60; // seconds
    this.MAX_SPEED_THRESHOLDS = {
      walking: 2.0, // m/s
      cycling: 6.0,
      public_transport: 15.0,
      private_vehicle: 30.0
    };
  }

  /**
   * Calculate rewards for a completed trip
   */
  async calculateTripRewards(trip) {
    // First, check for fraud
    const fraudResult = await this.detectFraud(trip);
    
    if (fraudResult.isFraud) {
      return {
        basePoints: 0,
        bonusPoints: 0,
        penaltyPoints: -fraudResult.penalty,
        totalPoints: -fraudResult.penalty,
        reasons: [`Fraud detected: ${fraudResult.reasons.join(', ')}`]
      };
    }

    // Calculate base points
    const basePoints = this.calculateBasePoints(trip);
    
    // Calculate bonus points
    const bonusPoints = this.calculateBonusPoints(trip);
    
    const totalPoints = basePoints + bonusPoints;
    
    return {
      basePoints,
      bonusPoints,
      penaltyPoints: 0,
      totalPoints,
      reasons: this.getRewardReasons(trip, basePoints, bonusPoints)
    };
  }

  /**
   * Award points to user for a trip
   */
  async awardTripPoints(userId, trip) {
    const rewardCalculation = await this.calculateTripRewards(trip);
    
    // Create reward transaction
    const transaction = {
      user_id: userId,
      points_change: rewardCalculation.totalPoints,
      transaction_type: rewardCalculation.totalPoints >= 0 ? 'trip_completed' : 'fraud_penalty',
      description: rewardCalculation.reasons.join('; '),
      trip_id: trip.trip_id,
      timestamp: new Date()
    };

    // Save transaction
    await RewardTransaction.create(transaction);

    // Update user's point balance
    await this.updateUserPoints(userId, rewardCalculation.totalPoints);

    return transaction;
  }

  /**
   * Detect fraudulent trips
   */
  async detectFraud(trip) {
    const reasons = [];
    let confidence = 0;
    let penalty = 0;

    // Check for impossible speeds
    const speedCheck = this.checkSpeedFraud(trip);
    if (speedCheck.isFraud) {
      reasons.push(speedCheck.reason);
      confidence += speedCheck.confidence;
      penalty += speedCheck.penalty;
    }

    // Check for impossible distances
    const distanceCheck = this.checkDistanceFraud(trip);
    if (distanceCheck.isFraud) {
      reasons.push(distanceCheck.reason);
      confidence += distanceCheck.confidence;
      penalty += distanceCheck.penalty;
    }

    // Check for duplicate trips
    const duplicateCheck = await this.checkDuplicateTrips(trip);
    if (duplicateCheck.isFraud) {
      reasons.push(duplicateCheck.reason);
      confidence += duplicateCheck.confidence;
      penalty += duplicateCheck.penalty;
    }

    // Check for unrealistic patterns
    const patternCheck = await this.checkPatternFraud(trip);
    if (patternCheck.isFraud) {
      reasons.push(patternCheck.reason);
      confidence += patternCheck.confidence;
      penalty += patternCheck.penalty;
    }

    // Check for sensor data inconsistencies
    const sensorCheck = this.checkSensorFraud(trip);
    if (sensorCheck.isFraud) {
      reasons.push(sensorCheck.reason);
      confidence += sensorCheck.confidence;
      penalty += sensorCheck.penalty;
    }

    const isFraud = confidence > 0.5; // Threshold for fraud detection
    const finalPenalty = isFraud ? this.getPenaltyAmount(confidence) : 0;

    return {
      isFraud,
      confidence: Math.min(1.0, confidence),
      reasons,
      penalty: finalPenalty
    };
  }

  /**
   * Get user's current point balance
   */
  async getUserPoints(userId) {
    const result = await RewardPoints.findOne({ user_id: userId });
    return result ? result.points_balance : 0;
  }

  /**
   * Get user's reward history
   */
  async getUserRewardHistory(userId, limit = 50) {
    return await RewardTransaction.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Redeem points for rewards
   */
  async redeemPoints(userId, points, description) {
    const currentPoints = await this.getUserPoints(userId);
    
    if (currentPoints < points) {
      throw new Error('Insufficient points for redemption');
    }

    const transaction = {
      user_id: userId,
      points_change: -points,
      transaction_type: 'redemption',
      description,
      timestamp: new Date()
    };

    await RewardTransaction.create(transaction);
    await this.updateUserPoints(userId, -points);

    return transaction;
  }

  /**
   * Get leaderboard (anonymized)
   */
  async getLeaderboard(limit = 10) {
    const results = await RewardPoints.aggregate([
      {
        $lookup: {
          from: 'trips',
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'trips'
        }
      },
      {
        $project: {
          points_balance: 1,
          trip_count: { $size: '$trips' }
        }
      },
      { $sort: { points_balance: -1 } },
      { $limit: limit }
    ]);

    return results.map((result, index) => ({
      rank: index + 1,
      points: result.points_balance,
      trip_count: result.trip_count
    }));
  }

  /**
   * Calculate base points for a trip
   */
  calculateBasePoints(trip) {
    const distancePoints = Math.floor(trip.distance_meters / 1000) * this.POINTS_PER_KM;
    const durationPoints = Math.floor(trip.duration_seconds / 60) * this.POINTS_PER_MINUTE;
    
    return Math.max(1, distancePoints + durationPoints); // Minimum 1 point
  }

  /**
   * Calculate bonus points for a trip
   */
  calculateBonusPoints(trip) {
    const basePoints = this.calculateBasePoints(trip);
    const mode = trip.travel_mode.detected;
    const multiplier = this.BONUS_MULTIPLIERS[mode] || 1.0;
    
    return Math.floor(basePoints * (multiplier - 1.0));
  }

  /**
   * Get reasons for reward calculation
   */
  getRewardReasons(trip, basePoints, bonusPoints) {
    const reasons = [];
    
    reasons.push(`Base points: ${basePoints} (${Math.floor(trip.distance_meters / 1000)}km + ${Math.floor(trip.duration_seconds / 60)}min)`);
    
    if (bonusPoints > 0) {
      const mode = trip.travel_mode.detected;
      const multiplier = this.BONUS_MULTIPLIERS[mode];
      reasons.push(`Bonus points: ${bonusPoints} (${mode} mode: ${multiplier}x multiplier)`);
    }
    
    if (trip.travel_mode.confidence > 0.8) {
      reasons.push('High confidence travel mode detection');
    }
    
    return reasons;
  }

  /**
   * Check for speed-based fraud
   */
  checkSpeedFraud(trip) {
    const avgSpeed = trip.distance_meters / trip.duration_seconds; // m/s
    const mode = trip.travel_mode.detected;
    const maxSpeed = this.MAX_SPEED_THRESHOLDS[mode] || 30.0;
    
    if (avgSpeed > maxSpeed * 1.5) { // 50% over threshold
      return {
        isFraud: true,
        reason: `Impossible speed: ${avgSpeed.toFixed(1)} m/s for ${mode} mode (max: ${maxSpeed} m/s)`,
        confidence: 0.8,
        penalty: this.FRAUD_PENALTIES.high
      };
    }
    
    if (avgSpeed > maxSpeed) {
      return {
        isFraud: true,
        reason: `Suspicious speed: ${avgSpeed.toFixed(1)} m/s for ${mode} mode (max: ${maxSpeed} m/s)`,
        confidence: 0.4,
        penalty: this.FRAUD_PENALTIES.medium
      };
    }
    
    return { isFraud: false, reason: '', confidence: 0, penalty: 0 };
  }

  /**
   * Check for distance-based fraud
   */
  checkDistanceFraud(trip) {
    if (trip.distance_meters < this.MIN_TRIP_DISTANCE) {
      return {
        isFraud: true,
        reason: `Trip too short: ${trip.distance_meters}m (minimum: ${this.MIN_TRIP_DISTANCE}m)`,
        confidence: 0.6,
        penalty: this.FRAUD_PENALTIES.medium
      };
    }
    
    if (trip.duration_seconds < this.MIN_TRIP_DURATION) {
      return {
        isFraud: true,
        reason: `Trip too brief: ${trip.duration_seconds}s (minimum: ${this.MIN_TRIP_DURATION}s)`,
        confidence: 0.6,
        penalty: this.FRAUD_PENALTIES.medium
      };
    }
    
    return { isFraud: false, reason: '', confidence: 0, penalty: 0 };
  }

  /**
   * Check for duplicate trips
   */
  async checkDuplicateTrips(trip) {
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const startTime = new Date(trip.start_time).getTime();
    const endTime = new Date(trip.end_time).getTime();
    
    const duplicates = await Trip.countDocuments({
      user_id: trip.user_id,
      _id: { $ne: trip._id },
      $or: [
        {
          start_time: {
            $gte: new Date(startTime - timeWindow),
            $lte: new Date(startTime + timeWindow)
          }
        },
        {
          end_time: {
            $gte: new Date(endTime - timeWindow),
            $lte: new Date(endTime + timeWindow)
          }
        }
      ],
      distance_meters: { $gte: trip.distance_meters - 50, $lte: trip.distance_meters + 50 }
    });
    
    if (duplicates > 0) {
      return {
        isFraud: true,
        reason: `Duplicate trip detected: ${duplicates} similar trips found`,
        confidence: 0.9,
        penalty: this.FRAUD_PENALTIES.severe
      };
    }
    
    return { isFraud: false, reason: '', confidence: 0, penalty: 0 };
  }

  /**
   * Check for pattern-based fraud
   */
  async checkPatternFraud(trip) {
    // Check for too many trips in a short time
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentTrips = await Trip.countDocuments({
      user_id: trip.user_id,
      start_time: { $gte: oneHourAgo }
    });
    
    if (recentTrips > 10) {
      return {
        isFraud: true,
        reason: `Too many trips: ${recentTrips} trips in the last hour`,
        confidence: 0.7,
        penalty: this.FRAUD_PENALTIES.high
      };
    }
    
    // Check for unrealistic daily patterns
    const today = new Date().toDateString();
    const todayTrips = await Trip.countDocuments({
      user_id: trip.user_id,
      start_time: {
        $gte: new Date(today),
        $lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000)
      }
    });
    
    if (todayTrips > 50) {
      return {
        isFraud: true,
        reason: `Unrealistic daily pattern: ${todayTrips} trips today`,
        confidence: 0.8,
        penalty: this.FRAUD_PENALTIES.severe
      };
    }
    
    return { isFraud: false, reason: '', confidence: 0, penalty: 0 };
  }

  /**
   * Check for sensor data fraud
   */
  checkSensorFraud(trip) {
    if (!trip.sensor_summary) {
      return { isFraud: false, reason: '', confidence: 0, penalty: 0 };
    }
    
    const { average_speed, variance_accel, gps_points_count } = trip.sensor_summary;
    
    // Check for insufficient GPS points
    if (gps_points_count < 3) {
      return {
        isFraud: true,
        reason: `Insufficient GPS data: only ${gps_points_count} points`,
        confidence: 0.5,
        penalty: this.FRAUD_PENALTIES.medium
      };
    }
    
    // Check for unrealistic acceleration patterns
    if (variance_accel > 10) {
      return {
        isFraud: true,
        reason: `Unrealistic acceleration pattern: variance ${variance_accel.toFixed(2)}`,
        confidence: 0.6,
        penalty: this.FRAUD_PENALTIES.medium
      };
    }
    
    return { isFraud: false, reason: '', confidence: 0, penalty: 0 };
  }

  /**
   * Get penalty amount based on confidence
   */
  getPenaltyAmount(confidence) {
    if (confidence >= 0.9) return this.FRAUD_PENALTIES.severe;
    if (confidence >= 0.7) return this.FRAUD_PENALTIES.high;
    if (confidence >= 0.5) return this.FRAUD_PENALTIES.medium;
    return this.FRAUD_PENALTIES.low;
  }

  /**
   * Update user's point balance
   */
  async updateUserPoints(userId, pointsChange) {
    await RewardPoints.findOneAndUpdate(
      { user_id: userId },
      {
        $inc: { points_balance: pointsChange },
        $set: { last_updated: new Date() }
      },
      { upsert: true }
    );
  }

  /**
   * Verify trip authenticity (manual verification)
   */
  async verifyTrip(tripId, isVerified) {
    const trip = await Trip.findOne({ trip_id: tripId });
    if (!trip) {
      throw new Error('Trip not found');
    }

    if (isVerified) {
      // Award bonus points for verification
      const bonusTransaction = {
        user_id: trip.user_id,
        points_change: 5,
        transaction_type: 'trip_verified',
        description: 'Trip manually verified',
        trip_id: tripId,
        timestamp: new Date()
      };

      await RewardTransaction.create(bonusTransaction);
      await this.updateUserPoints(trip.user_id, 5);
    }
  }

  /**
   * Get fraud statistics for admin
   */
  async getFraudStatistics(startDate, endDate) {
    const matchStage = { transaction_type: 'fraud_penalty' };
    if (startDate) matchStage.timestamp = { $gte: startDate };
    if (endDate) {
      matchStage.timestamp = { ...matchStage.timestamp, $lte: endDate };
    }

    const fraudTransactions = await RewardTransaction.find(matchStage);
    
    const totalFraudPenalties = fraudTransactions.reduce((sum, tx) => sum + Math.abs(tx.points_change), 0);
    const fraudCount = fraudTransactions.length;
    
    return {
      total_fraud_penalties: totalFraudPenalties,
      fraud_count: fraudCount,
      avg_penalty: fraudCount > 0 ? totalFraudPenalties / fraudCount : 0,
      fraud_rate: 0 // This would need to be calculated against total trips
    };
  }
}

module.exports = new RewardsService();

