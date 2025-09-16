import { Knex } from 'knex';
import { EncryptionService } from '../services/encryption';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function seed(knex: Knex): Promise<void> {
  // Only run seeds in development
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Create test user
  const userId = uuidv4();
  const email = 'test@example.com';
  const password = 'testpassword123';
  const encryptionKey = EncryptionService.generateKey();
  const salt = EncryptionService.generateSalt();

  const user = {
    user_id: userId,
    email_hash: EncryptionService.hashEmail(email),
    password_hash: await bcrypt.hash(password, 12),
    encryption_key: encryptionKey,
    salt: salt,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login: new Date().toISOString()
  };

  await knex('users').insert(user);

  // Create consent record
  const consent = {
    user_id: userId,
    consent_version: '1.0.0',
    background_tracking_consent: true,
    data_sharing_consent: true,
    analytics_consent: true,
    consent_timestamp: new Date().toISOString(),
    ip_address: '127.0.0.1',
    user_agent: 'Test User Agent'
  };

  await knex('consent_records').insert(consent);

  // Create reward points
  const rewardPoints = {
    user_id: userId,
    total_points: 150,
    available_points: 100,
    redeemed_points: 50,
    last_earned: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await knex('reward_points').insert(rewardPoints);

  // Create sample trips
  const sampleTrips = [
    {
      trip_id: uuidv4(),
      user_id: userId,
      trip_number: 1,
      chain_id: uuidv4(),
      origin_lat: 37.7749,
      origin_lon: -122.4194,
      origin_place_name: 'Home, San Francisco',
      destination_lat: 37.7849,
      destination_lon: -122.4094,
      destination_place_name: 'Work, San Francisco',
      start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      end_time: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
      duration_seconds: 1800, // 30 minutes
      distance_meters: 2000, // 2 km
      travel_mode_detected: 'public_transport',
      travel_mode_confirmed: 'public_transport',
      travel_mode_confidence: 0.85,
      trip_purpose: 'work',
      num_accompanying: 0,
      accompanying_basic: JSON.stringify([]),
      notes: 'Morning commute',
      sensor_summary: JSON.stringify({
        average_speed: 2.2,
        variance_accel: 0.1,
        gps_points_count: 25,
        max_speed: 3.5,
        min_speed: 0.5,
        total_acceleration: 2.1
      }),
      plausibility_score: 0.92,
      recorded_offline: true,
      synced: true,
      is_private: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      trip_id: uuidv4(),
      user_id: userId,
      trip_number: 2,
      chain_id: uuidv4(),
      origin_lat: 37.7849,
      origin_lon: -122.4094,
      origin_place_name: 'Work, San Francisco',
      destination_lat: 37.7749,
      destination_lon: -122.4194,
      destination_place_name: 'Home, San Francisco',
      start_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
      end_time: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(), // 30 minutes ago
      duration_seconds: 1800, // 30 minutes
      distance_meters: 2000, // 2 km
      travel_mode_detected: 'public_transport',
      travel_mode_confirmed: 'public_transport',
      travel_mode_confidence: 0.88,
      trip_purpose: 'home',
      num_accompanying: 0,
      accompanying_basic: JSON.stringify([]),
      notes: 'Evening commute',
      sensor_summary: JSON.stringify({
        average_speed: 2.1,
        variance_accel: 0.12,
        gps_points_count: 28,
        max_speed: 3.2,
        min_speed: 0.3,
        total_acceleration: 2.3
      }),
      plausibility_score: 0.89,
      recorded_offline: true,
      synced: true,
      is_private: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // Encrypt trip data before storing
  for (const trip of sampleTrips) {
    const tripData = {
      trip_id: trip.trip_id,
      trip_number: trip.trip_number,
      chain_id: trip.chain_id,
      origin: {
        lat: trip.origin_lat,
        lon: trip.origin_lon,
        place_name: trip.origin_place_name
      },
      destination: {
        lat: trip.destination_lat,
        lon: trip.destination_lon,
        place_name: trip.destination_place_name
      },
      start_time: trip.start_time,
      end_time: trip.end_time,
      duration_seconds: trip.duration_seconds,
      distance_meters: trip.distance_meters,
      travel_mode: {
        detected: trip.travel_mode_detected,
        user_confirmed: trip.travel_mode_confirmed,
        confidence: trip.travel_mode_confidence
      },
      trip_purpose: trip.trip_purpose,
      num_accompanying: trip.num_accompanying,
      accompanying_basic: JSON.parse(trip.accompanying_basic),
      notes: trip.notes,
      sensor_summary: JSON.parse(trip.sensor_summary),
      plausibility_score: trip.plausibility_score,
      recorded_offline: trip.recorded_offline,
      synced: trip.synced,
      is_private: trip.is_private
    };

    const encryptedData = EncryptionService.encryptTripData(tripData, encryptionKey);

    await knex('trips').insert({
      ...trip,
      encrypted_data: encryptedData
    });
  }

  // Create sample reward transactions
  const rewardTransactions = [
    {
      transaction_id: uuidv4(),
      user_id: userId,
      trip_id: sampleTrips[0].trip_id,
      points_earned: 10,
      points_redeemed: 0,
      transaction_type: 'trip_completion',
      description: 'Completed morning commute trip',
      created_at: new Date().toISOString()
    },
    {
      transaction_id: uuidv4(),
      user_id: userId,
      trip_id: sampleTrips[1].trip_id,
      points_earned: 10,
      points_redeemed: 0,
      transaction_type: 'trip_completion',
      description: 'Completed evening commute trip',
      created_at: new Date().toISOString()
    },
    {
      transaction_id: uuidv4(),
      user_id: userId,
      trip_id: null,
      points_earned: 0,
      points_redeemed: 50,
      transaction_type: 'redemption',
      description: 'Redeemed points for coffee voucher',
      created_at: new Date().toISOString()
    }
  ];

  await knex('reward_transactions').insert(rewardTransactions);

  console.log('✅ Development data seeded successfully');
  console.log(`📧 Test user email: ${email}`);
  console.log(`🔑 Test user password: ${password}`);
  console.log(`🆔 Test user ID: ${userId}`);
}
