import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { User, ConsentRecord } from '../types';
import { databaseService } from '../services/DatabaseService';
import { syncService } from '../services/SyncService';
import { formatFileSize } from '../utils/formatters';

export default function PrivacyScreen({ navigation }: any) {
  const [user, setUser] = useState<User | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [dataSize, setDataSize] = useState<number>(0);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        // Load user data
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        const userData = await AsyncStorage.getItem('current_user');
        if (userData) {
          setUser(JSON.parse(userData));
        }

        // Load consent record
        const consentRecord = await databaseService.getConsentRecord(userId, '1.0.0');
        setConsent(consentRecord);

        // Calculate data size
        const userDataExport = await databaseService.exportUserData(userId);
        const dataString = JSON.stringify(userDataExport);
        setDataSize(new Blob([dataString]).size);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
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

  const handleUpdateConsent = async (field: keyof ConsentRecord, value: boolean) => {
    if (!consent) return;

    try {
      const updatedConsent: ConsentRecord = {
        ...consent,
        [field]: value,
        consent_timestamp: new Date().toISOString(),
      };

      await databaseService.saveConsentRecord(updatedConsent);
      await syncService.syncConsentRecords();
      setConsent(updatedConsent);

      Alert.alert('Success', 'Privacy settings updated');
    } catch (error) {
      console.error('Failed to update consent:', error);
      Alert.alert('Error', 'Failed to update privacy settings');
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
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete data');
            }
          },
        },
      ]
    );
  };

  const handleRequestDataDeletion = async () => {
    try {
      await syncService.deleteUserData();
      Alert.alert(
        'Data Deletion Requested',
        'Your data deletion request has been submitted. All your data will be permanently deleted within 30 days.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit deletion request');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Privacy & Data</Text>
          <Text style={styles.subtitle}>
            Control how your data is used and stored
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Data</Text>
          
          <View style={styles.dataCard}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Data Size</Text>
              <Text style={styles.dataValue}>{formatFileSize(dataSize)}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>User ID</Text>
              <Text style={styles.dataValue}>{user?.user_id.substring(0, 8)}...</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Account Created</Text>
              <Text style={styles.dataValue}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Collection</Text>
          
          <View style={styles.consentCard}>
            <View style={styles.consentItem}>
              <View style={styles.consentInfo}>
                <Text style={styles.consentLabel}>Background Location Tracking</Text>
                <Text style={styles.consentDescription}>
                  Allow the app to track your location in the background to automatically detect trips.
                </Text>
              </View>
              <Switch
                value={consent?.background_tracking_consent || false}
                onValueChange={(value) => handleUpdateConsent('background_tracking_consent', value)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={consent?.background_tracking_consent ? Colors.primary : Colors.textSecondary}
              />
            </View>

            <View style={styles.consentItem}>
              <View style={styles.consentInfo}>
                <Text style={styles.consentLabel}>Data Sharing for Research</Text>
                <Text style={styles.consentDescription}>
                  Share anonymized trip data for transportation research and planning.
                </Text>
              </View>
              <Switch
                value={consent?.data_sharing_consent || false}
                onValueChange={(value) => handleUpdateConsent('data_sharing_consent', value)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={consent?.data_sharing_consent ? Colors.primary : Colors.textSecondary}
              />
            </View>

            <View style={styles.consentItem}>
              <View style={styles.consentInfo}>
                <Text style={styles.consentLabel}>Analytics & App Improvement</Text>
                <Text style={styles.consentDescription}>
                  Help us improve the app by sharing usage analytics (no location data).
                </Text>
              </View>
              <Switch
                value={consent?.analytics_consent || false}
                onValueChange={(value) => handleUpdateConsent('analytics_consent', value)}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={consent?.analytics_consent ? Colors.primary : Colors.textSecondary}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Protections</Text>
          
          <View style={styles.protectionCard}>
            <View style={styles.protectionItem}>
              <Text style={styles.protectionIcon}>🔒</Text>
              <View style={styles.protectionInfo}>
                <Text style={styles.protectionTitle}>End-to-End Encryption</Text>
                <Text style={styles.protectionDescription}>
                  All your data is encrypted on your device before being sent to our servers.
                </Text>
              </View>
            </View>

            <View style={styles.protectionItem}>
              <Text style={styles.protectionIcon}>📍</Text>
              <View style={styles.protectionInfo}>
                <Text style={styles.protectionTitle}>Location Anonymization</Text>
                <Text style={styles.protectionDescription}>
                  Your exact location is never stored. Only aggregated zone data is used for research.
                </Text>
              </View>
            </View>

            <View style={styles.protectionItem}>
              <Text style={styles.protectionIcon}>⏰</Text>
              <View style={styles.protectionInfo}>
                <Text style={styles.protectionTitle}>Time Aggregation</Text>
                <Text style={styles.protectionDescription}>
                  Trip times are rounded to 5-minute intervals to protect your privacy.
                </Text>
              </View>
            </View>

            <View style={styles.protectionItem}>
              <Text style={styles.protectionIcon}>🆔</Text>
              <View style={styles.protectionInfo}>
                <Text style={styles.protectionTitle}>Pseudonymous IDs</Text>
                <Text style={styles.protectionDescription}>
                  Your identity is protected with pseudonymous user IDs that cannot be traced back to you.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleExportData}
          >
            <Text style={styles.actionButtonIcon}>📥</Text>
            <View style={styles.actionButtonInfo}>
              <Text style={styles.actionButtonTitle}>Export Your Data</Text>
              <Text style={styles.actionButtonDescription}>
                Download a copy of all your trip data
              </Text>
            </View>
            <Text style={styles.actionButtonChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRequestDataDeletion}
          >
            <Text style={styles.actionButtonIcon}>🗑️</Text>
            <View style={styles.actionButtonInfo}>
              <Text style={styles.actionButtonTitle}>Request Data Deletion</Text>
              <Text style={styles.actionButtonDescription}>
                Request deletion of your data from our servers
              </Text>
            </View>
            <Text style={styles.actionButtonChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleDeleteData}
          >
            <Text style={styles.actionButtonIcon}>⚠️</Text>
            <View style={styles.actionButtonInfo}>
              <Text style={[styles.actionButtonTitle, styles.dangerText]}>Delete All Data</Text>
              <Text style={styles.actionButtonDescription}>
                Permanently delete all your data (cannot be undone)
              </Text>
            </View>
            <Text style={styles.actionButtonChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rights</Text>
          
          <View style={styles.rightsCard}>
            <Text style={styles.rightsText}>
              You have the right to:
            </Text>
            <Text style={styles.rightsItem}>• Access your personal data</Text>
            <Text style={styles.rightsItem}>• Correct inaccurate data</Text>
            <Text style={styles.rightsItem}>• Delete your data</Text>
            <Text style={styles.rightsItem}>• Export your data</Text>
            <Text style={styles.rightsItem}>• Withdraw consent at any time</Text>
            <Text style={styles.rightsItem}>• Object to data processing</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          
          <View style={styles.contactCard}>
            <Text style={styles.contactText}>
              For privacy-related questions or concerns, please contact our privacy team:
            </Text>
            <Text style={styles.contactEmail}>privacy@smarttraveldiary.com</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated: {new Date().toLocaleDateString()}
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  dataCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dataLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dataValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  consentCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  consentInfo: {
    flex: 1,
    marginRight: 15,
  },
  consentLabel: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  consentDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  protectionCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  protectionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  protectionIcon: {
    fontSize: 24,
    marginRight: 15,
    marginTop: 2,
  },
  protectionInfo: {
    flex: 1,
  },
  protectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  protectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dangerButton: {
    borderColor: Colors.error,
  },
  actionButtonIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  actionButtonInfo: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  actionButtonDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionButtonChevron: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginLeft: 10,
  },
  dangerText: {
    color: Colors.error,
  },
  rightsCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rightsText: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
    fontWeight: '500',
  },
  rightsItem: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  contactEmail: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
