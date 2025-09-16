import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Trip, TripDetectionState } from '../types';
import { databaseService } from '../services/DatabaseService';
import { tripDetectionService } from '../services/TripDetectionService';
import { syncService } from '../services/SyncService';
import { getTravelModeColor } from '../constants/Colors';
import { formatDistance, formatDuration, formatTime } from '../utils/formatters';

export default function HomeScreen({ navigation }: any) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detectionState, setDetectionState] = useState<Partial<TripDetectionState>>({});
  const [syncStatus, setSyncStatus] = useState(syncService.getSyncStatus());

  useEffect(() => {
    loadTrips();
    setupListeners();
    
    return () => {
      // Cleanup listeners
      tripDetectionService.removeTripListener(handleNewTrip);
      syncService.removeSyncStatusListener(handleSyncStatusChange);
    };
  }, []);

  const setupListeners = () => {
    // Listen for new trips
    tripDetectionService.addTripListener(handleNewTrip);
    
    // Listen for sync status changes
    syncService.addSyncStatusListener(handleSyncStatusChange);
    
    // Update detection state periodically
    const interval = setInterval(() => {
      setDetectionState(tripDetectionService.getCurrentState());
    }, 1000);
    
    return () => clearInterval(interval);
  };

  const handleNewTrip = async (trip: Trip) => {
    // Save trip to database
    await databaseService.saveTrip(trip);
    
    // Refresh trips list
    await loadTrips();
    
    // Show notification
    Alert.alert(
      'Trip Detected',
      `New trip detected: ${trip.origin.place_name} to ${trip.destination.place_name}`,
      [
        { text: 'View Details', onPress: () => navigation.navigate('TripDetail', { tripId: trip.trip_id }) },
        { text: 'OK' },
      ]
    );
  };

  const handleSyncStatusChange = (status: any) => {
    setSyncStatus(status);
  };

  const loadTrips = async () => {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const userTrips = await databaseService.getTrips(userId, 50, 0);
        setTrips(userTrips);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTrips();
    setIsRefreshing(false);
  };

  const handleStartTracking = async () => {
    try {
      await tripDetectionService.startTracking();
      Alert.alert('Success', 'Trip tracking started');
    } catch (error) {
      Alert.alert('Error', 'Failed to start tracking. Please check location permissions.');
    }
  };

  const handleStopTracking = async () => {
    try {
      await tripDetectionService.stopTracking();
      Alert.alert('Success', 'Trip tracking stopped');
    } catch (error) {
      Alert.alert('Error', 'Failed to stop tracking');
    }
  };

  const handleForceSync = async () => {
    try {
      await syncService.forceSync();
      Alert.alert('Success', 'Sync completed');
    } catch (error) {
      Alert.alert('Error', 'Sync failed');
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

  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.tripItem}
      onPress={() => navigation.navigate('TripDetail', { tripId: item.trip_id })}
    >
      <View style={styles.tripHeader}>
        <View style={styles.tripInfo}>
          <Text style={styles.tripRoute}>
            {item.origin.place_name} → {item.destination.place_name}
          </Text>
          <Text style={styles.tripTime}>
            {formatTime(item.start_time)} - {formatTime(item.end_time)}
          </Text>
        </View>
        <View style={styles.tripStatus}>
          {item.synced ? (
            <Text style={styles.syncedIcon}>✓</Text>
          ) : (
            <Text style={styles.unsyncedIcon}>⏳</Text>
          )}
        </View>
      </View>
      
      <View style={styles.tripDetails}>
        <View style={styles.tripDetailItem}>
          <Text style={styles.tripDetailLabel}>Mode</Text>
          <View style={[styles.modeBadge, { backgroundColor: getTravelModeColor(item.travel_mode.detected) }]}>
            <Text style={styles.modeText}>{item.travel_mode.detected}</Text>
          </View>
        </View>
        
        <View style={styles.tripDetailItem}>
          <Text style={styles.tripDetailLabel}>Distance</Text>
          <Text style={styles.tripDetailValue}>{formatDistance(item.distance_meters)}</Text>
        </View>
        
        <View style={styles.tripDetailItem}>
          <Text style={styles.tripDetailLabel}>Duration</Text>
          <Text style={styles.tripDetailValue}>{formatDuration(item.duration_seconds)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No trips yet</Text>
      <Text style={styles.emptyStateText}>
        Start tracking to automatically detect your trips
      </Text>
      <TouchableOpacity
        style={styles.startTrackingButton}
        onPress={handleStartTracking}
      >
        <Text style={styles.startTrackingButtonText}>Start Tracking</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Tracking</Text>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: detectionState.isTracking ? Colors.success : Colors.textSecondary }
            ]}>
              <Text style={styles.statusText}>
                {detectionState.isTracking ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Sync</Text>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: syncStatus.isOnline ? Colors.success : Colors.warning }
            ]}>
              <Text style={styles.statusText}>
                {syncStatus.isOnline ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
          
          {syncStatus.pendingTrips > 0 && (
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Pending</Text>
              <Text style={styles.pendingCount}>{syncStatus.pendingTrips}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, detectionState.isTracking && styles.controlButtonActive]}
            onPress={detectionState.isTracking ? handleStopTracking : handleStartTracking}
          >
            <Text style={styles.controlButtonText}>
              {detectionState.isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleForceSync}
            disabled={!syncStatus.isOnline}
          >
            <Text style={[styles.controlButtonText, !syncStatus.isOnline && styles.controlButtonDisabled]}>
              Sync Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={trips}
        renderItem={renderTripItem}
        keyExtractor={(item) => item.trip_id}
        contentContainerStyle={trips.length === 0 ? styles.emptyContainer : styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: Colors.textInverse,
    fontWeight: 'bold',
  },
  pendingCount: {
    fontSize: 14,
    color: Colors.warning,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  controlButtonActive: {
    backgroundColor: Colors.error,
  },
  controlButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  controlButtonDisabled: {
    color: Colors.textSecondary,
  },
  listContainer: {
    padding: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tripItem: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tripInfo: {
    flex: 1,
  },
  tripRoute: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  tripTime: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  tripStatus: {
    marginLeft: 10,
  },
  syncedIcon: {
    fontSize: 16,
    color: Colors.success,
  },
  unsyncedIcon: {
    fontSize: 16,
    color: Colors.warning,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tripDetailItem: {
    alignItems: 'center',
  },
  tripDetailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  tripDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeText: {
    fontSize: 12,
    color: Colors.textInverse,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  startTrackingButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startTrackingButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
