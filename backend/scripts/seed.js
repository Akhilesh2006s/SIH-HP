#!/usr/bin/env node

/**
 * MongoDB Seed Script
 * Seeds the database with initial development data
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Import models
const User = require('../dist/models/User').User;
const Trip = require('../dist/models/Trip').Trip;
const ConsentRecord = require('../dist/models/ConsentRecord').ConsentRecord;
const RewardPoints = require('../dist/models/RewardPoints').RewardPoints;
const RewardTransaction = require('../dist/models/RewardTransaction').RewardTransaction;

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-travel-diary';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Trip.deleteMany({});
    await ConsentRecord.deleteMany({});
    await RewardPoints.deleteMany({});
    await RewardTransaction.deleteMany({});
    console.log('🧹 Cleared existing data');

    // Create test user
    const testUser = new User({
      email: 'test@example.com',
      password_hash: await bcrypt.hash('testpassword123', 12),
      salt: 'test-salt',
      pseudonymized_id: uuidv4()
    });

    await testUser.save();
    console.log('👤 Created test user');

    // Create consent record
    const consentRecord = new ConsentRecord({
      user_id: testUser._id.toString(),
      consent_version: '1.0',
      background_tracking_consent: true,
      data_sharing_consent: true,
      analytics_consent: true,
      consent_timestamp: new Date()
    });

    await consentRecord.save();
    console.log('📋 Created consent record');

    // Create reward points
    const rewardPoints = new RewardPoints({
      user_id: testUser._id.toString(),
      points_balance: 150,
      last_updated: new Date()
    });

    await rewardPoints.save();
    console.log('🎯 Created reward points');

    // Create sample trips
    const sampleTrips = [
      {
        trip_id: uuidv4(),
        user_id: testUser._id.toString(),
        trip_number: 1,
        chain_id: uuidv4(),
        origin: {
          lat: 37.7749,
          lon: -122.4194,
          place_name: 'Home, San Francisco'
        },
        destination: {
          lat: 37.7849,
          lon: -122.4094,
          place_name: 'Work, San Francisco'
        },
        start_time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        end_time: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
        duration_seconds: 1800, // 30 minutes
        distance_meters: 2500, // 2.5 km
        travel_mode: {
          detected: 'public_transport',
          user_confirmed: 'public_transport',
          confidence: 0.9
        },
        trip_purpose: 'work',
        num_accompanying: 0,
        accompanying_basic: [],
        notes: 'Morning commute to work',
        sensor_summary: {
          average_speed: 1.4,
          variance_accel: 0.2,
          gps_points_count: 45,
          max_speed: 2.1,
          min_speed: 0.8,
          total_acceleration: 12.5
        },
        recorded_offline: false,
        synced: true,
        is_private: false,
        plausibility_score: 0.95
      },
      {
        trip_id: uuidv4(),
        user_id: testUser._id.toString(),
        trip_number: 2,
        chain_id: uuidv4(),
        origin: {
          lat: 37.7849,
          lon: -122.4094,
          place_name: 'Work, San Francisco'
        },
        destination: {
          lat: 37.7649,
          lon: -122.4294,
          place_name: 'Grocery Store, San Francisco'
        },
        start_time: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        end_time: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        duration_seconds: 900, // 15 minutes
        distance_meters: 1200, // 1.2 km
        travel_mode: {
          detected: 'walking',
          user_confirmed: 'walking',
          confidence: 0.85
        },
        trip_purpose: 'shopping',
        num_accompanying: 0,
        accompanying_basic: [],
        notes: 'Quick grocery run',
        sensor_summary: {
          average_speed: 1.3,
          variance_accel: 0.1,
          gps_points_count: 30,
          max_speed: 1.8,
          min_speed: 0.9,
          total_acceleration: 8.2
        },
        recorded_offline: false,
        synced: true,
        is_private: false,
        plausibility_score: 0.88
      }
    ];

    for (const tripData of sampleTrips) {
      const trip = new Trip(tripData);
      await trip.save();
    }
    console.log(`🚗 Created ${sampleTrips.length} sample trips`);

    // Create reward transactions
    const rewardTransactions = [
      {
        user_id: testUser._id.toString(),
        points_change: 25,
        transaction_type: 'trip_completed',
        description: 'Trip completed: Home to Work (public transport)',
        trip_id: sampleTrips[0].trip_id,
        timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000)
      },
      {
        user_id: testUser._id.toString(),
        points_change: 15,
        transaction_type: 'trip_completed',
        description: 'Trip completed: Work to Grocery Store (walking)',
        trip_id: sampleTrips[1].trip_id,
        timestamp: new Date(Date.now() - 45 * 60 * 1000)
      },
      {
        user_id: testUser._id.toString(),
        points_change: 10,
        transaction_type: 'bonus',
        description: 'Welcome bonus for new user',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ];

    for (const transactionData of rewardTransactions) {
      const transaction = new RewardTransaction(transactionData);
      await transaction.save();
    }
    console.log(`🎁 Created ${rewardTransactions.length} reward transactions`);

    console.log('✅ Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Users: 1`);
    console.log(`   - Trips: ${sampleTrips.length}`);
    console.log(`   - Consent Records: 1`);
    console.log(`   - Reward Points: 1`);
    console.log(`   - Reward Transactions: ${rewardTransactions.length}`);
    console.log('\n🔑 Test Credentials:');
    console.log('   Email: test@example.com');
    console.log('   Password: testpassword123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
