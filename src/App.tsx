import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

// Services
import { databaseService } from './services/DatabaseService';
import { tripDetectionService } from './services/TripDetectionService';
import { syncService } from './services/SyncService';
import { apiService } from './services/ApiService';

// Screens
import OnboardingScreen from './screens/OnboardingScreen';
import ConsentScreen from './screens/ConsentScreen';
import HomeScreen from './screens/HomeScreen';
import MapScreen from './screens/MapScreen';
import DashboardScreen from './screens/DashboardScreen';
import TripDetailScreen from './screens/TripDetailScreen';
import SettingsScreen from './screens/SettingsScreen';
import PrivacyScreen from './screens/PrivacyScreen';
import AboutScreen from './screens/AboutScreen';

// Components
import DrawerContent from './components/DrawerContent';
import LoadingScreen from './components/LoadingScreen';

// Types
import { User, ConsentRecord } from './types';
import { APP_CONFIG } from './constants/Config';
import { Colors } from './constants/Colors';

const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

interface AppState {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasConsent: boolean;
  user: User | null;
  error: string | null;
}

function MainNavigator() {
  return (
    <Drawer.Navigator
      id={undefined}
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: Colors.textInverse,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        drawerStyle: {
          backgroundColor: Colors.background,
        },
        drawerActiveTintColor: Colors.primary,
        drawerInactiveTintColor: Colors.textSecondary,
      }}
    >
      <Drawer.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Smart Travel Diary',
          drawerIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>🏠</Text>
          ),
        }}
      />
      <Drawer.Screen 
        name="Map" 
        component={MapScreen}
        options={{
          title: 'Map View',
          drawerIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>🗺️</Text>
          ),
        }}
      />
      <Drawer.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          drawerIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>📊</Text>
          ),
        }}
      />
      <Drawer.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
          drawerIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>⚙️</Text>
          ),
        }}
      />
      <Drawer.Screen 
        name="Privacy" 
        component={PrivacyScreen}
        options={{
          title: 'Privacy & Data',
          drawerIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>🔒</Text>
          ),
        }}
      />
      <Drawer.Screen 
        name="About" 
        component={AboutScreen}
        options={{
          title: 'About',
          drawerIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>ℹ️</Text>
          ),
        }}
      />
    </Drawer.Navigator>
  );
}


export default function App() {
  const [appState, setAppState] = useState<AppState>({
    isLoading: true,
    isAuthenticated: false,
    hasConsent: false,
    user: null,
    error: null,
  });

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database (skip if fails)
      try {
        await databaseService.initialize();
      } catch (dbError) {
        console.log('Database initialization failed, continuing without database:', dbError);
      }
      
      // BYPASS AUTHENTICATION FOR TESTING - Go directly to main app
      setAppState({
        isLoading: false,
        isAuthenticated: true,
        hasConsent: true,
        user: {
          user_id: 'test-user-123',
          email: 'test@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });
      
      // Initialize services
      await initializeServices();
      
    } catch (error) {
      console.error('App initialization failed:', error);
      setAppState({
        isLoading: false,
        isAuthenticated: true, // Still bypass auth even on error
        hasConsent: true,
        user: {
          user_id: 'test-user-123',
          email: 'test@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null, // Don't show error for testing
      });
    }
  };

  const initializeServices = async () => {
    try {
      // Initialize trip detection (skip if permission denied)
      try {
        await tripDetectionService.requestLocationPermission();
      } catch (locationError) {
        console.log('Location permission not granted, continuing without location tracking:', locationError);
      }
      
      // Start sync service
      // syncService is already initialized in constructor
      
    } catch (error) {
      console.error('Service initialization failed:', error);
      // Don't throw error, just log it for testing
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

  const handleConsentComplete = async (consent: ConsentRecord) => {
    try {
      // Save consent to database
      await databaseService.saveConsentRecord(consent);
      
      // Update app state
      setAppState(prev => ({
        ...prev,
        hasConsent: true,
      }));
      
      // Initialize services after consent
      await initializeServices();
      
    } catch (error) {
      console.error('Failed to save consent:', error);
      setAppState(prev => ({
        ...prev,
        error: 'Failed to save consent',
      }));
    }
  };

  const handleAuthentication = async (user: User) => {
    setAppState(prev => ({
      ...prev,
      isAuthenticated: true,
      user,
    }));
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      setAppState({
        isLoading: false,
        isAuthenticated: false,
        hasConsent: false,
        user: null,
        error: null,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (appState.isLoading) {
    return <LoadingScreen />;
  }

  if (appState.error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {appState.error}</Text>
        <Text style={styles.errorSubtext}>
          Please restart the app or contact support if the problem persists.
        </Text>
      </View>
    );
  }

  if (!appState.isAuthenticated) {
    return (
      <OnboardingScreen 
        onAuthentication={handleAuthentication}
      />
    );
  }

  if (!appState.hasConsent) {
    return (
      <ConsentScreen 
        onConsentComplete={handleConsentComplete}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          id={undefined}
          screenOptions={{
            headerStyle: {
              backgroundColor: Colors.primary,
            },
            headerTintColor: Colors.textInverse,
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen 
            name="Main" 
            component={MainNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="TripDetail" 
            component={TripDetailScreen}
            options={{
              title: 'Trip Details',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="light" backgroundColor={Colors.primary} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
