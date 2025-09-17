import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Trip, TRIP_PURPOSES, TRAVEL_MODES } from '../types';
import { databaseService } from '../services/DatabaseService';
import { apiService } from '../services/ApiService';
import { formatDistance, formatDuration, formatTime, formatDate, formatConfidence } from '../utils/formatters';
import { getTravelModeColor } from '../constants/Colors';

export default function TripDetailScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTrip, setEditedTrip] = useState<Partial<Trip>>({});

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  const loadTrip = async () => {
    try {
      const tripData = await databaseService.getTrip(tripId);
      if (tripData) {
        setTrip(tripData);
        setEditedTrip({
          travel_mode: tripData.travel_mode,
          trip_purpose: tripData.trip_purpose,
          notes: tripData.notes,
          is_private: tripData.is_private,
        });
      }
    } catch (error) {
      console.error('Failed to load trip:', error);
      Alert.alert('Error', 'Failed to load trip details');
    }
  };

  const handleSave = async () => {
    if (!trip) return;

    try {
      const updatedTrip: Trip = {
        ...trip,
        ...editedTrip,
        updated_at: new Date().toISOString(),
      };

      await databaseService.saveTrip(updatedTrip);

      // Send correction to server if needed
      if (editedTrip.travel_mode?.user_confirmed || editedTrip.trip_purpose) {
        await apiService.correctTrip({
          trip_id: trip.trip_id,
          corrections: {
            travel_mode: editedTrip.travel_mode?.user_confirmed,
            trip_purpose: editedTrip.trip_purpose,
            notes: editedTrip.notes,
            is_private: editedTrip.is_private,
          },
        });
      }

      setTrip(updatedTrip);
      setIsEditing(false);
      Alert.alert('Success', 'Trip updated successfully');
    } catch (error) {
      console.error('Failed to save trip:', error);
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleCancel = () => {
    setEditedTrip({
      travel_mode: trip?.travel_mode,
      trip_purpose: trip?.trip_purpose,
      notes: trip?.notes,
      is_private: trip?.is_private,
    });
    setIsEditing(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return Colors.success;
    if (confidence >= 0.6) return Colors.warning;
    return Colors.error;
  };

  if (!trip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading trip details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Trip Details</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Text style={styles.editButtonText}>
              {isEditing ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <View style={styles.locationDot} />
            <Text style={styles.locationText}>{trip.origin.place_name}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeHeader}>
            <View style={[styles.locationDot, styles.destinationDot]} />
            <Text style={styles.locationText}>{trip.destination.place_name}</Text>
          </View>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Trip Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date & Time</Text>
            <Text style={styles.detailValue}>
              {formatDate(trip.start_time)} • {formatTime(trip.start_time)} - {formatTime(trip.end_time)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{formatDuration(trip.duration_seconds)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distance</Text>
            <Text style={styles.detailValue}>{formatDistance(trip.distance_meters)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Trip Number</Text>
            <Text style={styles.detailValue}>#{trip.trip_number}</Text>
          </View>
        </View>

        <View style={styles.modeCard}>
          <Text style={styles.cardTitle}>Travel Mode</Text>
          
          {isEditing ? (
            <View style={styles.editSection}>
              <Text style={styles.editLabel}>Detected Mode</Text>
              <View style={styles.modeInfo}>
                <View style={[styles.modeBadge, { backgroundColor: getTravelModeColor(trip.travel_mode.detected) }]}>
                  <Text style={styles.modeText}>{trip.travel_mode.detected}</Text>
                </View>
                <Text style={styles.confidenceText}>
                  Confidence: {formatConfidence(trip.travel_mode.confidence)}
                </Text>
              </View>
              
              <Text style={styles.editLabel}>Confirm Mode</Text>
              <View style={styles.modeSelector}>
                {TRAVEL_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeOption,
                      editedTrip.travel_mode?.user_confirmed === mode && styles.selectedModeOption
                    ]}
                    onPress={() => setEditedTrip(prev => ({
                      ...prev,
                      travel_mode: {
                        ...prev.travel_mode!,
                        user_confirmed: mode
                      }
                    }))}
                  >
                    <Text style={[
                      styles.modeOptionText,
                      editedTrip.travel_mode?.user_confirmed === mode && styles.selectedModeOptionText
                    ]}>
                      {mode.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.modeInfo}>
              <View style={[styles.modeBadge, { backgroundColor: getTravelModeColor(trip.travel_mode.detected) }]}>
                <Text style={styles.modeText}>{trip.travel_mode.detected}</Text>
              </View>
              {trip.travel_mode.user_confirmed && (
                <Text style={styles.confirmedText}>
                  Confirmed: {trip.travel_mode.user_confirmed}
                </Text>
              )}
              <Text style={[styles.confidenceText, { color: getConfidenceColor(trip.travel_mode.confidence) }]}>
                Confidence: {formatConfidence(trip.travel_mode.confidence)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.purposeCard}>
          <Text style={styles.cardTitle}>Trip Purpose</Text>
          
          {isEditing ? (
            <View style={styles.editSection}>
              <View style={styles.purposeSelector}>
                {TRIP_PURPOSES.map((purpose) => (
                  <TouchableOpacity
                    key={purpose}
                    style={[
                      styles.purposeOption,
                      editedTrip.trip_purpose === purpose && styles.selectedPurposeOption
                    ]}
                    onPress={() => setEditedTrip(prev => ({ ...prev, trip_purpose: purpose }))}
                  >
                    <Text style={[
                      styles.purposeOptionText,
                      editedTrip.trip_purpose === purpose && styles.selectedPurposeOptionText
                    ]}>
                      {purpose.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.purposeText}>{trip.trip_purpose.replace('_', ' ')}</Text>
          )}
        </View>

        <View style={styles.notesCard}>
          <Text style={styles.cardTitle}>Notes</Text>
          
          {isEditing ? (
            <TextInput
              style={styles.notesInput}
              value={editedTrip.notes || ''}
              onChangeText={(text) => setEditedTrip(prev => ({ ...prev, notes: text }))}
              placeholder="Add notes about this trip..."
              multiline
              numberOfLines={3}
            />
          ) : (
            <Text style={styles.notesText}>
              {trip.notes || 'No notes added'}
            </Text>
          )}
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.cardTitle}>Privacy Settings</Text>
          
          {isEditing ? (
            <TouchableOpacity
              style={styles.privacyToggle}
              onPress={() => setEditedTrip(prev => ({ ...prev, is_private: !prev.is_private }))}
            >
              <Text style={styles.privacyToggleText}>
                {editedTrip.is_private ? '🔒 Private' : '🌐 Public'}
              </Text>
              <Text style={styles.privacyToggleDescription}>
                {editedTrip.is_private 
                  ? 'This trip will not be synced to the server'
                  : 'This trip will be synced for research purposes'
                }
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.privacyInfo}>
              <Text style={styles.privacyStatus}>
                {trip.is_private ? '🔒 Private Trip' : '🌐 Public Trip'}
              </Text>
              <Text style={styles.privacyDescription}>
                {trip.is_private 
                  ? 'This trip is not shared with researchers'
                  : 'This trip is shared anonymously for research'
                }
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sensorCard}>
          <Text style={styles.cardTitle}>Sensor Data</Text>
          
          <View style={styles.sensorGrid}>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>GPS Points</Text>
              <Text style={styles.sensorValue}>{trip.sensor_summary.gps_points_count}</Text>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>Avg Speed</Text>
              <Text style={styles.sensorValue}>{(trip.sensor_summary.average_speed * 3.6).toFixed(1)} km/h</Text>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>Max Speed</Text>
              <Text style={styles.sensorValue}>{(trip.sensor_summary.max_speed * 3.6).toFixed(1)} km/h</Text>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>Plausibility</Text>
              <Text style={[styles.sensorValue, { color: getConfidenceColor(trip.plausibility_score || 0.5) }]}>
                {formatConfidence(trip.plausibility_score || 0.5)}
              </Text>
            </View>
          </View>
        </View>

        {isEditing && (
          <View style={styles.saveButtons}>
            <TouchableOpacity
              style={[styles.saveButton, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, styles.confirmButton]}
              onPress={handleSave}
            >
              <Text style={styles.confirmButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  editButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  editButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  routeCard: {
    backgroundColor: Colors.background,
    margin: 15,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginRight: 15,
  },
  destinationDot: {
    backgroundColor: Colors.error,
  },
  locationText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
    marginLeft: 5,
    marginVertical: 5,
  },
  detailsCard: {
    backgroundColor: Colors.background,
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  modeCard: {
    backgroundColor: Colors.background,
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeInfo: {
    alignItems: 'center',
  },
  modeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  modeText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  confirmedText: {
    fontSize: 14,
    color: Colors.success,
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  editSection: {
    marginTop: 10,
  },
  editLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  modeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  modeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedModeOption: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeOptionText: {
    fontSize: 12,
    color: Colors.text,
  },
  selectedModeOptionText: {
    color: Colors.textInverse,
  },
  purposeCard: {
    backgroundColor: Colors.background,
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  purposeText: {
    fontSize: 16,
    color: Colors.text,
    textTransform: 'capitalize',
  },
  purposeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  purposeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedPurposeOption: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  purposeOptionText: {
    fontSize: 12,
    color: Colors.text,
  },
  selectedPurposeOptionText: {
    color: Colors.textInverse,
  },
  notesCard: {
    backgroundColor: Colors.background,
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  privacyCard: {
    backgroundColor: Colors.background,
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privacyInfo: {
    alignItems: 'center',
  },
  privacyStatus: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  privacyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  privacyToggle: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privacyToggleText: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  privacyToggleDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sensorCard: {
    backgroundColor: Colors.background,
    margin: 15,
    marginTop: 0,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sensorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sensorItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
  },
  sensorLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  saveButtons: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  saveButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});


