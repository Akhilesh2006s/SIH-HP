import { v4 as uuidv4 } from 'uuid';
import { knex } from './database';
import { Trip } from '../../types/Trip';

interface RewardTransaction {
  id: string;
  user_id: string;
  points_change: number;
  transaction_type: 'trip_completed' | 'trip_verified' | 'fraud_penalty' | 'bonus' | 'redemption';
  description: string;
  trip_id?: string;
  timestamp: Date;
}

interface FraudDetectionResult {
  isFraud: boolean;
  confidence: number;
  reasons: string[];
  penalty: number;
}

interface RewardCalculation {
  basePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  totalPoints: number;
  reasons: string[];
}

export class RewardsService {
  private readonly POINTS_PER_KM = 1;
  private readonly POINTS_PER_MINUTE = 0.1;
  private readonly BONUS_MULTIPLIERS = {
    walking: 1.5,
    cycling: 1.3,
    public_transport: 1.2,
    private_vehicle: 1.0
  };
  private readonly FRAUD_PENALTIES = {
    low: 10,
    medium: 25,
    high: 50,
    severe: 100
  };
  private readonly MIN_TRIP_DISTANCE = 100; // meters
  private readonly MIN_TRIP_DURATION = 60; // seconds
  private readonly MAX_SPEED_THRESHOLDS = {
    walking: 2.0, // m/s
    cycling: 6.0,
    public_transport: 15.0,
    private_vehicle: 30.0
  };

  /**
   * Calculate rewards for a completed trip
   */
  async calculateTripRewards(trip: Trip): Promise<RewardCalculation> {
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
  async awardTripPoints(userId: string, trip: Trip): Promise<RewardTransaction> {
    const rewardCalculation = await this.calculateTripRewards(trip);
    
    // Create reward transaction
    const transaction: RewardTransaction = {
      id: uuidv4(),
      user_id: userId,
      points_change: rewardCalculation.totalPoints,
      transaction_type: rewardCalculation.totalPoints >= 0 ? 'trip_completed' : 'fraud_penalty',
      description: rewardCalculation.reasons.join('; '),
      trip_id: trip.trip_id,
      timestamp: new Date()
    };

    // Save transaction
    await knex('reward_transactions').insert(transaction);

    // Update user's point balance
    await this.updateUserPoints(userId, rewardCalculation.totalPoints);

    return transaction;
  }

  /**
   * Detect fraudulent trips
   */
  async detectFraud(trip: Trip): Promise<FraudDetectionResult> {
    const reasons: string[] = [];
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
  async getUserPoints(userId: string): Promise<number> {
    const result = await knex('reward_points')
      .where('user_id', userId)
      .first();
    
    return result ? result.points_balance : 0;
  }

  /**
   * Get user's reward history
   */
  async getUserRewardHistory(userId: string, limit: number = 50): Promise<RewardTransaction[]> {
    return await knex('reward_transactions')
      .where('user_id', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit);
  }

  /**
   * Redeem points for rewards
   */
  async redeemPoints(userId: string, points: number, description: string): Promise<RewardTransaction> {
    const currentPoints = await this.getUserPoints(userId);
    
    if (currentPoints < points) {
      throw new Error('Insufficient points for redemption');
    }

    const transaction: RewardTransaction = {
      id: uuidv4(),
      user_id: userId,
      points_change: -points,
      transaction_type: 'redemption',
      description,
      timestamp: new Date()
    };

    await knex('reward_transactions').insert(transaction);
    await this.updateUserPoints(userId, -points);

    return transaction;
  }

  /**
   * Get leaderboard (anonymized)
   */
  async getLeaderboard(limit: number = 10): Promise<Array<{ rank: number; points: number; trip_count: number }>> {
    const results = await knex('reward_points')
      .select([
        'points_balance',
        knex.raw('(SELECT COUNT(*) FROM trips WHERE user_id = reward_points.user_id) as trip_count')
      ])
      .orderBy('points_balance', 'desc')
      .limit(limit);

    return results.map((result, index) => ({
      rank: index + 1,
      points: result.points_balance,
      trip_count: result.trip_count
    }));
  }

  /**
   * Calculate base points for a trip
   */
  private calculateBasePoints(trip: Trip): number {
    const distancePoints = Math.floor(trip.distance_meters / 1000) * this.POINTS_PER_KM;
    const durationPoints = Math.floor(trip.duration_seconds / 60) * this.POINTS_PER_MINUTE;
    
    return Math.max(1, distancePoints + durationPoints); // Minimum 1 point
  }

  /**
   * Calculate bonus points for a trip
   */
  private calculateBonusPoints(trip: Trip): number {
    const basePoints = this.calculateBasePoints(trip);
    const mode = trip.travel_mode.detected;
    const multiplier = this.BONUS_MULTIPLIERS[mode] || 1.0;
    
    return Math.floor(basePoints * (multiplier - 1.0));
  }

  /**
   * Get reasons for reward calculation
   */
  private getRewardReasons(trip: Trip, basePoints: number, bonusPoints: number): string[] {
    const reasons: string[] = [];
    
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
  private checkSpeedFraud(trip: Trip): { isFraud: boolean; reason: string; confidence: number; penalty: number } {
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
  private checkDistanceFraud(trip: Trip): { isFraud: boolean; reason: string; confidence: number; penalty: number } {
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
  private async checkDuplicateTrips(trip: Trip): Promise<{ isFraud: boolean; reason: string; confidence: number; penalty: number }> {
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    const startTime = new Date(trip.start_time).getTime();
    const endTime = new Date(trip.end_time).getTime();
    
    const duplicates = await knex('trips')
      .where('user_id', trip.user_id)
      .where('id', '!=', trip.trip_id)
      .where(function() {
        this.whereBetween('start_time', [
          new Date(startTime - timeWindow).toISOString(),
          new Date(startTime + timeWindow).toISOString()
        ]).orWhereBetween('end_time', [
          new Date(endTime - timeWindow).toISOString(),
          new Date(endTime + timeWindow).toISOString()
        ]);
      })
      .whereRaw('ABS(distance_meters - ?) < 50', [trip.distance_meters])
      .count('* as count')
      .first();
    
    if (duplicates && parseInt(duplicates.count) > 0) {
      return {
        isFraud: true,
        reason: `Duplicate trip detected: ${duplicates.count} similar trips found`,
        confidence: 0.9,
        penalty: this.FRAUD_PENALTIES.severe
      };
    }
    
    return { isFraud: false, reason: '', confidence: 0, penalty: 0 };
  }

  /**
   * Check for pattern-based fraud
   */
  private async checkPatternFraud(trip: Trip): Promise<{ isFraud: boolean; reason: string; confidence: number; penalty: number }> {
    // Check for too many trips in a short time
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const recentTrips = await knex('trips')
      .where('user_id', trip.user_id)
      .where('start_time', '>=', oneHourAgo)
      .count('* as count')
      .first();
    
    if (recentTrips && parseInt(recentTrips.count) > 10) {
      return {
        isFraud: true,
        reason: `Too many trips: ${recentTrips.count} trips in the last hour`,
        confidence: 0.7,
        penalty: this.FRAUD_PENALTIES.high
      };
    }
    
    // Check for unrealistic daily patterns
    const today = new Date().toDateString();
    const todayTrips = await knex('trips')
      .where('user_id', trip.user_id)
      .whereRaw('DATE(start_time) = ?', [today])
      .count('* as count')
      .first();
    
    if (todayTrips && parseInt(todayTrips.count) > 50) {
      return {
        isFraud: true,
        reason: `Unrealistic daily pattern: ${todayTrips.count} trips today`,
        confidence: 0.8,
        penalty: this.FRAUD_PENALTIES.severe
      };
    }
    
    return { isFraud: false, reason: '', confidence: 0, penalty: 0 };
  }

  /**
   * Check for sensor data fraud
   */
  private checkSensorFraud(trip: Trip): { isFraud: boolean; reason: string; confidence: number; penalty: number } {
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
  private getPenaltyAmount(confidence: number): number {
    if (confidence >= 0.9) return this.FRAUD_PENALTIES.severe;
    if (confidence >= 0.7) return this.FRAUD_PENALTIES.high;
    if (confidence >= 0.5) return this.FRAUD_PENALTIES.medium;
    return this.FRAUD_PENALTIES.low;
  }

  /**
   * Update user's point balance
   */
  private async updateUserPoints(userId: string, pointsChange: number): Promise<void> {
    await knex('reward_points')
      .insert({
        user_id: userId,
        points_balance: pointsChange,
        last_updated: new Date()
      })
      .onConflict('user_id')
      .merge({
        points_balance: knex.raw('points_balance + ?', [pointsChange]),
        last_updated: new Date()
      });
  }

  /**
   * Verify trip authenticity (manual verification)
   */
  async verifyTrip(tripId: string, isVerified: boolean): Promise<void> {
    const trip = await knex('trips').where('trip_id', tripId).first();
    if (!trip) {
      throw new Error('Trip not found');
    }

    if (isVerified) {
      // Award bonus points for verification
      const bonusTransaction: RewardTransaction = {
        id: uuidv4(),
        user_id: trip.user_id,
        points_change: 5,
        transaction_type: 'trip_verified',
        description: 'Trip manually verified',
        trip_id: tripId,
        timestamp: new Date()
      };

      await knex('reward_transactions').insert(bonusTransaction);
      await this.updateUserPoints(trip.user_id, 5);
    }
  }

  /**
   * Get fraud statistics for admin
   */
  async getFraudStatistics(startDate?: Date, endDate?: Date): Promise<any> {
    let query = knex('reward_transactions')
      .where('transaction_type', 'fraud_penalty');

    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }
    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }

    const fraudTransactions = await query;
    
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

export const rewardsService = new RewardsService();
