import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Trip } from '../types';
import { databaseService } from '../services/DatabaseService';
import { formatDistance, formatDuration, formatTime } from '../utils/formatters';
import { getTravelModeColor } from '../constants/Colors';

// Note: In a real app, you would use react-native-maps or expo-maps
// For this demo, we'll create a placeholder map component
const MapPlaceholder = ({ trips, onTripSelect }: { trips: Trip[]; onTripSelect: (trip: Trip) => void }) => (
  <View style={styles.mapPlaceholder}>
    <Text style={styles.mapPlaceholderText}>🗺️ Map View</Text>
    <Text style={styles.mapPlaceholderSubtext}>
      {trips.length} trips displayed
    </Text>
    <View style={styles.mapLegend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: Colors.walking }]} />
        <Text style={styles.legendText}>Walking</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: Colors.cycling }]} />
        <Text style={styles.legendText}>Cycling</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: Colors.publicTransport }]} />
        <Text style={styles.legendText}>Public Transport</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: Colors.privateVehicle }]} />
        <Text style={styles.legendText}>Private Vehicle</Text>
      </View>
    </View>
  </View>
);

export default function MapScreen({ navigation }: any) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'today' | 'week'>('today');

  useEffect(() => {
    loadTrips();
  }, [viewMode]);

  const loadTrips = async () => {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const userTrips = await databaseService.getTrips(userId, 100, 0);
        
        // Filter trips based on view mode
        const now = new Date();
        const filteredTrips = userTrips.filter(trip => {
          const tripDate = new Date(trip.start_time);
          
          switch (viewMode) {
            case 'today':
              return tripDate.toDateString() === now.toDateString();
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              return tripDate >= weekAgo;
            case 'all':
            default:
              return true;
          }
        });
        
        setTrips(filteredTrips);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    }
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

  const handleTripSelect = (trip: Trip) => {
    setSelectedTrip(trip);
    navigation.navigate('TripDetail', { tripId: trip.trip_id });
  };

  const getViewModeStats = () => {
    const totalDistance = trips.reduce((sum, trip) => sum + trip.distance_meters, 0);
    const totalDuration = trips.reduce((sum, trip) => sum + trip.duration_seconds, 0);
    const modeCounts = trips.reduce((counts, trip) => {
      counts[trip.travel_mode.detected] = (counts[trip.travel_mode.detected] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return {
      tripCount: trips.length,
      totalDistance,
      totalDuration,
      modeCounts,
    };
  };

  const stats = getViewModeStats();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.viewModeSelector}>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'today' && styles.activeViewMode]}
            onPress={() => setViewMode('today')}
          >
            <Text style={[styles.viewModeText, viewMode === 'today' && styles.activeViewModeText]}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'week' && styles.activeViewMode]}
            onPress={() => setViewMode('week')}
          >
            <Text style={[styles.viewModeText, viewMode === 'week' && styles.activeViewModeText]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'all' && styles.activeViewMode]}
            onPress={() => setViewMode('all')}
          >
            <Text style={[styles.viewModeText, viewMode === 'all' && styles.activeViewModeText]}>
              All
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.tripCount}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDistance(stats.totalDistance)}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatDuration(stats.totalDuration)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapPlaceholder trips={trips} onTripSelect={handleTripSelect} />
      </View>

      <View style={styles.tripList}>
        <Text style={styles.tripListTitle}>Recent Trips</Text>
        {trips.slice(0, 5).map((trip) => (
          <TouchableOpacity
            key={trip.trip_id}
            style={styles.tripItem}
            onPress={() => handleTripSelect(trip)}
          >
            <View style={styles.tripInfo}>
              <Text style={styles.tripRoute}>
                {trip.origin.place_name} → {trip.destination.place_name}
              </Text>
              <Text style={styles.tripTime}>
                {formatTime(trip.start_time)} • {formatDistance(trip.distance_meters)} • {formatDuration(trip.duration_seconds)}
              </Text>
            </View>
            <View style={[styles.modeIndicator, { backgroundColor: getTravelModeColor(trip.travel_mode.detected) }]} />
          </TouchableOpacity>
        ))}
        
        {trips.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No trips found for {viewMode}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 15,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeViewMode: {
    backgroundColor: Colors.primary,
  },
  viewModeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeViewModeText: {
    color: Colors.textInverse,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  mapContainer: {
    flex: 1,
    margin: 15,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundSecondary,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
  },
  mapPlaceholderText: {
    fontSize: 24,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  mapLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tripList: {
    maxHeight: 200,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tripListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    padding: 15,
    paddingBottom: 10,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tripInfo: {
    flex: 1,
  },
  tripRoute: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 2,
  },
  tripTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
