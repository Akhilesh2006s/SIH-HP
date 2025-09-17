// Utility functions for formatting data

export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(1)}km`;
  }
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

export const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString();
};

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString();
};

export const formatSpeed = (metersPerSecond: number): string => {
  const kmh = metersPerSecond * 3.6;
  return `${kmh.toFixed(1)} km/h`;
};

export const formatCO2Savings = (distanceKm: number, mode: string): string => {
  // CO2 emissions per km by mode (kg CO2/km)
  const emissions = {
    walking: 0,
    cycling: 0,
    public_transport: 0.1,
    private_vehicle: 0.2,
    taxi_rideshare: 0.15,
    other: 0.1,
  };
  
  const baseline = emissions.private_vehicle;
  const actual = emissions[mode] || emissions.other;
  const savings = (baseline - actual) * distanceKm;
  
  if (savings > 0) {
    return `${savings.toFixed(2)} kg CO2 saved`;
  } else {
    return 'No CO2 savings';
  }
};

export const formatCostSavings = (distanceKm: number, mode: string): string => {
  // Cost per km by mode (USD/km)
  const costs = {
    walking: 0,
    cycling: 0,
    public_transport: 0.1,
    private_vehicle: 0.5,
    taxi_rideshare: 1.0,
    other: 0.3,
  };
  
  const baseline = costs.private_vehicle;
  const actual = costs[mode] || costs.other;
  const savings = (baseline - actual) * distanceKm;
  
  if (savings > 0) {
    return `$${savings.toFixed(2)} saved`;
  } else {
    return 'No cost savings';
  }
};

export const formatPoints = (points: number): string => {
  if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}k points`;
  } else {
    return `${points} points`;
  }
};

export const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(1)}%`;
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatRelativeTime = (isoString: string): string => {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return formatDate(isoString);
  }
};

export const formatTravelMode = (mode: string): string => {
  const modeMap: Record<string, string> = {
    walking: 'Walking',
    cycling: 'Cycling',
    public_transport: 'Public Transport',
    private_vehicle: 'Private Vehicle',
    taxi_rideshare: 'Taxi/Rideshare',
    other: 'Other',
  };
  
  return modeMap[mode] || mode;
};

export const formatTripPurpose = (purpose: string): string => {
  const purposeMap: Record<string, string> = {
    work: 'Work',
    education: 'Education',
    shopping: 'Shopping',
    healthcare: 'Healthcare',
    recreation: 'Recreation',
    social: 'Social',
    personal_business: 'Personal Business',
    home: 'Home',
    other: 'Other',
  };
  
  return purposeMap[purpose] || purpose;
};

export const formatConfidence = (confidence: number): string => {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  if (confidence >= 0.4) return 'Low';
  return 'Very Low';
};

export const formatBatteryLevel = (level: number): string => {
  const percentage = Math.round(level * 100);
  if (percentage >= 50) return `${percentage}%`;
  if (percentage >= 20) return `${percentage}% (Low)`;
  return `${percentage}% (Critical)`;
};

export const formatSyncStatus = (isOnline: boolean, isSyncing: boolean, pendingCount: number): string => {
  if (isSyncing) return 'Syncing...';
  if (!isOnline) return 'Offline';
  if (pendingCount > 0) return `${pendingCount} pending`;
  return 'Up to date';
};


