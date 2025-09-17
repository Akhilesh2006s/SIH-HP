import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { EncryptionService } from '../utils/encryption';
import { apiService } from '../services/ApiService';
import { databaseService } from '../services/DatabaseService';
import { User, SignupData, LoginCredentials } from '../types';
import { SignupRequest } from '../types/Api';
import { APP_CONFIG } from '../constants/Config';

interface OnboardingScreenProps {
  onAuthentication: (user: User) => void;
}

export default function OnboardingScreen({ onAuthentication }: OnboardingScreenProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      // Generate encryption key for user
      const userKey = await EncryptionService.generateUserKey();
      await EncryptionService.storeUserKey(userKey);

      // Generate pseudonymous user ID
      const userId = await EncryptionService.generatePseudonymousUserId(email);

      // Hash password
      const hashedPassword = await EncryptionService.hashPassword(password);

      // Create signup data
      const signupData: SignupRequest = {
        email,
        password: hashedPassword,
        consent_version: APP_CONFIG.CONSENT_VERSION,
        privacy_settings: {
          data_retention_days: APP_CONFIG.DEFAULT_DATA_RETENTION_DAYS,
          allow_analytics: true,
          allow_research: true,
          anonymization_level: 'basic',
        },
      };

      // Sign up with server
      const response = await apiService.signup(signupData);

      // Store user data locally
      const user: User = {
        user_id: userId,
        email_hash: response.user.email_hash,
        created_at: response.user.created_at,
        last_login: new Date().toISOString(),
        is_active: true,
        privacy_settings: {
          data_retention_days: APP_CONFIG.DEFAULT_DATA_RETENTION_DAYS,
          allow_analytics: true,
          allow_research: true,
          anonymization_level: 'basic',
          export_data: true,
          delete_data: true,
        },
      };

      // Save user to local storage
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('current_user', JSON.stringify(user));

      // Initialize user preferences
      await databaseService.saveUserPreferences({
        user_id: userId,
        background_tracking_enabled: true,
        sync_frequency_minutes: 30,
        battery_optimization: true,
        privacy_mode: false,
        reward_notifications: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      onAuthentication(user);

    } catch (error) {
      console.error('Signup failed:', error);
      Alert.alert('Signup Failed', error.message || 'An error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      // Login with server
      const credentials: LoginCredentials = { email, password };
      const response = await apiService.login(credentials);

      // Generate pseudonymous user ID (should match server)
      const userId = await EncryptionService.generatePseudonymousUserId(email);

      // Create user object
      const user: User = {
        user_id: userId,
        email_hash: response.user.email_hash,
        created_at: response.user.created_at,
        last_login: new Date().toISOString(),
        is_active: true,
        privacy_settings: {
          data_retention_days: APP_CONFIG.DEFAULT_DATA_RETENTION_DAYS,
          allow_analytics: true,
          allow_research: true,
          anonymization_level: 'basic',
          export_data: true,
          delete_data: true,
        },
      };

      // Save user to local storage
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('current_user', JSON.stringify(user));

      onAuthentication(user);

    } catch (error) {
      console.error('Login failed:', error);
      Alert.alert('Login Failed', error.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Smart Travel Diary</Text>
            <Text style={styles.subtitle}>
              Track your trips automatically while protecting your privacy
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {isSignup && (
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={isSignup ? handleSignup : handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Please wait...' : (isSignup ? 'Sign Up' : 'Log In')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignup(!isSignup)}
            >
              <Text style={styles.switchText}>
                {isSignup
                  ? 'Already have an account? Log In'
                  : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyText}>
              🔒 Your data is encrypted and anonymized. We never store your exact location or personal information.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
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
  form: {
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: Colors.background,
  },
  button: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    alignItems: 'center',
    padding: 10,
  },
  switchText: {
    color: Colors.primary,
    fontSize: 14,
  },
  privacyNote: {
    backgroundColor: Colors.privacyLight,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.privacy,
  },
  privacyText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});


