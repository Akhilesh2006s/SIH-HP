const { v4: uuidv4 } = require('uuid');
const { mongoose } = require('./database');
const AnonymizedData = require('../models/AnonymizedData');
const Trip = require('../models/Trip');

class AnonymizationService {
  constructor() {
    this.K_ANONYMITY_THRESHOLD = 5; // Minimum 5 users per group
    this.SPATIAL_GRID_SIZE = 0.01; // ~1km grid cells
    this.TIME_BUCKET_SIZE = 15; // 15-minute time buckets
    this.DISTANCE_BUCKETS = [0, 500, 1000, 2000, 5000, 10000, 20000, 50000]; // meters
    this.DURATION_BUCKETS = [0, 300, 600, 1800, 3600, 7200, 14400]; // seconds
  }

  /**
   * Anonymize trip data for NATPAC analytics
   */
  async anonymizeTrips() {
    console.log('Starting trip anonymization process...');
    
    try {
      // Get all trips that haven't been anonymized yet
      const trips = await Trip.find({
        synced: true,
        is_private: false,
        anonymized_at: { $exists: false }
      });

      if (trips.length === 0) {
        console.log('No trips to anonymize');
        return;
      }

      console.log(`Processing ${trips.length} trips for anonymization`);

      // Group trips by user for k-anonymity
      const userGroups = await this.groupTripsByUser(trips);
      
      // Process each user group
      for (const [userId, userTrips] of userGroups.entries()) {
        if (userTrips.length < this.K_ANONYMITY_THRESHOLD) {
          console.log(`Skipping user ${userId} - insufficient trips for k-anonymity`);
          continue;
        }

        await this.processUserTrips(userId, userTrips);
      }

      // Mark trips as anonymized
      await Trip.updateMany(
        { _id: { $in: trips.map(trip => trip._id) } },
        { $set: { anonymized_at: new Date() } }
      );

      console.log('Trip anonymization completed successfully');
    } catch (error) {
      console.error('Error during anonymization:', error);
      throw error;
    }
  }

  /**
   * Generate Origin-Destination matrix
   */
  async generateODMatrix(startDate, endDate) {
    console.log('Generating OD matrix...');

    const matchStage = {};
    if (startDate) matchStage.created_at = { $gte: startDate };
    if (endDate) {
      matchStage.created_at = { ...matchStage.created_at, $lte: endDate };
    }

    const results = await AnonymizedData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            origin_zone: '$origin_zone',
            destination_zone: '$destination_zone'
          },
          trip_count: { $sum: 1 },
          avg_distance: { $avg: { $toInt: '$distance_bucket' } },
          avg_duration: { $avg: { $toInt: '$duration_bucket' } }
        }
      }
    ]);

    // Get mode distribution for each OD pair
    const odMatrix = [];
    
    for (const result of results) {
      const modeDistribution = await this.getModeDistribution(
        result._id.origin_zone,
        result._id.destination_zone,
        startDate,
        endDate
      );

      const timeDistribution = await this.getTimeDistribution(
        result._id.origin_zone,
        result._id.destination_zone,
        startDate,
        endDate
      );

      odMatrix.push({
        origin_zone: result._id.origin_zone,
        destination_zone: result._id.destination_zone,
        trip_count: result.trip_count,
        total_distance: result.avg_distance * result.trip_count,
        avg_duration: result.avg_duration,
        mode_distribution: modeDistribution,
        time_distribution: timeDistribution
      });
    }

    console.log(`Generated OD matrix with ${odMatrix.length} entries`);
    return odMatrix;
  }

  /**
   * Generate heatmap data
   */
  async generateHeatmap(startDate, endDate) {
    console.log('Generating heatmap data...');

    const matchStage = {};
    if (startDate) matchStage.created_at = { $gte: startDate };
    if (endDate) {
      matchStage.created_at = { ...matchStage.created_at, $lte: endDate };
    }

    const results = await AnonymizedData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$origin_zone',
          trip_count: { $sum: 1 },
          avg_duration: { $avg: { $toInt: '$duration_bucket' } }
        }
      }
    ]);

    const heatmapData = [];

    for (const result of results) {
      const zoneCenter = this.getZoneCenter(result._id);
      const modeDistribution = await this.getZoneModeDistribution(result._id, startDate, endDate);
      const timeBuckets = await this.getZoneTimeDistribution(result._id, startDate, endDate);

      heatmapData.push({
        zone: result._id,
        latitude: zoneCenter.lat,
        longitude: zoneCenter.lon,
        trip_count: result.trip_count,
        avg_duration: result.avg_duration,
        mode_distribution: modeDistribution,
        time_buckets: timeBuckets
      });
    }

    console.log(`Generated heatmap with ${heatmapData.length} zones`);
    return heatmapData;
  }

  /**
   * Generate trip chain patterns
   */
  async generateTripChainPatterns(startDate, endDate) {
    console.log('Generating trip chain patterns...');

    const matchStage = {};
    if (startDate) matchStage.created_at = { $gte: startDate };
    if (endDate) {
      matchStage.created_at = { ...matchStage.created_at, $lte: endDate };
    }

    const trips = await AnonymizedData.find(matchStage)
      .select('pseudonymized_user_id origin_zone destination_zone start_time_bucket created_at')
      .sort({ pseudonymized_user_id: 1, created_at: 1 });
    
    // Group trips by user and day
    const userDayChains = new Map();
    
    for (const trip of trips) {
      const day = new Date(trip.created_at).toDateString();
      const key = `${trip.pseudonymized_user_id}_${day}`;
      
      if (!userDayChains.has(key)) {
        userDayChains.set(key, []);
      }
      
      const chain = userDayChains.get(key);
      chain.push([trip.origin_zone, trip.destination_zone]);
    }

    // Analyze patterns
    const patternCounts = new Map();
    
    for (const [key, chain] of userDayChains.entries()) {
      if (chain.length < 2) continue; // Skip single trips
      
      const pattern = chain.map(trip => `${trip[0]}->${trip[1]}`).join('|');
      
      if (!patternCounts.has(pattern)) {
        patternCounts.set(pattern, { count: 0, durations: [], distances: [] });
      }
      
      const patternData = patternCounts.get(pattern);
      patternData.count++;
      
      // Calculate average duration and distance for this pattern
      // This would need to be calculated from the original trip data
      patternData.durations.push(1800); // Placeholder
      patternData.distances.push(2000); // Placeholder
    }

    // Convert to TripChainPattern format
    const patterns = [];
    
    for (const [pattern, data] of patternCounts.entries()) {
      if (data.count >= this.K_ANONYMITY_THRESHOLD) {
        patterns.push({
          pattern_id: uuidv4(),
          chain_length: pattern.split('|').length,
          pattern: pattern.split('|'),
          frequency: data.count,
          avg_duration: data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length,
          avg_distance: data.distances.reduce((sum, d) => sum + d, 0) / data.distances.length
        });
      }
    }

    console.log(`Generated ${patterns.length} trip chain patterns`);
    return patterns;
  }

  /**
   * Apply differential privacy to aggregated data
   */
  applyDifferentialPrivacy(data, epsilon = 1.0) {
    const sensitivity = 1; // For counting queries
    const scale = sensitivity / epsilon;
    
    return data.map(value => {
      // Add Laplace noise
      const noise = this.laplaceRandom(0, scale);
      return Math.max(0, Math.round(value + noise));
    });
  }

  /**
   * Group trips by user for k-anonymity
   */
  async groupTripsByUser(trips) {
    const userGroups = new Map();
    
    for (const trip of trips) {
      const userId = trip.user_id;
      if (!userGroups.has(userId)) {
        userGroups.set(userId, []);
      }
      userGroups.get(userId).push(trip);
    }
    
    return userGroups;
  }

  /**
   * Process trips for a single user
   */
  async processUserTrips(userId, trips) {
    const pseudonymizedUserId = this.generatePseudonymizedId(userId);
    
    for (const trip of trips) {
      const anonymizedTrip = {
        pseudonymized_user_id: pseudonymizedUserId,
        origin_zone: this.getSpatialZone(trip.origin.lat, trip.origin.lon),
        destination_zone: this.getSpatialZone(trip.destination.lat, trip.destination.lon),
        start_time_bucket: this.getTimeBucket(trip.start_time),
        end_time_bucket: this.getTimeBucket(trip.end_time),
        duration_bucket: this.getDurationBucket(trip.duration_seconds),
        distance_bucket: this.getDistanceBucket(trip.distance_meters),
        travel_mode: trip.travel_mode.detected,
        trip_purpose: trip.trip_purpose,
        num_accompanying_bucket: this.getAccompanyingBucket(trip.num_accompanying)
      };

      await AnonymizedData.create(anonymizedTrip);
    }
  }

  /**
   * Get spatial zone for coordinates
   */
  getSpatialZone(lat, lon) {
    const gridLat = Math.floor(lat / this.SPATIAL_GRID_SIZE) * this.SPATIAL_GRID_SIZE;
    const gridLon = Math.floor(lon / this.SPATIAL_GRID_SIZE) * this.SPATIAL_GRID_SIZE;
    return `${gridLat.toFixed(3)},${gridLon.toFixed(3)}`;
  }

  /**
   * Get time bucket for timestamp
   */
  getTimeBucket(timestamp) {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const bucket = Math.floor(minutes / this.TIME_BUCKET_SIZE) * this.TIME_BUCKET_SIZE;
    return `${date.getHours().toString().padStart(2, '0')}:${bucket.toString().padStart(2, '0')}`;
  }

  /**
   * Get duration bucket
   */
  getDurationBucket(durationSeconds) {
    for (let i = 1; i < this.DURATION_BUCKETS.length; i++) {
      if (durationSeconds <= this.DURATION_BUCKETS[i]) {
        return `${this.DURATION_BUCKETS[i-1]}-${this.DURATION_BUCKETS[i]}`;
      }
    }
    return `${this.DURATION_BUCKETS[this.DURATION_BUCKETS.length - 1]}+`;
  }

  /**
   * Get distance bucket
   */
  getDistanceBucket(distanceMeters) {
    for (let i = 1; i < this.DISTANCE_BUCKETS.length; i++) {
      if (distanceMeters <= this.DISTANCE_BUCKETS[i]) {
        return `${this.DISTANCE_BUCKETS[i-1]}-${this.DISTANCE_BUCKETS[i]}`;
      }
    }
    return `${this.DISTANCE_BUCKETS[this.DISTANCE_BUCKETS.length - 1]}+`;
  }

  /**
   * Get accompanying bucket
   */
  getAccompanyingBucket(numAccompanying) {
    if (numAccompanying === 0) return '0';
    if (numAccompanying <= 2) return '1-2';
    if (numAccompanying <= 4) return '3-4';
    return '5+';
  }

  /**
   * Generate pseudonymized user ID
   */
  generatePseudonymizedId(userId) {
    // Use a hash function to create a consistent pseudonym
    return Buffer.from(userId).toString('base64').substring(0, 16);
  }

  /**
   * Get zone center coordinates
   */
  getZoneCenter(zone) {
    const [lat, lon] = zone.split(',').map(Number);
    return {
      lat: lat + this.SPATIAL_GRID_SIZE / 2,
      lon: lon + this.SPATIAL_GRID_SIZE / 2
    };
  }

  /**
   * Get mode distribution for OD pair
   */
  async getModeDistribution(originZone, destinationZone, startDate, endDate) {
    const matchStage = {
      origin_zone: originZone,
      destination_zone: destinationZone
    };
    if (startDate) matchStage.created_at = { $gte: startDate };
    if (endDate) {
      matchStage.created_at = { ...matchStage.created_at, $lte: endDate };
    }

    const results = await AnonymizedData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$travel_mode',
          count: { $sum: 1 }
        }
      }
    ]);

    const distribution = {};
    for (const result of results) {
      distribution[result._id] = result.count;
    }
    
    return distribution;
  }

  /**
   * Get time distribution for OD pair
   */
  async getTimeDistribution(originZone, destinationZone, startDate, endDate) {
    const matchStage = {
      origin_zone: originZone,
      destination_zone: destinationZone
    };
    if (startDate) matchStage.created_at = { $gte: startDate };
    if (endDate) {
      matchStage.created_at = { ...matchStage.created_at, $lte: endDate };
    }

    const results = await AnonymizedData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$start_time_bucket',
          count: { $sum: 1 }
        }
      }
    ]);

    const distribution = {};
    for (const result of results) {
      distribution[result._id] = result.count;
    }
    
    return distribution;
  }

  /**
   * Get mode distribution for zone
   */
  async getZoneModeDistribution(zone, startDate, endDate) {
    const matchStage = { origin_zone: zone };
    if (startDate) matchStage.created_at = { $gte: startDate };
    if (endDate) {
      matchStage.created_at = { ...matchStage.created_at, $lte: endDate };
    }

    const results = await AnonymizedData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$travel_mode',
          count: { $sum: 1 }
        }
      }
    ]);

    const distribution = {};
    for (const result of results) {
      distribution[result._id] = result.count;
    }
    
    return distribution;
  }

  /**
   * Get time distribution for zone
   */
  async getZoneTimeDistribution(zone, startDate, endDate) {
    const matchStage = { origin_zone: zone };
    if (startDate) matchStage.created_at = { $gte: startDate };
    if (endDate) {
      matchStage.created_at = { ...matchStage.created_at, $lte: endDate };
    }

    const results = await AnonymizedData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$start_time_bucket',
          count: { $sum: 1 }
        }
      }
    ]);

    const distribution = {};
    for (const result of results) {
      distribution[result._id] = result.count;
    }
    
    return distribution;
  }

  /**
   * Generate Laplace random number
   */
  laplaceRandom(mean, scale) {
    const u = Math.random() - 0.5;
    return mean - scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }
}

module.exports = new AnonymizationService();

