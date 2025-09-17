#!/usr/bin/env node

/**
 * Trip Simulation Script
 * Generates realistic trip data for testing and demonstration purposes
 */

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  numberOfTrips: 50,
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  },
  locations: [
    { name: 'Home', lat: 37.7749, lon: -122.4194 },
    { name: 'Work', lat: 37.7849, lon: -122.4094 },
    { name: 'Grocery Store', lat: 37.7649, lon: -122.4294 },
    { name: 'Gym', lat: 37.7549, lon: -122.4394 },
    { name: 'Restaurant', lat: 37.7949, lon: -122.3994 },
    { name: 'Park', lat: 37.7449, lon: -122.4494 },
    { name: 'Shopping Mall', lat: 37.8049, lon: -122.3894 },
    { name: 'Library', lat: 37.7349, lon: -122.4594 }
  ],
  travelModes: ['walking', 'cycling', 'public_transport', 'private_vehicle'],
  tripPurposes: ['work', 'shopping', 'recreation', 'healthcare', 'education', 'social', 'home'],
  timePatterns: {
    morning: { start: 7, end: 9, primaryPurpose: 'work' },
    lunch: { start: 12, end: 13, primaryPurpose: 'shopping' },
    evening: { start: 17, end: 19, primaryPurpose: 'home' },
    weekend: { start: 10, end: 16, primaryPurpose: 'recreation' }
  }
};

// Helper functions
function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getTravelModeFromDistance(distance) {
  if (distance < 500) return 'walking';
  if (distance < 3000) return 'cycling';
  if (distance < 10000) return 'public_transport';
  return 'private_vehicle';
}

function getSpeedForMode(mode) {
  const speeds = {
    walking: { min: 0.8, max: 1.5 },
    cycling: { min: 2.0, max: 4.0 },
    public_transport: { min: 1.5, max: 3.0 },
    private_vehicle: { min: 3.0, max: 8.0 }
  };
  return randomBetween(speeds[mode].min, speeds[mode].max);
}

function generateSensorSummary(travelMode, distance, duration) {
  const speed = distance / duration;
  const avgSpeed = getSpeedForMode(travelMode);
  const variance = randomBetween(0.1, 0.5);
  
  return {
    average_speed: avgSpeed,
    variance_accel: variance,
    gps_points_count: Math.max(5, Math.floor(duration / 10)),
    max_speed: avgSpeed * randomBetween(1.2, 1.8),
    min_speed: avgSpeed * randomBetween(0.3, 0.7),
    total_acceleration: variance * randomBetween(1.5, 3.0)
  };
}

function generateTrip() {
  const origin = randomChoice(CONFIG.locations);
  let destination;
  
  // Ensure destination is different from origin
  do {
    destination = randomChoice(CONFIG.locations);
  } while (destination === origin);
  
  const distance = calculateDistance(origin.lat, origin.lon, destination.lat, destination.lon);
  const travelMode = getTravelModeFromDistance(distance);
  const speed = getSpeedForMode(travelMode);
  const duration = Math.max(60, Math.floor(distance / speed)); // Minimum 1 minute
  
  // Generate realistic timestamp
  const isWeekend = Math.random() < 0.3;
  const timePattern = isWeekend ? CONFIG.timePatterns.weekend : 
                     randomChoice([CONFIG.timePatterns.morning, CONFIG.timePatterns.lunch, CONFIG.timePatterns.evening]);
  
  const hour = randomInt(timePattern.start, timePattern.end);
  const minute = randomInt(0, 59);
  const dayOffset = randomInt(0, 29);
  
  const startTime = new Date(CONFIG.dateRange.start);
  startTime.setDate(startTime.getDate() + dayOffset);
  startTime.setHours(hour, minute, 0, 0);
  
  const endTime = new Date(startTime.getTime() + duration * 1000);
  
  const trip = {
    trip_id: uuidv4(),
    user_id: 'demo-user-id', // This would be replaced with actual user ID
    trip_number: randomInt(1, 5),
    chain_id: uuidv4(),
    origin: {
      lat: origin.lat,
      lon: origin.lon,
      place_name: origin.name
    },
    destination: {
      lat: destination.lat,
      lon: destination.lon,
      place_name: destination.name
    },
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_seconds: duration,
    distance_meters: Math.round(distance),
    travel_mode: {
      detected: travelMode,
      user_confirmed: Math.random() < 0.8 ? travelMode : null,
      confidence: randomBetween(0.6, 0.95)
    },
    trip_purpose: timePattern.primaryPurpose || randomChoice(CONFIG.tripPurposes),
    num_accompanying: randomInt(0, 3),
    accompanying_basic: Array.from({ length: randomInt(0, 2) }, () => ({
      relation: randomChoice(['family', 'friend', 'colleague']),
      adult_count: randomInt(0, 2),
      child_count: randomInt(0, 1)
    })),
    notes: Math.random() < 0.3 ? `Trip to ${destination.name}` : null,
    sensor_summary: generateSensorSummary(travelMode, distance, duration),
    recorded_offline: Math.random() < 0.2,
    synced: Math.random() < 0.9,
    is_private: Math.random() < 0.1,
    plausibility_score: randomBetween(0.7, 0.98),
    created_at: startTime.toISOString(),
    updated_at: endTime.toISOString()
  };
  
  return trip;
}

function generateTripChain(trips) {
  // Group trips by day and create chains
  const tripsByDay = {};
  trips.forEach(trip => {
    const day = new Date(trip.start_time).toDateString();
    if (!tripsByDay[day]) {
      tripsByDay[day] = [];
    }
    tripsByDay[day].push(trip);
  });
  
  const chains = [];
  Object.values(tripsByDay).forEach(dayTrips => {
    if (dayTrips.length > 1) {
      const chain = {
        chain_id: uuidv4(),
        user_id: 'demo-user-id',
        trips: dayTrips.sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
        start_time: dayTrips[0].start_time,
        end_time: dayTrips[dayTrips.length - 1].end_time,
        total_distance: dayTrips.reduce((sum, trip) => sum + trip.distance_meters, 0),
        total_duration: dayTrips.reduce((sum, trip) => sum + trip.duration_seconds, 0),
        created_at: dayTrips[0].created_at,
        updated_at: dayTrips[dayTrips.length - 1].updated_at
      };
      chains.push(chain);
    }
  });
  
  return chains;
}

function main() {
  console.log('🚗 Generating realistic trip data...');
  console.log(`📊 Creating ${CONFIG.numberOfTrips} trips`);
  
  const trips = [];
  for (let i = 0; i < CONFIG.numberOfTrips; i++) {
    trips.push(generateTrip());
  }
  
  // Sort trips by start time
  trips.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  
  // Generate trip chains
  const chains = generateTripChain(trips);
  
  // Create output data
  const outputData = {
    metadata: {
      generated_at: new Date().toISOString(),
      total_trips: trips.length,
      total_chains: chains.length,
      date_range: {
        start: CONFIG.dateRange.start.toISOString(),
        end: CONFIG.dateRange.end.toISOString()
      },
      locations_used: CONFIG.locations.length,
      travel_modes: CONFIG.travelModes,
      trip_purposes: CONFIG.tripPurposes
    },
    trips: trips,
    trip_chains: chains,
    statistics: {
      total_distance: trips.reduce((sum, trip) => sum + trip.distance_meters, 0),
      total_duration: trips.reduce((sum, trip) => sum + trip.duration_seconds, 0),
      mode_distribution: CONFIG.travelModes.reduce((dist, mode) => {
        dist[mode] = trips.filter(trip => trip.travel_mode.detected === mode).length;
        return dist;
      }, {}),
      purpose_distribution: CONFIG.tripPurposes.reduce((dist, purpose) => {
        dist[purpose] = trips.filter(trip => trip.trip_purpose === purpose).length;
        return dist;
      }, {})
    }
  };
  
  // Write to file
  const outputPath = path.join(__dirname, '..', 'demo-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  
  console.log('✅ Trip data generated successfully!');
  console.log(`📁 Output file: ${outputPath}`);
  console.log(`📊 Statistics:`);
  console.log(`   - Total trips: ${trips.length}`);
  console.log(`   - Total chains: ${chains.length}`);
  console.log(`   - Total distance: ${(outputData.statistics.total_distance / 1000).toFixed(1)} km`);
  console.log(`   - Total duration: ${Math.floor(outputData.statistics.total_duration / 3600)} hours`);
  console.log(`   - Average trip distance: ${(outputData.statistics.total_distance / trips.length / 1000).toFixed(1)} km`);
  console.log(`   - Average trip duration: ${Math.floor(outputData.statistics.total_duration / trips.length / 60)} minutes`);
  
  console.log('\n🎯 Mode distribution:');
  Object.entries(outputData.statistics.mode_distribution).forEach(([mode, count]) => {
    const percentage = ((count / trips.length) * 100).toFixed(1);
    console.log(`   - ${mode}: ${count} trips (${percentage}%)`);
  });
  
  console.log('\n🎯 Purpose distribution:');
  Object.entries(outputData.statistics.purpose_distribution).forEach(([purpose, count]) => {
    const percentage = ((count / trips.length) * 100).toFixed(1);
    console.log(`   - ${purpose}: ${count} trips (${percentage}%)`);
  });
  
  console.log('\n💡 You can use this data to test the app or import it into the database.');
}

if (require.main === module) {
  main();
}

module.exports = { generateTrip, generateTripChain, CONFIG };


