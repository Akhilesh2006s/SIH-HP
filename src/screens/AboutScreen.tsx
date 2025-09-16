import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';

export default function AboutScreen({ navigation }: any) {
  const handleOpenLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error('Failed to open link:', err));
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@smarttraveldiary.com').catch(err => 
      console.error('Failed to open email:', err)
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.logo}>🚗</Text>
          <Text style={styles.title}>Smart Travel Diary</Text>
          <Text style={styles.version}>Version 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About This App</Text>
          <Text style={styles.description}>
            Smart Travel Diary is a privacy-first mobile application that automatically tracks your travel patterns 
            to help researchers and city planners make better transportation decisions. Your data is encrypted, 
            anonymized, and used only for research purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          
          <View style={styles.stepCard}>
            <View style={styles.stepItem}>
              <Text style={styles.stepNumber}>1</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Automatic Detection</Text>
                <Text style={styles.stepDescription}>
                  The app uses GPS and motion sensors to automatically detect when you start and end trips.
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <Text style={styles.stepNumber}>2</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Privacy Protection</Text>
                <Text style={styles.stepDescription}>
                  Your data is encrypted on your device and anonymized before being shared for research.
                </Text>
              </View>
            </View>

            <View style={styles.stepItem}>
              <Text style={styles.stepNumber}>3</Text>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Research Impact</Text>
                <Text style={styles.stepDescription}>
                  Anonymized data helps researchers understand travel patterns and improve transportation systems.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          
          <View style={styles.featureCard}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🔒</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>End-to-End Encryption</Text>
                <Text style={styles.featureDescription}>
                  All data is encrypted on your device before transmission
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📍</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Location Anonymization</Text>
                <Text style={styles.featureDescription}>
                  Exact locations are never stored, only aggregated zone data
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⏰</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Time Aggregation</Text>
                <Text style={styles.featureDescription}>
                  Trip times are rounded to 5-minute intervals for privacy
                </Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🆔</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Pseudonymous IDs</Text>
                <Text style={styles.featureDescription}>
                  Your identity is protected with untraceable user IDs
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Research Impact</Text>
          
          <View style={styles.impactCard}>
            <Text style={styles.impactTitle}>How Your Data Helps</Text>
            <Text style={styles.impactDescription}>
              Your anonymized travel data contributes to important research that helps:
            </Text>
            
            <View style={styles.impactList}>
              <Text style={styles.impactItem}>• Improve public transportation routes and schedules</Text>
              <Text style={styles.impactItem}>• Optimize traffic flow and reduce congestion</Text>
              <Text style={styles.impactItem}>• Plan new bike lanes and pedestrian infrastructure</Text>
              <Text style={styles.impactItem}>• Understand environmental impact of transportation</Text>
              <Text style={styles.impactItem}>• Make cities more accessible and sustainable</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partners & Research</Text>
          
          <View style={styles.partnerCard}>
            <Text style={styles.partnerTitle}>NATPAC</Text>
            <Text style={styles.partnerDescription}>
              This app is developed in collaboration with the National Association of Transportation Planning 
              and Analysis Centers (NATPAC) to support transportation research and planning.
            </Text>
          </View>

          <View style={styles.partnerCard}>
            <Text style={styles.partnerTitle}>Academic Partners</Text>
            <Text style={styles.partnerDescription}>
              Research data is shared with accredited universities and research institutions 
              for transportation and urban planning studies.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Contact</Text>
          
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactSupport}
          >
            <Text style={styles.contactButtonIcon}>📧</Text>
            <View style={styles.contactButtonContent}>
              <Text style={styles.contactButtonTitle}>Contact Support</Text>
              <Text style={styles.contactButtonDescription}>
                Get help with the app or report issues
              </Text>
            </View>
            <Text style={styles.contactButtonChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleOpenLink('https://smarttraveldiary.com/privacy')}
          >
            <Text style={styles.contactButtonIcon}>🔒</Text>
            <View style={styles.contactButtonContent}>
              <Text style={styles.contactButtonTitle}>Privacy Policy</Text>
              <Text style={styles.contactButtonDescription}>
                Read our detailed privacy policy
              </Text>
            </View>
            <Text style={styles.contactButtonChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => handleOpenLink('https://smarttraveldiary.com/terms')}
          >
            <Text style={styles.contactButtonIcon}>📄</Text>
            <View style={styles.contactButtonContent}>
              <Text style={styles.contactButtonTitle}>Terms of Service</Text>
              <Text style={styles.contactButtonDescription}>
                Read our terms and conditions
              </Text>
            </View>
            <Text style={styles.contactButtonChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Source</Text>
          
          <View style={styles.opensourceCard}>
            <Text style={styles.opensourceDescription}>
              This app is built with open source technologies and follows privacy-first principles. 
              The source code is available for review and contribution.
            </Text>
            
            <TouchableOpacity
              style={styles.githubButton}
              onPress={() => handleOpenLink('https://github.com/smarttraveldiary/app')}
            >
              <Text style={styles.githubButtonText}>View on GitHub</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Smart Travel Diary{'\n'}
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
  header: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logo: {
    fontSize: 64,
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  version: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  section: {
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  stepCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 30,
    marginRight: 15,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  featureCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 15,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  impactCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  impactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
  },
  impactDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 15,
  },
  impactList: {
    marginLeft: 10,
  },
  impactItem: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  partnerCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    marginBottom: 15,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  partnerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  partnerDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  contactButton: {
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
  contactButtonIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  contactButtonContent: {
    flex: 1,
  },
  contactButtonTitle: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 4,
  },
  contactButtonDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  contactButtonChevron: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginLeft: 10,
  },
  opensourceCard: {
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  opensourceDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 15,
  },
  githubButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  githubButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
