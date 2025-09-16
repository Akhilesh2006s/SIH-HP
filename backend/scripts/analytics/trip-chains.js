#!/usr/bin/env node

/**
 * Trip Chain Pattern Analyzer
 * Analyzes trip chain patterns for NATPAC transportation analysis
 */

const { anonymizationService } = require('../src/services/anonymizationService');
const fs = require('fs');
const path = require('path');

async function analyzeTripChains() {
  console.log('🔗 Analyzing Trip Chain Patterns for NATPAC...');
  
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

    // Generate trip chain patterns
    const tripChains = await anonymizationService.generateTripChainPatterns(startDate, endDate);
    
    // Apply differential privacy to frequencies
    const epsilon = 1.0; // Privacy parameter
    const frequencies = tripChains.map(chain => chain.frequency);
    const privateFrequencies = anonymizationService.applyDifferentialPrivacy(frequencies, epsilon);
    
    // Update trip chains with private frequencies
    tripChains.forEach((chain, index) => {
      chain.frequency = privateFrequencies[index];
    });

    // Filter out patterns with 0 frequency (due to noise)
    const filteredChains = tripChains.filter(chain => chain.frequency > 0);

    // Generate summary statistics
    const summary = {
      total_patterns: filteredChains.length,
      total_chain_instances: filteredChains.reduce((sum, chain) => sum + chain.frequency, 0),
      avg_chain_length: filteredChains.reduce((sum, chain) => sum + chain.chain_length, 0) / filteredChains.length,
      max_chain_length: Math.max(...filteredChains.map(chain => chain.chain_length)),
      min_chain_length: Math.min(...filteredChains.map(chain => chain.chain_length)),
      chain_length_distribution: calculateChainLengthDistribution(filteredChains),
      top_patterns: filteredChains
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10)
        .map(chain => ({
          pattern: chain.pattern.join(' → '),
          frequency: chain.frequency,
          chain_length: chain.chain_length,
          avg_duration: Math.round(chain.avg_duration),
          avg_distance: Math.round(chain.avg_distance)
        })),
      common_sequences: findCommonSequences(filteredChains)
    };

    // Create output directory
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save trip chain analysis
    const chainsFile = path.join(outputDir, `trip-chains-${formatDate(startDate)}-${formatDate(endDate)}.json`);
    fs.writeFileSync(chainsFile, JSON.stringify({
      metadata: {
        generated_at: new Date().toISOString(),
        date_range: { start: startDate.toISOString(), end: endDate.toISOString() },
        privacy_epsilon: epsilon,
        total_patterns: filteredChains.length,
        total_chain_instances: summary.total_chain_instances
      },
      summary: summary,
      trip_chains: filteredChains
    }, null, 2));

    // Save CSV format
    const csvFile = path.join(outputDir, `trip-chains-${formatDate(startDate)}-${formatDate(endDate)}.csv`);
    const csvContent = generateCSV(filteredChains);
    fs.writeFileSync(csvFile, csvContent);

    // Save pattern frequency matrix
    const matrixFile = path.join(outputDir, `pattern-matrix-${formatDate(startDate)}-${formatDate(endDate)}.json`);
    const patternMatrix = generatePatternMatrix(filteredChains);
    fs.writeFileSync(matrixFile, JSON.stringify(patternMatrix, null, 2));

    console.log('✅ Trip Chain Analysis completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Total patterns: ${summary.total_patterns}`);
    console.log(`   - Total chain instances: ${summary.total_chain_instances}`);
    console.log(`   - Average chain length: ${summary.avg_chain_length.toFixed(1)}`);
    console.log(`   - Max chain length: ${summary.max_chain_length}`);
    console.log(`   - Min chain length: ${summary.min_chain_length}`);
    console.log(`📁 Files saved:`);
    console.log(`   - JSON: ${chainsFile}`);
    console.log(`   - CSV: ${csvFile}`);
    console.log(`   - Pattern Matrix: ${matrixFile}`);

    // Print top patterns
    console.log('\n🏆 Top 10 Trip Chain Patterns:');
    summary.top_patterns.forEach((pattern, index) => {
      console.log(`   ${index + 1}. ${pattern.pattern}`);
      console.log(`      Frequency: ${pattern.frequency}, Length: ${pattern.chain_length}, Avg Duration: ${pattern.avg_duration}s, Avg Distance: ${pattern.avg_distance}m`);
    });

    // Print chain length distribution
    console.log('\n📏 Chain Length Distribution:');
    Object.entries(summary.chain_length_distribution).forEach(([length, count]) => {
      const percentage = ((count / summary.total_patterns) * 100).toFixed(1);
      console.log(`   - Length ${length}: ${count} patterns (${percentage}%)`);
    });

    // Print common sequences
    console.log('\n🔄 Most Common Trip Sequences:');
    summary.common_sequences.forEach((sequence, index) => {
      console.log(`   ${index + 1}. ${sequence.sequence}: ${sequence.frequency} occurrences`);
    });

  } catch (error) {
    console.error('❌ Error analyzing trip chains:', error);
    process.exit(1);
  }
}

function calculateChainLengthDistribution(tripChains) {
  const distribution = {};
  
  tripChains.forEach(chain => {
    const length = chain.chain_length;
    distribution[length] = (distribution[length] || 0) + 1;
  });
  
  return distribution;
}

function findCommonSequences(tripChains) {
  const sequenceCounts = {};
  
  tripChains.forEach(chain => {
    // Extract all 2-trip sequences from the chain
    for (let i = 0; i < chain.pattern.length - 1; i++) {
      const sequence = `${chain.pattern[i]} → ${chain.pattern[i + 1]}`;
      sequenceCounts[sequence] = (sequenceCounts[sequence] || 0) + chain.frequency;
    }
  });
  
  return Object.entries(sequenceCounts)
    .map(([sequence, frequency]) => ({ sequence, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}

function generatePatternMatrix(tripChains) {
  // Create a matrix showing transitions between zones
  const zones = new Set();
  tripChains.forEach(chain => {
    chain.pattern.forEach(zone => zones.add(zone));
  });
  
  const zoneArray = Array.from(zones);
  const matrix = {};
  
  // Initialize matrix
  zoneArray.forEach(origin => {
    matrix[origin] = {};
    zoneArray.forEach(destination => {
      matrix[origin][destination] = 0;
    });
  });
  
  // Fill matrix with transition counts
  tripChains.forEach(chain => {
    for (let i = 0; i < chain.pattern.length - 1; i++) {
      const origin = chain.pattern[i];
      const destination = chain.pattern[i + 1];
      matrix[origin][destination] += chain.frequency;
    }
  });
  
  return {
    zones: zoneArray,
    transition_matrix: matrix,
    metadata: {
      total_transitions: tripChains.reduce((sum, chain) => sum + chain.frequency * (chain.chain_length - 1), 0),
      unique_zones: zoneArray.length
    }
  };
}

function generateCSV(tripChains) {
  const headers = [
    'pattern_id',
    'chain_length',
    'pattern',
    'frequency',
    'avg_duration',
    'avg_distance'
  ];
  
  const rows = tripChains.map(chain => [
    chain.pattern_id,
    chain.chain_length,
    chain.pattern.join('|'),
    chain.frequency,
    Math.round(chain.avg_duration),
    Math.round(chain.avg_distance)
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Run if called directly
if (require.main === module) {
  analyzeTripChains();
}

module.exports = { analyzeTripChains };
