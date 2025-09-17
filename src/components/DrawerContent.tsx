import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Colors } from '../constants/Colors';
import { formatPoints } from '../utils/formatters';

export default function DrawerContent(props: DrawerContentComponentProps) {
  const { navigation, state } = props;
  
  const menuItems = [
    { name: 'Home', icon: '🏠', route: 'Home' },
    { name: 'Map View', icon: '🗺️', route: 'Map' },
    { name: 'Dashboard', icon: '📊', route: 'Dashboard' },
    { name: 'Settings', icon: '⚙️', route: 'Settings' },
    { name: 'Privacy & Data', icon: '🔒', route: 'Privacy' },
    { name: 'About', icon: 'ℹ️', route: 'About' },
  ];

  const handleNavigation = (routeName: string) => {
    navigation.navigate(routeName);
    navigation.closeDrawer();
  };

  const getActiveRouteName = (): string => {
    const routeName = state.routeNames[state.index];
    return routeName;
  };

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.appName}>Smart Travel Diary</Text>
          <Text style={styles.appVersion}>v1.0.0</Text>
        </View>

        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>Traveler</Text>
            <Text style={styles.userPoints}>{formatPoints(1250)}</Text>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Navigation</Text>
          {menuItems.map((item) => {
            const isActive = getActiveRouteName() === item.route;
            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.menuItem, isActive && styles.activeMenuItem]}
                onPress={() => handleNavigation(item.route)}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={[styles.menuText, isActive && styles.activeMenuText]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Today's Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>3</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>12.5km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>45m</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>2.1kg</Text>
              <Text style={styles.statLabel}>CO₂ Saved</Text>
            </View>
          </View>
        </View>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            Your data is encrypted and anonymized. We never store your exact location.
          </Text>
        </View>
      </DrawerContentScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => {
            // Handle logout
            navigation.closeDrawer();
          }}
        >
          <Text style={styles.footerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.primary,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textInverse,
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 12,
    color: Colors.textInverse,
    opacity: 0.8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 24,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  userPoints: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  menuSection: {
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  activeMenuItem: {
    backgroundColor: Colors.primaryLight,
    borderRightWidth: 3,
    borderRightColor: Colors.primary,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 15,
    width: 24,
    textAlign: 'center',
  },
  menuText: {
    fontSize: 16,
    color: Colors.text,
  },
  activeMenuText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  statsSection: {
    padding: 20,
    backgroundColor: Colors.backgroundSecondary,
    margin: 20,
    borderRadius: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    margin: 20,
    backgroundColor: Colors.privacyLight,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.privacy,
  },
  privacyIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerButton: {
    padding: 12,
    borderRadius: 6,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
  },
  footerButtonText: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '600',
  },
});


