#!/usr/bin/env node

/**
 * Heatmap Generator
 * Generates spatial heatmaps for NATPAC transportation analysis
 */

const { anonymizationService } = require('../src/services/anonymizationService');
const fs = require('fs');
const path = require('path');

async function generateHeatmap() {
  console.log('🗺️ Generating Heatmap for NATPAC...');
  
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

    // Generate heatmap data
    const heatmapData = await anonymizationService.generateHeatmap(startDate, endDate);
    
    // Apply differential privacy to trip counts
    const epsilon = 1.0; // Privacy parameter
    const tripCounts = heatmapData.map(zone => zone.trip_count);
    const privateTripCounts = anonymizationService.applyDifferentialPrivacy(tripCounts, epsilon);
    
    // Update heatmap with private counts
    heatmapData.forEach((zone, index) => {
      zone.trip_count = privateTripCounts[index];
    });

    // Filter out zones with 0 trips (due to noise)
    const filteredHeatmap = heatmapData.filter(zone => zone.trip_count > 0);

    // Generate summary statistics
    const summary = {
      total_zones: filteredHeatmap.length,
      total_trips: filteredHeatmap.reduce((sum, zone) => sum + zone.trip_count, 0),
      avg_trips_per_zone: filteredHeatmap.reduce((sum, zone) => sum + zone.trip_count, 0) / filteredHeatmap.length,
      max_trips_in_zone: Math.max(...filteredHeatmap.map(zone => zone.trip_count)),
      min_trips_in_zone: Math.min(...filteredHeatmap.map(zone => zone.trip_count)),
      mode_distribution: calculateOverallModeDistribution(filteredHeatmap),
      peak_hours: calculatePeakHours(filteredHeatmap),
      top_zones: filteredHeatmap
        .sort((a, b) => b.trip_count - a.trip_count)
        .slice(0, 10)
        .map(zone => ({
          zone: zone.zone,
          trips: zone.trip_count,
          avg_duration: Math.round(zone.avg_duration),
          lat: zone.latitude,
          lon: zone.longitude
        }))
    };

    // Create output directory
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save heatmap data
    const heatmapFile = path.join(outputDir, `heatmap-${formatDate(startDate)}-${formatDate(endDate)}.json`);
    fs.writeFileSync(heatmapFile, JSON.stringify({
      metadata: {
        generated_at: new Date().toISOString(),
        date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
        privacy_epsilon: epsilon,
        total_zones: filteredHeatmap.length,
        total_trips: summary.total_trips
      },
      summary: summary,
      heatmap_data: filteredHeatmap
    }, null, 2));

    // Save GeoJSON format for mapping
    const geoJsonFile = path.join(outputDir, `heatmap-${formatDate(startDate)}-${formatDate(endDate)}.geojson`);
    const geoJson = generateGeoJSON(filteredHeatmap);
    fs.writeFileSync(geoJsonFile, JSON.stringify(geoJson, null, 2));

    // Save CSV format
    const csvFile = path.join(outputDir, `heatmap-${formatDate(startDate)}-${formatDate(endDate)}.csv`);
    const csvContent = generateCSV(filteredHeatmap);
    fs.writeFileSync(csvFile, csvContent);

    console.log('✅ Heatmap generated successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Total zones: ${summary.total_zones}`);
    console.log(`   - Total trips: ${summary.total_trips}`);
    console.log(`   - Average trips per zone: ${summary.avg_trips_per_zone.toFixed(1)}`);
    console.log(`   - Max trips in a zone: ${summary.max_trips_in_zone}`);
    console.log(`   - Min trips in a zone: ${summary.min_trips_in_zone}`);
    console.log(`📁 Files saved:`);
    console.log(`   - JSON: ${heatmapFile}`);
    console.log(`   - GeoJSON: ${geoJsonFile}`);
    console.log(`   - CSV: ${csvFile}`);

    // Print top zones
    console.log('\n🏆 Top 10 Zones by Trip Count:');
    summary.top_zones.forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.zone}: ${zone.trips} trips (${zone.avg_duration}s avg) [${zone.lat.toFixed(3)}, ${zone.lon.toFixed(3)}]`);
    });

    // Print mode distribution
    console.log('\n🚌 Overall Mode Distribution:');
    Object.entries(summary.mode_distribution).forEach(([mode, count]) => {
      const percentage = ((count / summary.total_trips) * 100).toFixed(1);
      console.log(`   - ${mode}: ${count} trips (${percentage}%)`);
    });

    // Print peak hours
    console.log('\n⏰ Peak Hours:');
    summary.peak_hours.forEach((hour, index) => {
      console.log(`   ${index + 1}. ${hour.hour}: ${hour.trips} trips`);
    });

  } catch (error) {
    console.error('❌ Error generating heatmap:', error);
    process.exit(1);
  }
}

function calculateOverallModeDistribution(heatmapData) {
  const modeCounts = {};
  
  heatmapData.forEach(zone => {
    Object.entries(zone.mode_distribution).forEach(([mode, count]) => {
      modeCounts[mode] = (modeCounts[mode] || 0) + count;
    });
  });
  
  return modeCounts;
}

function calculatePeakHours(heatmapData) {
  const hourCounts = {};
  
  heatmapData.forEach(zone => {
    Object.entries(zone.time_buckets).forEach(([timeBucket, count]) => {
      const hour = timeBucket.split(':')[0];
      hourCounts[hour] = (hourCounts[hour] || 0) + count;
    });
  });
  
  return Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour, trips: count }))
    .sort((a, b) => b.trips - a.trips)
    .slice(0, 5);
}

function generateGeoJSON(heatmapData) {
  const features = heatmapData.map(zone => ({
    type: 'Feature',
    properties: {
      zone: zone.zone,
      trip_count: zone.trip_count,
      avg_duration: zone.avg_duration,
      mode_distribution: zone.mode_distribution,
      time_buckets: zone.time_buckets
    },
    geometry: {
      type: 'Point',
      coordinates: [zone.longitude, zone.latitude]
    }
  }));

  return {
    type: 'FeatureCollection',
    features: features
  };
}

function generateCSV(heatmapData) {
  const headers = [
    'zone',
    'latitude',
    'longitude',
    'trip_count',
    'avg_duration',
    'walking_trips',
    'cycling_trips',
    'public_transport_trips',
    'private_vehicle_trips'
  ];
  
  const rows = heatmapData.map(zone => [
    zone.zone,
    zone.latitude,
    zone.longitude,
    zone.trip_count,
    Math.round(zone.avg_duration),
    zone.mode_distribution.walking || 0,
    zone.mode_distribution.cycling || 0,
    zone.mode_distribution.public_transport || 0,
    zone.mode_distribution.private_vehicle || 0
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Run if called directly
if (require.main === module) {
  generateHeatmap();
}

module.exports = { generateHeatmap };


