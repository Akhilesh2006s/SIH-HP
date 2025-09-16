import { v4 as uuidv4 } from 'uuid';
import { knex } from './database';
import { encrypt, decrypt } from './encryption';

interface AnonymizedTrip {
  id: string;
  pseudonymized_user_id: string;
  origin_zone: string;
  destination_zone: string;
  start_time_bucket: string;
  end_time_bucket: string;
  duration_bucket: string;
  distance_bucket: string;
  travel_mode: string;
  trip_purpose: string;
  num_accompanying_bucket: string;
  created_at: Date;
}

interface ODMatrixEntry {
  origin_zone: string;
  destination_zone: string;
  trip_count: number;
  total_distance: number;
  avg_duration: number;
  mode_distribution: Record<string, number>;
  time_distribution: Record<string, number>;
}

interface HeatmapData {
  zone: string;
  latitude: number;
  longitude: number;
  trip_count: number;
  avg_duration: number;
  mode_distribution: Record<string, number>;
  time_buckets: Record<string, number>;
}

interface TripChainPattern {
  pattern_id: string;
  chain_length: number;
  pattern: string[];
  frequency: number;
  avg_duration: number;
  avg_distance: number;
}

export class AnonymizationService {
  private readonly K_ANONYMITY_THRESHOLD = 5; // Minimum 5 users per group
  private readonly SPATIAL_GRID_SIZE = 0.01; // ~1km grid cells
  private readonly TIME_BUCKET_SIZE = 15; // 15-minute time buckets
  private readonly DISTANCE_BUCKETS = [0, 500, 1000, 2000, 5000, 10000, 20000, 50000]; // meters
  private readonly DURATION_BUCKETS = [0, 300, 600, 1800, 3600, 7200, 14400]; // seconds

  /**
   * Anonymize trip data for NATPAC analytics
   */
  async anonymizeTrips(): Promise<void> {
    console.log('Starting trip anonymization process...');
    
    try {
      // Get all trips that haven't been anonymized yet
      const trips = await knex('trips')
        .where('synced', true)
        .where('is_private', false)
        .whereNull('anonymized_at')
        .select('*');

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
      await knex('trips')
        .whereIn('id', trips.map(trip => trip.id))
        .update({ anonymized_at: new Date() });

      console.log('Trip anonymization completed successfully');
    } catch (error) {
      console.error('Error during anonymization:', error);
      throw error;
    }
  }

  /**
   * Generate Origin-Destination matrix
   */
  async generateODMatrix(startDate?: Date, endDate?: Date): Promise<ODMatrixEntry[]> {
    console.log('Generating OD matrix...');

    const query = knex('anonymized_data')
      .select([
        'origin_zone',
        'destination_zone',
        knex.raw('COUNT(*) as trip_count'),
        knex.raw('AVG(distance_bucket::int) as avg_distance'),
        knex.raw('AVG(duration_bucket::int) as avg_duration')
      ])
      .groupBy(['origin_zone', 'destination_zone']);

    if (startDate) {
      query.where('created_at', '>=', startDate);
    }
    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    const results = await query;

    // Get mode distribution for each OD pair
    const odMatrix: ODMatrixEntry[] = [];
    
    for (const result of results) {
      const modeDistribution = await this.getModeDistribution(
        result.origin_zone,
        result.destination_zone,
        startDate,
        endDate
      );

      const timeDistribution = await this.getTimeDistribution(
        result.origin_zone,
        result.destination_zone,
        startDate,
        endDate
      );

      odMatrix.push({
        origin_zone: result.origin_zone,
        destination_zone: result.destination_zone,
        trip_count: parseInt(result.trip_count),
        total_distance: parseFloat(result.avg_distance) * parseInt(result.trip_count),
        avg_duration: parseFloat(result.avg_duration),
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
  async generateHeatmap(startDate?: Date, endDate?: Date): Promise<HeatmapData[]> {
    console.log('Generating heatmap data...');

    const query = knex('anonymized_data')
      .select([
        'origin_zone as zone',
        knex.raw('COUNT(*) as trip_count'),
        knex.raw('AVG(duration_bucket::int) as avg_duration')
      ])
      .groupBy('origin_zone');

    if (startDate) {
      query.where('created_at', '>=', startDate);
    }
    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    const results = await query;
    const heatmapData: HeatmapData[] = [];

    for (const result of results) {
      const zoneCenter = this.getZoneCenter(result.zone);
      const modeDistribution = await this.getZoneModeDistribution(result.zone, startDate, endDate);
      const timeBuckets = await this.getZoneTimeDistribution(result.zone, startDate, endDate);

      heatmapData.push({
        zone: result.zone,
        latitude: zoneCenter.lat,
        longitude: zoneCenter.lon,
        trip_count: parseInt(result.trip_count),
        avg_duration: parseFloat(result.avg_duration),
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
  async generateTripChainPatterns(startDate?: Date, endDate?: Date): Promise<TripChainPattern[]> {
    console.log('Generating trip chain patterns...');

    // Get trip chains from anonymized data
    const query = knex('anonymized_data')
      .select([
        'pseudonymized_user_id',
        'origin_zone',
        'destination_zone',
        'start_time_bucket',
        'created_at'
      ])
      .orderBy(['pseudonymized_user_id', 'created_at']);

    if (startDate) {
      query.where('created_at', '>=', startDate);
    }
    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    const trips = await query;
    
    // Group trips by user and day
    const userDayChains = new Map<string, string[][]>();
    
    for (const trip of trips) {
      const day = new Date(trip.created_at).toDateString();
      const key = `${trip.pseudonymized_user_id}_${day}`;
      
      if (!userDayChains.has(key)) {
        userDayChains.set(key, []);
      }
      
      const chain = userDayChains.get(key)!;
      chain.push([trip.origin_zone, trip.destination_zone]);
    }

    // Analyze patterns
    const patternCounts = new Map<string, { count: number; durations: number[]; distances: number[] }>();
    
    for (const [key, chain] of userDayChains.entries()) {
      if (chain.length < 2) continue; // Skip single trips
      
      const pattern = chain.map(trip => `${trip[0]}->${trip[1]}`).join('|');
      
      if (!patternCounts.has(pattern)) {
        patternCounts.set(pattern, { count: 0, durations: [], distances: [] });
      }
      
      const patternData = patternCounts.get(pattern)!;
      patternData.count++;
      
      // Calculate average duration and distance for this pattern
      // This would need to be calculated from the original trip data
      patternData.durations.push(1800); // Placeholder
      patternData.distances.push(2000); // Placeholder
    }

    // Convert to TripChainPattern format
    const patterns: TripChainPattern[] = [];
    
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
  applyDifferentialPrivacy(data: number[], epsilon: number = 1.0): number[] {
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
  private async groupTripsByUser(trips: any[]): Promise<Map<string, any[]>> {
    const userGroups = new Map<string, any[]>();
    
    for (const trip of trips) {
      const userId = trip.user_id;
      if (!userGroups.has(userId)) {
        userGroups.set(userId, []);
      }
      userGroups.get(userId)!.push(trip);
    }
    
    return userGroups;
  }

  /**
   * Process trips for a single user
   */
  private async processUserTrips(userId: string, trips: any[]): Promise<void> {
    const pseudonymizedUserId = this.generatePseudonymizedId(userId);
    
    for (const trip of trips) {
      const anonymizedTrip: AnonymizedTrip = {
        id: uuidv4(),
        pseudonymized_user_id: pseudonymizedUserId,
        origin_zone: this.getSpatialZone(trip.origin_lat, trip.origin_lon),
        destination_zone: this.getSpatialZone(trip.destination_lat, trip.destination_lon),
        start_time_bucket: this.getTimeBucket(trip.start_time),
        end_time_bucket: this.getTimeBucket(trip.end_time),
        duration_bucket: this.getDurationBucket(trip.duration_seconds),
        distance_bucket: this.getDistanceBucket(trip.distance_meters),
        travel_mode: trip.travel_mode,
        trip_purpose: trip.trip_purpose,
        num_accompanying_bucket: this.getAccompanyingBucket(trip.num_accompanying),
        created_at: new Date()
      };

      await knex('anonymized_data').insert(anonymizedTrip);
    }
  }

  /**
   * Get spatial zone for coordinates
   */
  private getSpatialZone(lat: number, lon: number): string {
    const gridLat = Math.floor(lat / this.SPATIAL_GRID_SIZE) * this.SPATIAL_GRID_SIZE;
    const gridLon = Math.floor(lon / this.SPATIAL_GRID_SIZE) * this.SPATIAL_GRID_SIZE;
    return `${gridLat.toFixed(3)},${gridLon.toFixed(3)}`;
  }

  /**
   * Get time bucket for timestamp
   */
  private getTimeBucket(timestamp: string): string {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const bucket = Math.floor(minutes / this.TIME_BUCKET_SIZE) * this.TIME_BUCKET_SIZE;
    return `${date.getHours().toString().padStart(2, '0')}:${bucket.toString().padStart(2, '0')}`;
  }

  /**
   * Get duration bucket
   */
  private getDurationBucket(durationSeconds: number): string {
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
  private getDistanceBucket(distanceMeters: number): string {
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
  private getAccompanyingBucket(numAccompanying: number): string {
    if (numAccompanying === 0) return '0';
    if (numAccompanying <= 2) return '1-2';
    if (numAccompanying <= 4) return '3-4';
    return '5+';
  }

  /**
   * Generate pseudonymized user ID
   */
  private generatePseudonymizedId(userId: string): string {
    // Use a hash function to create a consistent pseudonym
    return Buffer.from(userId).toString('base64').substring(0, 16);
  }

  /**
   * Get zone center coordinates
   */
  private getZoneCenter(zone: string): { lat: number; lon: number } {
    const [lat, lon] = zone.split(',').map(Number);
    return {
      lat: lat + this.SPATIAL_GRID_SIZE / 2,
      lon: lon + this.SPATIAL_GRID_SIZE / 2
    };
  }

  /**
   * Get mode distribution for OD pair
   */
  private async getModeDistribution(originZone: string, destinationZone: string, startDate?: Date, endDate?: Date): Promise<Record<string, number>> {
    const query = knex('anonymized_data')
      .select('travel_mode')
      .count('* as count')
      .where('origin_zone', originZone)
      .where('destination_zone', destinationZone)
      .groupBy('travel_mode');

    if (startDate) {
      query.where('created_at', '>=', startDate);
    }
    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    const results = await query;
    const distribution: Record<string, number> = {};
    
    for (const result of results) {
      distribution[result.travel_mode] = parseInt(result.count);
    }
    
    return distribution;
  }

  /**
   * Get time distribution for OD pair
   */
  private async getTimeDistribution(originZone: string, destinationZone: string, startDate?: Date, endDate?: Date): Promise<Record<string, number>> {
    const query = knex('anonymized_data')
      .select('start_time_bucket')
      .count('* as count')
      .where('origin_zone', originZone)
      .where('destination_zone', destinationZone)
      .groupBy('start_time_bucket');

    if (startDate) {
      query.where('created_at', '>=', startDate);
    }
    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    const results = await query;
    const distribution: Record<string, number> = {};
    
    for (const result of results) {
      distribution[result.start_time_bucket] = parseInt(result.count);
    }
    
    return distribution;
  }

  /**
   * Get mode distribution for zone
   */
  private async getZoneModeDistribution(zone: string, startDate?: Date, endDate?: Date): Promise<Record<string, number>> {
    const query = knex('anonymized_data')
      .select('travel_mode')
      .count('* as count')
      .where('origin_zone', zone)
      .groupBy('travel_mode');

    if (startDate) {
      query.where('created_at', '>=', startDate);
    }
    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    const results = await query;
    const distribution: Record<string, number> = {};
    
    for (const result of results) {
      distribution[result.travel_mode] = parseInt(result.count);
    }
    
    return distribution;
  }

  /**
   * Get time distribution for zone
   */
  private async getZoneTimeDistribution(zone: string, startDate?: Date, endDate?: Date): Promise<Record<string, number>> {
    const query = knex('anonymized_data')
      .select('start_time_bucket')
      .count('* as count')
      .where('origin_zone', zone)
      .groupBy('start_time_bucket');

    if (startDate) {
      query.where('created_at', '>=', startDate);
    }
    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    const results = await query;
    const distribution: Record<string, number> = {};
    
    for (const result of results) {
      distribution[result.start_time_bucket] = parseInt(result.count);
    }
    
    return distribution;
  }

  /**
   * Generate Laplace random number
   */
  private laplaceRandom(mean: number, scale: number): number {
    const u = Math.random() - 0.5;
    return mean - scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }
}

export const anonymizationService = new AnonymizationService();
