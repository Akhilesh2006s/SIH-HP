import { databaseService } from './DatabaseService';
import { apiService } from './ApiService';
import { tripDetectionService } from './TripDetectionService';
import { Trip, UserPreferences, ConsentRecord } from '../types';
import { APP_CONFIG } from '../constants/Config';
import { EncryptionService } from '../utils/encryption';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingTrips: number;
  failedSyncs: number;
}

interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  current: string;
}

export class SyncService {
  private syncStatus: SyncStatus = {
    isOnline: false,
    isSyncing: false,
    lastSyncTime: null,
    pendingTrips: 0,
    failedSyncs: 0
  };
  
  private syncListeners: Array<(status: SyncStatus) => void> = [];
  private progressListeners: Array<(progress: SyncProgress) => void> = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private retryTimeout: NodeJS.Timeout | null = null;
  
  constructor() {
    this.initializeSync();
  }
  
  private async initializeSync(): Promise<void> {
    // Check if user is authenticated
    const hasValidToken = await apiService.loadStoredTokens();
    if (!hasValidToken) {
      console.log('No valid authentication token, skipping sync initialization');
      return;
    }
    
    // Set up network monitoring
    this.setupNetworkMonitoring();
    
    // Set up periodic sync
    this.setupPeriodicSync();
    
    // Initial sync attempt
    this.attemptSync();
  }
  
  private setupNetworkMonitoring(): void {
    // Monitor network connectivity
    // In a real app, you'd use @react-native-community/netinfo
    // For now, we'll use a simple approach
    this.checkConnectivity();
    
    // Check connectivity every 30 seconds
    setInterval(() => {
      this.checkConnectivity();
    }, 30000);
  }
  
  private async checkConnectivity(): Promise<void> {
    try {
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      const wasOnline = this.syncStatus.isOnline;
      this.syncStatus.isOnline = response.ok;
      
      // If we just came online, attempt sync
      if (!wasOnline && this.syncStatus.isOnline) {
        this.attemptSync();
      }
      
      this.notifyStatusListeners();
    } catch (error) {
      this.syncStatus.isOnline = false;
      this.notifyStatusListeners();
    }
  }
  
  private setupPeriodicSync(): void {
    // Sync every 5 minutes when online
    this.syncInterval = setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        this.attemptSync();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
  
  async attemptSync(): Promise<void> {
    if (this.syncStatus.isSyncing || !this.syncStatus.isOnline) {
      return;
    }
    
    this.syncStatus.isSyncing = true;
    this.notifyStatusListeners();
    
    try {
      // Get user preferences to check sync frequency
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const preferences = await databaseService.getUserPreferences(userId);
      const syncFrequency = preferences?.sync_frequency_minutes || 30;
      
      // Check if enough time has passed since last sync
      if (this.syncStatus.lastSyncTime) {
        const lastSync = new Date(this.syncStatus.lastSyncTime);
        const now = new Date();
        const timeSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60); // minutes
        
        if (timeSinceLastSync < syncFrequency) {
          this.syncStatus.isSyncing = false;
          this.notifyStatusListeners();
          return;
        }
      }
      
      // Sync trips
      await this.syncTrips();
      
      // Sync user preferences
      await this.syncUserPreferences();
      
      // Sync consent records
      await this.syncConsentRecords();
      
      this.syncStatus.lastSyncTime = new Date().toISOString();
      this.syncStatus.failedSyncs = 0;
      
    } catch (error) {
      console.error('Sync failed:', error);
      this.syncStatus.failedSyncs++;
      
      // Schedule retry with exponential backoff
      this.scheduleRetry();
    } finally {
      this.syncStatus.isSyncing = false;
      this.notifyStatusListeners();
    }
  }
  
  private async syncTrips(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    
    // Get unsynced trips
    const unsyncedTrips = await databaseService.getUnsyncedTrips(userId);
    this.syncStatus.pendingTrips = unsyncedTrips.length;
    
    if (unsyncedTrips.length === 0) {
      return;
    }
    
    // Sync in batches
    const batchSize = APP_CONFIG.SYNC_BATCH_SIZE;
    const batches = [];
    
    for (let i = 0; i < unsyncedTrips.length; i += batchSize) {
      batches.push(unsyncedTrips.slice(i, i + batchSize));
    }
    
    let completed = 0;
    let failed = 0;
    
    for (const batch of batches) {
      try {
        this.notifyProgressListeners({
          total: unsyncedTrips.length,
          completed,
          failed,
          current: `Syncing batch of ${batch.length} trips...`
        });
        
        const response = await apiService.syncTrips(batch);
        
        // Mark successfully synced trips
        for (const tripId of response.synced_trips) {
          await databaseService.markTripAsSynced(tripId);
          completed++;
        }
        
        // Handle failed trips
        for (const failedTrip of response.failed_trips) {
          console.error(`Failed to sync trip ${failedTrip.trip_id}:`, failedTrip.error);
          failed++;
        }
        
        this.notifyProgressListeners({
          total: unsyncedTrips.length,
          completed,
          failed,
          current: `Synced ${completed} of ${unsyncedTrips.length} trips`
        });
        
      } catch (error) {
        console.error('Batch sync failed:', error);
        failed += batch.length;
      }
    }
    
    this.syncStatus.pendingTrips = failed;
  }
  
  private async syncUserPreferences(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    
    const preferences = await databaseService.getUserPreferences(userId);
    if (preferences) {
      await apiService.updateUserPreferences(preferences);
    }
  }
  
  private async syncConsentRecords(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    
    // Get latest consent record
    const consent = await databaseService.getConsentRecord(userId, APP_CONFIG.CONSENT_VERSION);
    if (consent) {
      await apiService.updateConsent(consent);
    }
  }
  
  private scheduleRetry(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    
    // Exponential backoff: 1min, 2min, 4min, 8min, max 30min
    const retryDelay = Math.min(
      30 * 60 * 1000, // 30 minutes max
      Math.pow(2, this.syncStatus.failedSyncs) * 60 * 1000 // exponential backoff
    );
    
    this.retryTimeout = setTimeout(() => {
      this.attemptSync();
    }, retryDelay);
  }
  
  private async getCurrentUserId(): Promise<string | null> {
    // In a real app, you'd get this from your auth service
    // For now, we'll use a simple approach
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
  }
  
  // Public methods
  async forceSync(): Promise<void> {
    this.syncStatus.lastSyncTime = null; // Reset last sync time
    await this.attemptSync();
  }
  
  async syncTrip(trip: Trip): Promise<boolean> {
    try {
      const response = await apiService.syncTrips([trip]);
      if (response.synced_trips.includes(trip.trip_id)) {
        await databaseService.markTripAsSynced(trip.trip_id);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to sync single trip:', error);
      return false;
    }
  }
  
  async downloadUserData(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    
    try {
      // Get trips from server
      const serverTrips = await apiService.getUserTrips(1000, 0);
      
      // Save to local database
      for (const trip of serverTrips) {
        await databaseService.saveTrip(trip);
      }
      
    } catch (error) {
      console.error('Failed to download user data:', error);
    }
  }
  
  async exportUserData(format: 'json' | 'csv' | 'encrypted' = 'json'): Promise<string> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');
    
    const exportRequest: any = {
      format,
      include_sensitive: false,
      date_range: {
        start_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        end_date: new Date().toISOString()
      }
    };
    
    const response = await apiService.requestDataExport(exportRequest);
    
    // In a real app, you'd download the file from the URL
    // For now, we'll return the URL
    return response.download_url;
  }
  
  async deleteUserData(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');
    
    // Delete from server
    await apiService.deleteUserData({
      confirmation_token: 'user_confirmed', // In real app, this would be a proper confirmation token
      delete_all: true
    });
    
    // Delete from local database
    await databaseService.deleteUserData(userId);
    
    // Clear encryption data
    await EncryptionService.clearEncryptionData();
  }
  
  // Event listeners
  addSyncStatusListener(listener: (status: SyncStatus) => void): void {
    this.syncListeners.push(listener);
  }
  
  removeSyncStatusListener(listener: (status: SyncStatus) => void): void {
    const index = this.syncListeners.indexOf(listener);
    if (index > -1) {
      this.syncListeners.splice(index, 1);
    }
  }
  
  addProgressListener(listener: (progress: SyncProgress) => void): void {
    this.progressListeners.push(listener);
  }
  
  removeProgressListener(listener: (progress: SyncProgress) => void): void {
    const index = this.progressListeners.indexOf(listener);
    if (index > -1) {
      this.progressListeners.splice(index, 1);
    }
  }
  
  private notifyStatusListeners(): void {
    this.syncListeners.forEach(listener => listener({ ...this.syncStatus }));
  }
  
  private notifyProgressListeners(progress: SyncProgress): void {
    this.progressListeners.forEach(listener => listener(progress));
  }
  
  // Getters
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }
  
  isOnline(): boolean {
    return this.syncStatus.isOnline;
  }
  
  isSyncing(): boolean {
    return this.syncStatus.isSyncing;
  }
  
  getPendingTripsCount(): number {
    return this.syncStatus.pendingTrips;
  }
  
  // Cleanup
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    
    this.syncListeners = [];
    this.progressListeners = [];
  }
}

// Singleton instance
export const syncService = new SyncService();
