import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { ConsentRecord } from '../types';
import { APP_CONFIG } from '../constants/Config';

interface ConsentScreenProps {
  onConsentComplete: (consent: ConsentRecord) => void;
}

export default function ConsentScreen({ onConsentComplete }: ConsentScreenProps) {
  const [backgroundTrackingConsent, setBackgroundTrackingConsent] = useState(false);
  const [dataSharingConsent, setDataSharingConsent] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);

  const handleAccept = () => {
    if (!hasReadTerms) {
      Alert.alert('Required', 'Please read and acknowledge the terms before proceeding.');
      return;
    }

    if (!dataSharingConsent) {
      Alert.alert(
        'Data Sharing Required',
        'Data sharing consent is required to use this app. Your data will be anonymized and used only for transportation research.'
      );
      return;
    }

    const consent: ConsentRecord = {
      user_id: '', // Will be set by the parent component
      consent_version: APP_CONFIG.CONSENT_VERSION,
      background_tracking_consent: backgroundTrackingConsent,
      data_sharing_consent: dataSharingConsent,
      analytics_consent: analyticsConsent,
      consent_timestamp: new Date().toISOString(),
    };

    onConsentComplete(consent);
  };

  const handleDecline = () => {
    Alert.alert(
      'Consent Required',
      'This app requires your consent to function. You can change your privacy settings later in the app settings.',
      [
        { text: 'Go Back', style: 'cancel' },
        { text: 'Exit App', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Privacy & Data Consent</Text>
          <Text style={styles.subtitle}>
            We respect your privacy. Please review and consent to how we use your data.
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What We Collect</Text>
            <Text style={styles.sectionText}>
              • GPS location data (anonymized and aggregated){'\n'}
              • Trip start/end times (rounded to 5-minute intervals){'\n'}
              • Travel mode (walking, cycling, vehicle, etc.){'\n'}
              • Trip purpose (work, shopping, etc.){'\n'}
              • Device sensor data (for trip detection){'\n'}
              • No personal information or exact addresses
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How We Use Your Data</Text>
            <Text style={styles.sectionText}>
              • Transportation planning and research{'\n'}
              • Traffic flow analysis{'\n'}
              • Public transit optimization{'\n'}
              • Environmental impact studies{'\n'}
              • Academic research (with additional consent)
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy Protections</Text>
            <Text style={styles.sectionText}>
              • All data is encrypted on your device{'\n'}
              • Locations are aggregated to zones (not exact addresses){'\n'}
              • Timestamps are rounded to 5-minute intervals{'\n'}
              • You can export or delete your data anytime{'\n'}
              • No data is shared with third parties without consent
            </Text>
          </View>

          <View style={styles.consentSection}>
            <Text style={styles.consentTitle}>Your Consent</Text>
            
            <View style={styles.consentItem}>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentLabel}>Background Location Tracking</Text>
                <Text style={styles.consentDescription}>
                  Allow the app to track your location in the background to automatically detect trips.
                </Text>
              </View>
              <Switch
                value={backgroundTrackingConsent}
                onValueChange={setBackgroundTrackingConsent}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={backgroundTrackingConsent ? Colors.primary : Colors.textSecondary}
              />
            </View>

            <View style={styles.consentItem}>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentLabel}>Data Sharing for Research</Text>
                <Text style={styles.consentDescription}>
                  Share anonymized trip data for transportation research and planning.
                </Text>
              </View>
              <Switch
                value={dataSharingConsent}
                onValueChange={setDataSharingConsent}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={dataSharingConsent ? Colors.primary : Colors.textSecondary}
              />
            </View>

            <View style={styles.consentItem}>
              <View style={styles.consentTextContainer}>
                <Text style={styles.consentLabel}>Analytics & App Improvement</Text>
                <Text style={styles.consentDescription}>
                  Help us improve the app by sharing usage analytics (no location data).
                </Text>
              </View>
              <Switch
                value={analyticsConsent}
                onValueChange={setAnalyticsConsent}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={analyticsConsent ? Colors.primary : Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.termsSection}>
            <TouchableOpacity
              style={styles.termsButton}
              onPress={() => setHasReadTerms(!hasReadTerms)}
            >
              <View style={[styles.checkbox, hasReadTerms && styles.checkboxChecked]}>
                {hasReadTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I have read and agree to the{' '}
                <Text style={styles.linkText}>Privacy Policy</Text> and{' '}
                <Text style={styles.linkText}>Terms of Service</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={handleDecline}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={handleAccept}
        >
          <Text style={styles.acceptButtonText}>Accept & Continue</Text>
        </TouchableOpacity>
      </View>
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
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  consentSection: {
    backgroundColor: Colors.backgroundSecondary,
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  consentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  consentTextContainer: {
    flex: 1,
    marginRight: 15,
  },
  consentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 5,
  },
  consentDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  termsSection: {
    marginBottom: 20,
  },
  termsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  linkText: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  declineButton: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
  },
  declineButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});


