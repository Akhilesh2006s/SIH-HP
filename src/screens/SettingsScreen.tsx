import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { UserPreferences } from '../types';
import { databaseService } from '../services/DatabaseService';
import { tripDetectionService } from '../services/TripDetectionService';
import { syncService } from '../services/SyncService';

export default function SettingsScreen({ navigation }: any) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState(syncService.getSyncStatus());

  useEffect(() => {
    loadPreferences();
    setupListeners();
    
    return () => {
      syncService.removeSyncStatusListener(handleSyncStatusChange);
    };
  }, []);

  const setupListeners = () => {
    syncService.addSyncStatusListener(handleSyncStatusChange);
  };

  const handleSyncStatusChange = (status: any) => {
    setSyncStatus(status);
  };

  const loadPreferences = async () => {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const userPreferences = await databaseService.getUserPreferences(userId);
        if (userPreferences) {
          setPreferences(userPreferences);
          setIsTrackingEnabled(userPreferences.background_tracking_enabled);
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
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

  const updatePreference = async (key: keyof UserPreferences, value: any) => {
    if (!preferences) return;

    try {
      const updatedPreferences: UserPreferences = {
        ...preferences,
        [key]: value,
        updated_at: new Date().toISOString(),
      };

      await databaseService.saveUserPreferences(updatedPreferences);
      setPreferences(updatedPreferences);

      // Handle specific preference changes
      if (key === 'background_tracking_enabled') {
        if (value) {
          await tripDetectionService.startTracking();
        } else {
          await tripDetectionService.stopTracking();
        }
        setIsTrackingEnabled(value);
      }
    } catch (error) {
      console.error('Failed to update preference:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleSyncFrequencyChange = (frequency: number) => {
    updatePreference('sync_frequency_minutes', frequency);
  };

  const handleForceSync = async () => {
    try {
      await syncService.forceSync();
      Alert.alert('Success', 'Sync completed');
    } catch (error) {
      Alert.alert('Error', 'Sync failed');
    }
  };

  const handleExportData = async () => {
    try {
      const exportUrl = await syncService.exportUserData('json');
      Alert.alert(
        'Data Export',
        `Your data has been exported. Download URL: ${exportUrl}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your trip data and cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await syncService.deleteUserData();
              Alert.alert('Success', 'All data has been deleted');
              // Navigate back to onboarding
              navigation.reset({
                index: 0,
                routes: [{ name: 'Onboarding' }],
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete data');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await syncService.destroy();
              await tripDetectionService.stopTracking();
              // Clear local storage
              const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
              await AsyncStorage.removeItem('current_user');
              await AsyncStorage.removeItem('auth_tokens');
              
              navigation.reset({
                index: 0,
                routes: [{ name: 'Onboarding' }],
              });
            } catch (error) {
              console.error('Logout failed:', error);
            }
          },
        },
      ]
    );
  };

  if (!preferences) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tracking</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Background Tracking</Text>
              <Text style={styles.settingDescription}>
                Automatically detect trips in the background
              </Text>
            </View>
            <Switch
              value={isTrackingEnabled}
              onValueChange={(value) => updatePreference('background_tracking_enabled', value)}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={isTrackingEnabled ? Colors.primary : Colors.textSecondary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Battery Optimization</Text>
              <Text style={styles.settingDescription}>
                Reduce tracking frequency when battery is low
              </Text>
            </View>
            <Switch
              value={preferences.battery_optimization}
              onValueChange={(value) => updatePreference('battery_optimization', value)}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={preferences.battery_optimization ? Colors.primary : Colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync & Data</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sync Frequency</Text>
              <Text style={styles.settingDescription}>
                How often to sync data with the server
              </Text>
            </View>
            <View style={styles.frequencySelector}>
              {[15, 30, 60, 120].map((frequency) => (
                <TouchableOpacity
                  key={frequency}
                  style={[
                    styles.frequencyOption,
                    preferences.sync_frequency_minutes === frequency && styles.selectedFrequencyOption
                  ]}
                  onPress={() => handleSyncFrequencyChange(frequency)}
                >
                  <Text style={[
                    styles.frequencyText,
                    preferences.sync_frequency_minutes === frequency && styles.selectedFrequencyText
                  ]}>
                    {frequency}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sync Status</Text>
              <Text style={styles.settingDescription}>
                {syncStatus.isOnline ? 'Online' : 'Offline'} • {syncStatus.pendingTrips} pending
              </Text>
            </View>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleForceSync}
              disabled={!syncStatus.isOnline}
            >
              <Text style={[styles.syncButtonText, !syncStatus.isOnline && styles.syncButtonDisabled]}>
                Sync Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Privacy Mode</Text>
              <Text style={styles.settingDescription}>
                Enhanced privacy with additional data protection
              </Text>
            </View>
            <Switch
              value={preferences.privacy_mode}
              onValueChange={(value) => updatePreference('privacy_mode', value)}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={preferences.privacy_mode ? Colors.primary : Colors.textSecondary}
            />
          </View>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('Privacy')}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Privacy & Data Controls</Text>
              <Text style={styles.settingDescription}>
                Manage your data and privacy settings
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Reward Notifications</Text>
              <Text style={styles.settingDescription}>
                Get notified when you earn points
              </Text>
            </View>
            <Switch
              value={preferences.reward_notifications}
              onValueChange={(value) => updatePreference('reward_notifications', value)}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={preferences.reward_notifications ? Colors.primary : Colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleExportData}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Export Data</Text>
              <Text style={styles.settingDescription}>
                Download a copy of your trip data
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleDeleteData}
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, styles.dangerText]}>Delete All Data</Text>
              <Text style={styles.settingDescription}>
                Permanently delete all your data
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleLogout}
          >
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, styles.dangerText]}>Sign Out</Text>
              <Text style={styles.settingDescription}>
                Sign out of your account
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Smart Travel Diary v1.0.0{'\n'}
            Built with privacy in mind
          </Text>
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
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 20,
    paddingBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginLeft: 10,
  },
  frequencySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedFrequencyOption: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  frequencyText: {
    fontSize: 12,
    color: Colors.text,
  },
  selectedFrequencyText: {
    color: Colors.textInverse,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  syncButtonText: {
    fontSize: 12,
    color: Colors.textInverse,
    fontWeight: '600',
  },
  syncButtonDisabled: {
    color: Colors.textSecondary,
  },
  dangerText: {
    color: Colors.error,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});


