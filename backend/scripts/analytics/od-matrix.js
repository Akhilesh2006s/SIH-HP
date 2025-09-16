#!/usr/bin/env node

/**
 * Origin-Destination Matrix Generator
 * Generates OD matrices for NATPAC transportation analysis
 */

const { anonymizationService } = require('../src/services/anonymizationService');
const fs = require('fs');
const path = require('path');

async function generateODMatrix() {
  console.log('🚗 Generating Origin-Destination Matrix for NATPAC...');
  
  try {
    // Get command line arguments for date range
    const args = process.argv.slice(2);
    let startDate, endDate;
    
    if (args.length >= 2) {
      startDate = new Date(args[0]);
      endDate = new Date(args[1]);
      console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } else {
      // Default to last 30 days
      endDate = new Date();
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      console.log(`📅 Using default date range: last 30 days`);
    }

    // Generate OD matrix
    const odMatrix = await anonymizationService.generateODMatrix(startDate, endDate);
    
    // Apply differential privacy
    const epsilon = 1.0; // Privacy parameter
    const tripCounts = odMatrix.map(entry => entry.trip_count);
    const privateTripCounts = anonymizationService.applyDifferentialPrivacy(tripCounts, epsilon);
    
    // Update OD matrix with private counts
    odMatrix.forEach((entry, index) => {
      entry.trip_count = privateTripCounts[index];
    });

    // Filter out entries with 0 trips (due to noise)
    const filteredODMatrix = odMatrix.filter(entry => entry.trip_count > 0);

    // Generate summary statistics
    const summary = {
      total_od_pairs: filteredODMatrix.length,
      total_trips: filteredODMatrix.reduce((sum, entry) => sum + entry.trip_count, 0),
      total_distance: filteredODMatrix.reduce((sum, entry) => sum + entry.total_distance, 0),
      avg_trips_per_od: filteredODMatrix.reduce((sum, entry) => sum + entry.trip_count, 0) / filteredODMatrix.length,
      mode_distribution: calculateModeDistribution(filteredODMatrix),
      top_od_pairs: filteredODMatrix
        .sort((a, b) => b.trip_count - a.trip_count)
        .slice(0, 10)
        .map(entry => ({
          origin: entry.origin_zone,
          destination: entry.destination_zone,
          trips: entry.trip_count,
          avg_duration: Math.round(entry.avg_duration)
        }))
    };

    // Create output directory
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save OD matrix
    const odMatrixFile = path.join(outputDir, `od-matrix-${formatDate(startDate)}-${formatDate(endDate)}.json`);
    fs.writeFileSync(odMatrixFile, JSON.stringify({
      metadata: {
        generated_at: new Date().toISOString(),
        date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
        privacy_epsilon: epsilon,
        total_od_pairs: filteredODMatrix.length,
        total_trips: summary.total_trips
      },
      summary: summary,
      od_matrix: filteredODMatrix
    }, null, 2));

    // Save CSV format for easy analysis
    const csvFile = path.join(outputDir, `od-matrix-${formatDate(startDate)}-${formatDate(endDate)}.csv`);
    const csvContent = generateCSV(filteredODMatrix);
    fs.writeFileSync(csvFile, csvContent);

    console.log('✅ OD Matrix generated successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Total OD pairs: ${summary.total_od_pairs}`);
    console.log(`   - Total trips: ${summary.total_trips}`);
    console.log(`   - Total distance: ${(summary.total_distance / 1000).toFixed(1)} km`);
    console.log(`   - Average trips per OD pair: ${summary.avg_trips_per_od.toFixed(1)}`);
    console.log(`📁 Files saved:`);
    console.log(`   - JSON: ${odMatrixFile}`);
    console.log(`   - CSV: ${csvFile}`);

    // Print top OD pairs
    console.log('\n🏆 Top 10 OD Pairs:');
    summary.top_od_pairs.forEach((pair, index) => {
      console.log(`   ${index + 1}. ${pair.origin} → ${pair.destination}: ${pair.trips} trips (${pair.avg_duration}s avg)`);
    });

    // Print mode distribution
    console.log('\n🚌 Mode Distribution:');
    Object.entries(summary.mode_distribution).forEach(([mode, count]) => {
      const percentage = ((count / summary.total_trips) * 100).toFixed(1);
      console.log(`   - ${mode}: ${count} trips (${percentage}%)`);
    });

  } catch (error) {
    console.error('❌ Error generating OD matrix:', error);
    process.exit(1);
  }
}

function calculateModeDistribution(odMatrix) {
  const modeCounts = {};
  
  odMatrix.forEach(entry => {
    Object.entries(entry.mode_distribution).forEach(([mode, count]) => {
      modeCounts[mode] = (modeCounts[mode] || 0) + count;
    });
  });
  
  return modeCounts;
}

function generateCSV(odMatrix) {
  const headers = [
    'origin_zone',
    'destination_zone',
    'trip_count',
    'total_distance',
    'avg_duration',
    'walking_trips',
    'cycling_trips',
    'public_transport_trips',
    'private_vehicle_trips'
  ];
  
  const rows = odMatrix.map(entry => [
    entry.origin_zone,
    entry.destination_zone,
    entry.trip_count,
    entry.total_distance,
    Math.round(entry.avg_duration),
    entry.mode_distribution.walking || 0,
    entry.mode_distribution.cycling || 0,
    entry.mode_distribution.public_transport || 0,
    entry.mode_distribution.private_vehicle || 0
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Run if called directly
if (require.main === module) {
  generateODMatrix();
}

module.exports = { generateODMatrix };
