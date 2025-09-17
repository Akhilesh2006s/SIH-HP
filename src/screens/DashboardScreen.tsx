import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Trip, RewardPoints } from '../types';
import { databaseService } from '../services/DatabaseService';
import { formatDistance, formatDuration, formatPoints, formatCO2Savings, formatCostSavings } from '../utils/formatters';
import { getTravelModeColor } from '../constants/Colors';

const { width } = Dimensions.get('window');

// Simple chart component (in a real app, you'd use react-native-chart-kit or similar)
const SimpleBarChart = ({ data, title }: { data: Array<{ label: string; value: number; color: string }>; title: string }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={styles.chart}>
        {data.map((item, index) => (
          <View key={index} style={styles.barContainer}>
            <View style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: (item.value / maxValue) * 100,
                    backgroundColor: item.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{item.label}</Text>
            <Text style={styles.barValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default function DashboardScreen({ navigation }: any) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [rewardPoints, setRewardPoints] = useState<RewardPoints | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const userTrips = await databaseService.getTrips(userId, 1000, 0);
        const userRewards = await databaseService.getRewardPoints(userId);
        
        // Filter trips based on time range
        const filteredTrips = filterTripsByTimeRange(userTrips, timeRange);
        
        setTrips(filteredTrips);
        setRewardPoints(userRewards);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const filterTripsByTimeRange = (trips: Trip[], range: 'week' | 'month' | 'year'): Trip[] => {
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (range) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return trips.filter(trip => new Date(trip.start_time) >= cutoffDate);
  };

  const getCurrentUserId = async (): Promise<string | null> => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const userData = await AsyncStorage.getItem('current_user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.user_id;
      }
    } catch (error) {
      console.error('Failed to get current user ID:', error);
    }
    return null;
  };

  const getStats = () => {
    const totalDistance = trips.reduce((sum, trip) => sum + trip.distance_meters, 0);
    const totalDuration = trips.reduce((sum, trip) => sum + trip.duration_seconds, 0);
    const totalTrips = trips.length;
    
    // Calculate CO2 and cost savings
    const co2Savings = trips.reduce((sum, trip) => {
      const distanceKm = trip.distance_meters / 1000;
      const savings = (0.2 - 0.1) * distanceKm; // Assuming public transport vs private vehicle
      return sum + savings;
    }, 0);
    
    const costSavings = trips.reduce((sum, trip) => {
      const distanceKm = trip.distance_meters / 1000;
      const savings = (0.5 - 0.1) * distanceKm; // Assuming public transport vs private vehicle
      return sum + savings;
    }, 0);
    
    return {
      totalDistance,
      totalDuration,
      totalTrips,
      co2Savings,
      costSavings,
    };
  };

  const getModeDistribution = () => {
    const modeCounts = trips.reduce((counts, trip) => {
      const mode = trip.travel_mode.detected;
      counts[mode] = (counts[mode] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return Object.entries(modeCounts).map(([mode, count]) => ({
      label: mode.replace('_', ' '),
      value: count,
      color: getTravelModeColor(mode),
    }));
  };

  const getDailyStats = () => {
    const dailyCounts: Record<string, number> = {};
    
    trips.forEach(trip => {
      const date = new Date(trip.start_time).toDateString();
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });
    
    // Get last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toDateString();
      last7Days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: dailyCounts[dateString] || 0,
        color: Colors.primary,
      });
    }
    
    return last7Days;
  };

  const getAchievements = () => {
    const stats = getStats();
    const achievements = [];
    
    if (stats.totalTrips >= 10) {
      achievements.push({ title: 'Explorer', description: '10+ trips completed', icon: '🏆' });
    }
    if (stats.totalDistance >= 10000) {
      achievements.push({ title: 'Distance Master', description: '10km+ traveled', icon: '🎯' });
    }
    if (stats.co2Savings >= 5) {
      achievements.push({ title: 'Eco Warrior', description: '5kg+ CO₂ saved', icon: '🌱' });
    }
    if (trips.filter(trip => trip.travel_mode.detected === 'cycling').length >= 5) {
      achievements.push({ title: 'Cycling Enthusiast', description: '5+ cycling trips', icon: '🚴' });
    }
    
    return achievements;
  };

  const stats = getStats();
  const modeDistribution = getModeDistribution();
  const dailyStats = getDailyStats();
  const achievements = getAchievements();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <View style={styles.timeRangeSelector}>
            {(['week', 'month', 'year'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[styles.timeRangeButton, timeRange === range && styles.activeTimeRange]}
                onPress={() => setTimeRange(range)}
              >
                <Text style={[styles.timeRangeText, timeRange === range && styles.activeTimeRangeText]}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalTrips}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDistance(stats.totalDistance)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDuration(stats.totalDuration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatPoints(rewardPoints?.available_points || 0)}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
        </View>

        <View style={styles.savingsCard}>
          <Text style={styles.savingsTitle}>Environmental Impact</Text>
          <View style={styles.savingsRow}>
            <View style={styles.savingItem}>
              <Text style={styles.savingIcon}>🌱</Text>
              <Text style={styles.savingValue}>{stats.co2Savings.toFixed(1)}kg</Text>
              <Text style={styles.savingLabel}>CO₂ Saved</Text>
            </View>
            <View style={styles.savingItem}>
              <Text style={styles.savingIcon}>💰</Text>
              <Text style={styles.savingValue}>${stats.costSavings.toFixed(0)}</Text>
              <Text style={styles.savingLabel}>Cost Saved</Text>
            </View>
          </View>
        </View>

        {modeDistribution.length > 0 && (
          <SimpleBarChart data={modeDistribution} title="Travel Mode Distribution" />
        )}

        {dailyStats.length > 0 && (
          <SimpleBarChart data={dailyStats} title="Trips This Week" />
        )}

        {achievements.length > 0 && (
          <View style={styles.achievementsSection}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achievementsGrid}>
              {achievements.map((achievement, index) => (
                <View key={index} style={styles.achievementCard}>
                  <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                  <Text style={styles.achievementTitle}>{achievement.title}</Text>
                  <Text style={styles.achievementDescription}>{achievement.description}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.impactSection}>
          <Text style={styles.sectionTitle}>Your Impact</Text>
          <View style={styles.impactCard}>
            <Text style={styles.impactText}>
              By sharing your travel data, you're helping researchers and city planners make better transportation decisions.
            </Text>
            <TouchableOpacity
              style={styles.impactButton}
              onPress={() => navigation.navigate('About')}
            >
              <Text style={styles.impactButtonText}>Learn More</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 4,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTimeRange: {
    backgroundColor: Colors.primary,
  },
  timeRangeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTimeRangeText: {
    color: Colors.textInverse,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
  },
  statCard: {
    width: (width - 45) / 2,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 15,
    margin: 7.5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  savingsCard: {
    backgroundColor: Colors.background,
    margin: 15,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  savingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 15,
    textAlign: 'center',
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  savingItem: {
    alignItems: 'center',
  },
  savingIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  savingValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.success,
    marginBottom: 4,
  },
  savingLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chartContainer: {
    backgroundColor: Colors.background,
    margin: 15,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 15,
    textAlign: 'center',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: 100,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bar: {
    width: 20,
    borderRadius: 2,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  achievementsSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 15,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  achievementCard: {
    width: (width - 45) / 2,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 15,
    margin: 7.5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  achievementIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  achievementDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  impactSection: {
    padding: 15,
  },
  impactCard: {
    backgroundColor: Colors.background,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  impactText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  impactButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  impactButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
});


