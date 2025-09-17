import { 
  ApiResponse, 
  LoginRequest, 
  LoginResponse, 
  SignupRequest, 
  TripSyncRequest, 
  TripSyncResponse,
  TripCorrectionRequest,
  ODMatrixRequest,
  HeatmapRequest,
  TripChainAnalysisRequest,
  DataExportRequest,
  DataExportResponse,
  DataDeleteRequest,
  AnonymizationRequest,
  AnonymizationResponse,
  API_ERROR_CODES
} from '../types/Api';
import { Trip, UserPreferences, ConsentRecord } from '../types';
import { APP_CONFIG } from '../constants/Config';
import { EncryptionService } from '../utils/encryption';

export class ApiService {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  
  constructor() {
    this.baseUrl = APP_CONFIG.API_BASE_URL;
  }
  
  // Authentication methods
  async signup(data: SignupRequest): Promise<LoginResponse> {
    const response = await this.makeRequest<LoginResponse>('POST', '/auth/signup', data);
    this.setTokens(response.tokens);
    return response;
  }
  
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.makeRequest<LoginResponse>('POST', '/auth/login', credentials);
    this.setTokens(response.tokens);
    return response;
  }
  
  async logout(): Promise<void> {
    if (this.refreshToken) {
      try {
        await this.makeRequest('POST', '/auth/logout', { refresh_token: this.refreshToken });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    this.clearTokens();
  }
  
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;
    
    try {
      const response = await this.makeRequest<{ access_token: string; expires_at: string }>(
        'POST', 
        '/auth/refresh', 
        { refresh_token: this.refreshToken }
      );
      
      this.accessToken = response.access_token;
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return false;
    }
  }
  
  // Trip sync methods
  async syncTrips(trips: Trip[]): Promise<TripSyncResponse> {
    const encryptedTrips = [];
    
    for (const trip of trips) {
      const encrypted = await EncryptionService.encryptTripForSync(trip);
      encryptedTrips.push({
        trip_id: trip.trip_id,
        encrypted_data: encrypted.encrypted_data,
        signature: encrypted.signature
      });
    }
    
    const syncRequest: TripSyncRequest = {
      trips: encryptedTrips,
      sync_timestamp: new Date().toISOString()
    };
    
    return await this.makeRequest<TripSyncResponse>('POST', '/trips/bulk', syncRequest);
  }
  
  async getUserTrips(limit: number = 100, offset: number = 0): Promise<Trip[]> {
    const response = await this.makeRequest<{ trips: any[] }>(
      'GET', 
      `/trips?limit=${limit}&offset=${offset}`
    );
    
    // Decrypt trips
    const decryptedTrips = [];
    for (const encryptedTrip of response.trips) {
      try {
        const trip = await EncryptionService.decryptTripFromSync(
          encryptedTrip.encrypted_data,
          encryptedTrip.signature
        );
        decryptedTrips.push(trip);
      } catch (error) {
        console.error('Failed to decrypt trip:', error);
      }
    }
    
    return decryptedTrips;
  }
  
  async correctTrip(correction: TripCorrectionRequest): Promise<void> {
    await this.makeRequest('POST', '/trips/confirm', correction);
  }
  
  // Analytics methods
  async getODMatrix(request: ODMatrixRequest): Promise<any> {
    return await this.makeRequest('GET', '/analytics/od-matrix', request);
  }
  
  async getHeatmap(request: HeatmapRequest): Promise<any> {
    return await this.makeRequest('GET', '/analytics/heatmap', request);
  }
  
  async getTripChainAnalysis(request: TripChainAnalysisRequest): Promise<any> {
    return await this.makeRequest('GET', '/analytics/trip-chains', request);
  }
  
  // Data management methods
  async requestDataExport(request: DataExportRequest): Promise<DataExportResponse> {
    return await this.makeRequest<DataExportResponse>('POST', '/data/export', request);
  }
  
  async deleteUserData(request: DataDeleteRequest): Promise<void> {
    await this.makeRequest('POST', '/data/delete', request);
  }
  
  // Admin methods (for researchers)
  async triggerAnonymization(request: AnonymizationRequest): Promise<AnonymizationResponse> {
    return await this.makeRequest<AnonymizationResponse>('POST', '/admin/anonymize', request);
  }
  
  async getAnonymizationStatus(jobId: string): Promise<AnonymizationResponse> {
    return await this.makeRequest<AnonymizationResponse>('GET', `/admin/anonymize/${jobId}`);
  }
  
  // User preferences and consent
  async updateUserPreferences(preferences: UserPreferences): Promise<void> {
    await this.makeRequest('PUT', '/user/preferences', preferences);
  }
  
  async getConsentStatus(): Promise<ConsentRecord | null> {
    try {
      return await this.makeRequest<ConsentRecord>('GET', '/user/consent');
    } catch (error) {
      return null;
    }
  }
  
  async updateConsent(consent: ConsentRecord): Promise<void> {
    await this.makeRequest('POST', '/user/consent', consent);
  }
  
  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return await this.makeRequest<{ status: string; timestamp: string }>('GET', '/health');
  }
  
  // Core HTTP methods
  private async makeRequest<T = any>(
    method: string, 
    endpoint: string, 
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    const config: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(APP_CONFIG.API_TIMEOUT),
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.code || API_ERROR_CODES.SERVER_ERROR,
          errorData.message || `HTTP ${response.status}`,
          errorData.details
        );
      }
      
      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new ApiError(
          responseData.error?.code || API_ERROR_CODES.SERVER_ERROR,
          responseData.error?.message || 'Unknown error',
          responseData.error?.details
        );
      }
      
      return responseData.data || responseData;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error.name === 'AbortError') {
        throw new ApiError(API_ERROR_CODES.NETWORK_ERROR, 'Request timeout');
      }
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new ApiError(API_ERROR_CODES.NETWORK_ERROR, 'Network connection failed');
      }
      
      throw new ApiError(API_ERROR_CODES.SERVER_ERROR, error.message || 'Unknown error');
    }
  }
  
  // Token management
  private setTokens(tokens: { access_token: string; refresh_token: string; expires_at: string }): void {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    
    // Store tokens securely
    this.storeTokens(tokens);
  }
  
  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.clearStoredTokens();
  }
  
  private async storeTokens(tokens: { access_token: string; refresh_token: string; expires_at: string }): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.setItem('auth_tokens', JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to store tokens:', error);
    }
  }
  
  private async clearStoredTokens(): Promise<void> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.removeItem('auth_tokens');
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }
  
  async loadStoredTokens(): Promise<boolean> {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const storedTokens = await AsyncStorage.getItem('auth_tokens');
      
      if (storedTokens) {
        const tokens = JSON.parse(storedTokens);
        
        // Check if token is expired
        if (new Date(tokens.expires_at) > new Date()) {
          this.accessToken = tokens.access_token;
          this.refreshToken = tokens.refresh_token;
          return true;
        } else {
          // Try to refresh
          this.refreshToken = tokens.refresh_token;
          return await this.refreshAccessToken();
        }
      }
    } catch (error) {
      console.error('Failed to load stored tokens:', error);
    }
    
    return false;
  }
  
  // Utility methods
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
  
  getAccessToken(): string | null {
    return this.accessToken;
  }
  
  // Offline queue management
  async processOfflineQueue(): Promise<void> {
    // This would be called when coming back online
    // Implementation depends on your offline queue structure
  }
}

// Custom error class
export class ApiError extends Error {
  public code: string;
  public details?: any;
  
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

// Singleton instance
export const apiService = new ApiService();


