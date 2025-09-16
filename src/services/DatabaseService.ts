import * as SQLite from 'expo-sqlite';
import { Trip, TripChain, UserPreferences, ConsentRecord, RewardPoints, RewardTransaction } from '../types';
import { EncryptionService } from '../utils/encryption';

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    this.db = await SQLite.openDatabaseAsync('smart_travel_diary.db');
    await this.createTables();
    this.isInitialized = true;
  }
  
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Create trips table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS trips (
        trip_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        trip_number INTEGER NOT NULL,
        chain_id TEXT NOT NULL,
        origin_lat REAL NOT NULL,
        origin_lon REAL NOT NULL,
        origin_place_name TEXT NOT NULL,
        destination_lat REAL NOT NULL,
        destination_lon REAL NOT NULL,
        destination_place_name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        distance_meters REAL NOT NULL,
        travel_mode_detected TEXT NOT NULL,
        travel_mode_confirmed TEXT,
        travel_mode_confidence REAL NOT NULL,
        trip_purpose TEXT NOT NULL,
        num_accompanying INTEGER NOT NULL,
        accompanying_basic TEXT,
        notes TEXT,
        sensor_summary TEXT NOT NULL,
        recorded_offline INTEGER NOT NULL DEFAULT 1,
        synced INTEGER NOT NULL DEFAULT 0,
        is_private INTEGER NOT NULL DEFAULT 0,
        plausibility_score REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Create trip chains table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS trip_chains (
        chain_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        total_distance REAL NOT NULL,
        total_duration INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Create user preferences table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        background_tracking_enabled INTEGER NOT NULL DEFAULT 1,
        sync_frequency_minutes INTEGER NOT NULL DEFAULT 30,
        battery_optimization INTEGER NOT NULL DEFAULT 1,
        privacy_mode INTEGER NOT NULL DEFAULT 0,
        reward_notifications INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Create consent records table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS consent_records (
        user_id TEXT NOT NULL,
        consent_version TEXT NOT NULL,
        background_tracking_consent INTEGER NOT NULL,
        data_sharing_consent INTEGER NOT NULL,
        analytics_consent INTEGER NOT NULL,
        consent_timestamp TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        PRIMARY KEY (user_id, consent_version)
      );
    `);
    
    // Create reward points table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS reward_points (
        user_id TEXT PRIMARY KEY,
        total_points INTEGER NOT NULL DEFAULT 0,
        available_points INTEGER NOT NULL DEFAULT 0,
        redeemed_points INTEGER NOT NULL DEFAULT 0,
        last_earned TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Create reward transactions table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS reward_transactions (
        transaction_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        trip_id TEXT,
        points_earned INTEGER NOT NULL DEFAULT 0,
        points_redeemed INTEGER NOT NULL DEFAULT 0,
        transaction_type TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    
    // Create sync queue table for offline operations
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_retry TEXT
      );
    `);
    
    // Create indexes for better performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
      CREATE INDEX IF NOT EXISTS idx_trips_chain_id ON trips(chain_id);
      CREATE INDEX IF NOT EXISTS idx_trips_start_time ON trips(start_time);
      CREATE INDEX IF NOT EXISTS idx_trips_synced ON trips(synced);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_operation ON sync_queue(operation_type);
    `);
  }
  
  // Trip operations
  async saveTrip(trip: Trip): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      INSERT OR REPLACE INTO trips (
        trip_id, user_id, trip_number, chain_id,
        origin_lat, origin_lon, origin_place_name,
        destination_lat, destination_lon, destination_place_name,
        start_time, end_time, duration_seconds, distance_meters,
        travel_mode_detected, travel_mode_confirmed, travel_mode_confidence,
        trip_purpose, num_accompanying, accompanying_basic, notes,
        sensor_summary, recorded_offline, synced, is_private,
        plausibility_score, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.runAsync(query, [
      trip.trip_id,
      trip.user_id,
      trip.trip_number,
      trip.chain_id,
      trip.origin.lat,
      trip.origin.lon,
      trip.origin.place_name,
      trip.destination.lat,
      trip.destination.lon,
      trip.destination.place_name,
      trip.start_time,
      trip.end_time,
      trip.duration_seconds,
      trip.distance_meters,
      trip.travel_mode.detected,
      trip.travel_mode.user_confirmed,
      trip.travel_mode.confidence,
      trip.trip_purpose,
      trip.num_accompanying,
      JSON.stringify(trip.accompanying_basic),
      trip.notes || null,
      JSON.stringify(trip.sensor_summary),
      trip.recorded_offline ? 1 : 0,
      trip.synced ? 1 : 0,
      trip.is_private ? 1 : 0,
      trip.plausibility_score || null,
      trip.created_at,
      trip.updated_at
    ]);
    
    // Add to sync queue if not synced
    if (!trip.synced) {
      await this.addToSyncQueue('INSERT', 'trips', trip.trip_id, trip);
    }
  }
  
  async getTrip(tripId: string): Promise<Trip | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(`
      SELECT * FROM trips WHERE trip_id = ?
    `, [tripId]);
    
    if (!result) return null;
    
    return this.mapRowToTrip(result as any);
  }
  
  async getTrips(userId: string, limit: number = 100, offset: number = 0): Promise<Trip[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db.getAllAsync(`
      SELECT * FROM trips 
      WHERE user_id = ? 
      ORDER BY start_time DESC 
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);
    
    return results.map(row => this.mapRowToTrip(row as any));
  }
  
  async getUnsyncedTrips(userId: string): Promise<Trip[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db.getAllAsync(`
      SELECT * FROM trips 
      WHERE user_id = ? AND synced = 0 AND is_private = 0
      ORDER BY created_at ASC
    `, [userId]);
    
    return results.map(row => this.mapRowToTrip(row as any));
  }
  
  async markTripAsSynced(tripId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(`
      UPDATE trips SET synced = 1, updated_at = ? WHERE trip_id = ?
    `, [new Date().toISOString(), tripId]);
    
    // Remove from sync queue
    await this.removeFromSyncQueue('trips', tripId);
  }
  
  // Trip chain operations
  async saveTripChain(chain: TripChain): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      INSERT OR REPLACE INTO trip_chains (
        chain_id, user_id, start_time, end_time,
        total_distance, total_duration, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.runAsync(query, [
      chain.chain_id,
      chain.user_id,
      chain.start_time,
      chain.end_time,
      chain.total_distance,
      chain.total_duration,
      chain.created_at,
      chain.updated_at
    ]);
  }
  
  async getTripChains(userId: string, limit: number = 50): Promise<TripChain[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db.getAllAsync(`
      SELECT * FROM trip_chains 
      WHERE user_id = ? 
      ORDER BY start_time DESC 
      LIMIT ?
    `, [userId, limit]);
    
    return results.map(row => this.mapRowToTripChain(row as any));
  }
  
  // User preferences operations
  async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      INSERT OR REPLACE INTO user_preferences (
        user_id, background_tracking_enabled, sync_frequency_minutes,
        battery_optimization, privacy_mode, reward_notifications,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.runAsync(query, [
      preferences.user_id,
      preferences.background_tracking_enabled ? 1 : 0,
      preferences.sync_frequency_minutes,
      preferences.battery_optimization ? 1 : 0,
      preferences.privacy_mode ? 1 : 0,
      preferences.reward_notifications ? 1 : 0,
      preferences.created_at,
      preferences.updated_at
    ]);
  }
  
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(`
      SELECT * FROM user_preferences WHERE user_id = ?
    `, [userId]);
    
    if (!result) return null;
    
    return this.mapRowToUserPreferences(result as any);
  }
  
  // Consent operations
  async saveConsentRecord(consent: ConsentRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      INSERT OR REPLACE INTO consent_records (
        user_id, consent_version, background_tracking_consent,
        data_sharing_consent, analytics_consent, consent_timestamp,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.runAsync(query, [
      consent.user_id,
      consent.consent_version,
      consent.background_tracking_consent ? 1 : 0,
      consent.data_sharing_consent ? 1 : 0,
      consent.analytics_consent ? 1 : 0,
      consent.consent_timestamp,
      consent.ip_address || null,
      consent.user_agent || null
    ]);
  }
  
  async getConsentRecord(userId: string, version: string): Promise<ConsentRecord | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(`
      SELECT * FROM consent_records WHERE user_id = ? AND consent_version = ?
    `, [userId, version]);
    
    if (!result) return null;
    
    return this.mapRowToConsentRecord(result as any);
  }
  
  // Reward operations
  async saveRewardPoints(points: RewardPoints): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      INSERT OR REPLACE INTO reward_points (
        user_id, total_points, available_points, redeemed_points,
        last_earned, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.runAsync(query, [
      points.user_id,
      points.total_points,
      points.available_points,
      points.redeemed_points,
      points.last_earned,
      points.created_at,
      points.updated_at
    ]);
  }
  
  async getRewardPoints(userId: string): Promise<RewardPoints | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(`
      SELECT * FROM reward_points WHERE user_id = ?
    `, [userId]);
    
    if (!result) return null;
    
    return this.mapRowToRewardPoints(result as any);
  }
  
  async saveRewardTransaction(transaction: RewardTransaction): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      INSERT INTO reward_transactions (
        transaction_id, user_id, trip_id, points_earned,
        points_redeemed, transaction_type, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.runAsync(query, [
      transaction.transaction_id,
      transaction.user_id,
      transaction.trip_id || null,
      transaction.points_earned,
      transaction.points_redeemed,
      transaction.transaction_type,
      transaction.description,
      transaction.created_at
    ]);
  }
  
  // Sync queue operations
  async addToSyncQueue(operationType: string, tableName: string, recordId: string, data: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      INSERT INTO sync_queue (operation_type, table_name, record_id, data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await this.db.runAsync(query, [
      operationType,
      tableName,
      recordId,
      JSON.stringify(data),
      new Date().toISOString()
    ]);
  }
  
  async getSyncQueue(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db.getAllAsync(`
      SELECT * FROM sync_queue 
      WHERE retry_count < 3
      ORDER BY created_at ASC
    `);
    
    return results.map(row => ({
      ...row,
      data: JSON.parse((row as any).data)
    }));
  }
  
  async removeFromSyncQueue(tableName: string, recordId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(`
      DELETE FROM sync_queue WHERE table_name = ? AND record_id = ?
    `, [tableName, recordId]);
  }
  
  // Data export for privacy compliance
  async exportUserData(userId: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    const trips = await this.getTrips(userId, 10000, 0);
    const chains = await this.getTripChains(userId, 1000);
    const preferences = await this.getUserPreferences(userId);
    const consent = await this.db.getAllAsync(`
      SELECT * FROM consent_records WHERE user_id = ?
    `, [userId]);
    const rewards = await this.getRewardPoints(userId);
    const transactions = await this.db.getAllAsync(`
      SELECT * FROM reward_transactions WHERE user_id = ?
    `, [userId]);
    
    return {
      trips,
      trip_chains: chains,
      preferences,
      consent_records: consent,
      reward_points: rewards,
      reward_transactions: transactions,
      export_timestamp: new Date().toISOString()
    };
  }
  
  // Delete user data for privacy compliance
  async deleteUserData(userId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync('DELETE FROM trips WHERE user_id = ?', [userId]);
    await this.db.runAsync('DELETE FROM trip_chains WHERE user_id = ?', [userId]);
    await this.db.runAsync('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await this.db.runAsync('DELETE FROM consent_records WHERE user_id = ?', [userId]);
    await this.db.runAsync('DELETE FROM reward_points WHERE user_id = ?', [userId]);
    await this.db.runAsync('DELETE FROM reward_transactions WHERE user_id = ?', [userId]);
    await this.db.runAsync('DELETE FROM sync_queue WHERE data LIKE ?', [`%"user_id":"${userId}"%`]);
  }
  
  // Helper methods to map database rows to objects
  private mapRowToTrip(row: any): Trip {
    return {
      trip_id: row.trip_id,
      user_id: row.user_id,
      trip_number: row.trip_number,
      chain_id: row.chain_id,
      origin: {
        lat: row.origin_lat,
        lon: row.origin_lon,
        place_name: row.origin_place_name
      },
      destination: {
        lat: row.destination_lat,
        lon: row.destination_lon,
        place_name: row.destination_place_name
      },
      start_time: row.start_time,
      end_time: row.end_time,
      duration_seconds: row.duration_seconds,
      distance_meters: row.distance_meters,
      travel_mode: {
        detected: row.travel_mode_detected,
        user_confirmed: row.travel_mode_confirmed,
        confidence: row.travel_mode_confidence
      },
      trip_purpose: row.trip_purpose,
      num_accompanying: row.num_accompanying,
      accompanying_basic: JSON.parse(row.accompanying_basic || '[]'),
      notes: row.notes,
      sensor_summary: JSON.parse(row.sensor_summary),
      recorded_offline: row.recorded_offline === 1,
      synced: row.synced === 1,
      is_private: row.is_private === 1,
      plausibility_score: row.plausibility_score,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
  
  private mapRowToTripChain(row: any): TripChain {
    return {
      chain_id: row.chain_id,
      user_id: row.user_id,
      trips: [], // Will be populated separately if needed
      start_time: row.start_time,
      end_time: row.end_time,
      total_distance: row.total_distance,
      total_duration: row.total_duration,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
  
  private mapRowToUserPreferences(row: any): UserPreferences {
    return {
      user_id: row.user_id,
      background_tracking_enabled: row.background_tracking_enabled === 1,
      sync_frequency_minutes: row.sync_frequency_minutes,
      battery_optimization: row.battery_optimization === 1,
      privacy_mode: row.privacy_mode === 1,
      reward_notifications: row.reward_notifications === 1,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
  
  private mapRowToConsentRecord(row: any): ConsentRecord {
    return {
      user_id: row.user_id,
      consent_version: row.consent_version,
      background_tracking_consent: row.background_tracking_consent === 1,
      data_sharing_consent: row.data_sharing_consent === 1,
      analytics_consent: row.analytics_consent === 1,
      consent_timestamp: row.consent_timestamp,
      ip_address: row.ip_address,
      user_agent: row.user_agent
    };
  }
  
  private mapRowToRewardPoints(row: any): RewardPoints {
    return {
      user_id: row.user_id,
      total_points: row.total_points,
      available_points: row.available_points,
      redeemed_points: row.redeemed_points,
      last_earned: row.last_earned,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
