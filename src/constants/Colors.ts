// App color scheme
export const Colors = {
  // Primary colors
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#3b82f6',
  
  // Secondary colors
  secondary: '#64748b',
  secondaryDark: '#475569',
  secondaryLight: '#94a3b8',
  
  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Background colors
  background: '#ffffff',
  backgroundSecondary: '#f8fafc',
  backgroundTertiary: '#f1f5f9',
  
  // Text colors
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  textInverse: '#ffffff',
  
  // Border colors
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  borderDark: '#cbd5e1',
  
  // Privacy-specific colors
  privacy: '#7c3aed',
  privacyLight: '#a78bfa',
  privacyDark: '#5b21b6',
  
  // Travel mode colors
  walking: '#10b981',
  cycling: '#f59e0b',
  publicTransport: '#3b82f6',
  privateVehicle: '#ef4444',
  taxiRideshare: '#8b5cf6',
  other: '#64748b',
  
  // Chart colors
  chart1: '#3b82f6',
  chart2: '#10b981',
  chart3: '#f59e0b',
  chart4: '#ef4444',
  chart5: '#8b5cf6',
  chart6: '#06b6d4',
  chart7: '#84cc16',
  chart8: '#f97316',
  
  // Dark mode colors
  dark: {
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    backgroundTertiary: '#334155',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textTertiary: '#94a3b8',
    border: '#334155',
    borderLight: '#475569',
    borderDark: '#1e293b',
  },
} as const;

export const getTravelModeColor = (mode: string): string => {
  switch (mode.toLowerCase()) {
    case 'walking':
      return Colors.walking;
    case 'cycling':
      return Colors.cycling;
    case 'public_transport':
      return Colors.publicTransport;
    case 'private_vehicle':
      return Colors.privateVehicle;
    case 'taxi_rideshare':
      return Colors.taxiRideshare;
    default:
      return Colors.other;
  }
};

export const getStatusColor = (status: 'active' | 'inactive' | 'warning' | 'error'): string => {
  switch (status) {
    case 'active':
      return Colors.success;
    case 'inactive':
      return Colors.textSecondary;
    case 'warning':
      return Colors.warning;
    case 'error':
      return Colors.error;
    default:
      return Colors.textSecondary;
  }
};
