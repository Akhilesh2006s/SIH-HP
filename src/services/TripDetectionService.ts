import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Sensors from 'expo-sensors';
import { v4 as uuidv4 } from 'uuid';
import { Trip, Location as TripLocation, TravelMode, SensorSummary, TRIP_PURPOSES, TRAVEL_MODES } from '../types';
import { APP_CONFIG } from '../constants/Config';

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const BACKGROUND_SENSOR_TASK = 'background-sensor-task';

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

interface SensorData {
  acceleration: { x: number; y: number; z: number };
  gyroscope: { x: number; y: number; z: number };
  magnetometer: { x: number; y: number; z: number };
  timestamp: number;
}

interface TripDetectionState {
  isTracking: boolean;
  currentTrip: Partial<Trip> | null;
  locationPoints: LocationPoint[];
  sensorData: SensorData[];
  lastLocation: LocationPoint | null;
  tripStartTime: number | null;
  isMoving: boolean;
  dwellStartTime: number | null;
  currentChainId: string | null;
  dailyTripNumber: number;
}

export class TripDetectionService {
  private state: TripDetectionState = {
    isTracking: false,
    currentTrip: null,
    locationPoints: [],
    sensorData: [],
    lastLocation: null,
    tripStartTime: null,
    isMoving: false,
    dwellStartTime: null,
    currentChainId: null,
    dailyTripNumber: 0
  };
  
  private listeners: Array<(trip: Trip) => void> = [];
  private locationSubscription: Location.LocationSubscription | null = null;
  private sensorSubscription: any = null;
  
  constructor() {
    this.initializeTasks();
  }
  
  private initializeTasks(): void {
    // Background location task
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
      if (error) {
        console.error('Background location error:', error);
        return;
      }
      
      if (data) {
        const { locations } = data as any;
        locations.forEach((location: any) => {
          this.processLocationUpdate(location);
        });
      }
    });
    
    // Background sensor task
    TaskManager.defineTask(BACKGROUND_SENSOR_TASK, ({ data, error }) => {
      if (error) {
        console.error('Background sensor error:', error);
        return;
      }
      
      if (data) {
        this.processSensorUpdate(data as any);
      }
    });
  }
  
  async startTracking(): Promise<void> {
    if (this.state.isTracking) return;
    
    // Request permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }
    
    const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus.status !== 'granted') {
      console.warn('Background location permission not granted');
    }
    
    // Start location tracking
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: APP_CONFIG.BACKGROUND_LOCATION_INTERVAL,
        distanceInterval: 10, // meters
      },
      (location) => {
        this.processLocationUpdate(location);
      }
    );
    
    // Start sensor monitoring
    await this.startSensorMonitoring();
    
    this.state.isTracking = true;
    this.resetDailyTripNumber();
  }
  
  async stopTracking(): Promise<void> {
    if (!this.state.isTracking) return;
    
    // Stop location tracking
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    
    // Stop sensor monitoring
    await this.stopSensorMonitoring();
    
    // End current trip if active
    if (this.state.currentTrip) {
      await this.endCurrentTrip();
    }
    
    this.state.isTracking = false;
  }
  
  private async startSensorMonitoring(): Promise<void> {
    try {
      // Start accelerometer
      await Sensors.Accelerometer.setUpdateInterval(1000); // 1 second
      this.sensorSubscription = Sensors.Accelerometer.addListener((data) => {
        this.processSensorUpdate({
          acceleration: data,
          timestamp: Date.now()
        });
      });
    } catch (error) {
      console.error('Failed to start sensor monitoring:', error);
    }
  }
  
  private async stopSensorMonitoring(): Promise<void> {
    if (this.sensorSubscription) {
      this.sensorSubscription.remove();
      this.sensorSubscription = null;
    }
  }
  
  private processLocationUpdate(location: any): void {
    const locationPoint: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading
    };
    
    this.state.locationPoints.push(locationPoint);
    
    // Keep only recent location points (last 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.state.locationPoints = this.state.locationPoints.filter(
      point => point.timestamp > oneHourAgo
    );
    
    // Analyze movement
    this.analyzeMovement(locationPoint);
    
    this.state.lastLocation = locationPoint;
  }
  
  private processSensorUpdate(data: any): void {
    const sensorData: SensorData = {
      acceleration: data.acceleration || { x: 0, y: 0, z: 0 },
      gyroscope: data.gyroscope || { x: 0, y: 0, z: 0 },
      magnetometer: data.magnetometer || { x: 0, y: 0, z: 0 },
      timestamp: data.timestamp || Date.now()
    };
    
    this.state.sensorData.push(sensorData);
    
    // Keep only recent sensor data (last 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.state.sensorData = this.state.sensorData.filter(
      data => data.timestamp > oneHourAgo
    );
  }
  
  private analyzeMovement(currentLocation: LocationPoint): void {
    if (!this.state.lastLocation) {
      this.state.lastLocation = currentLocation;
      return;
    }
    
    const distance = this.calculateDistance(
      this.state.lastLocation.latitude,
      this.state.lastLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );
    
    const timeDiff = (currentLocation.timestamp - this.state.lastLocation.timestamp) / 1000; // seconds
    const speed = distance / timeDiff; // m/s
    
    // Determine if moving based on speed and distance
    const isMoving = speed > 0.5 || distance > 10; // 0.5 m/s or 10m threshold
    
    if (isMoving && !this.state.isMoving) {
      // Started moving - potential trip start
      this.handleTripStart(currentLocation);
    } else if (!isMoving && this.state.isMoving) {
      // Stopped moving - potential trip end
      this.handleTripEnd(currentLocation);
    } else if (isMoving && this.state.isMoving) {
      // Continue moving - update current trip
      this.updateCurrentTrip(currentLocation);
    } else if (!isMoving && !this.state.isMoving) {
      // Still stationary - update dwell time
      this.updateDwellTime();
    }
    
    this.state.isMoving = isMoving;
  }
  
  private handleTripStart(location: LocationPoint): void {
    if (this.state.currentTrip) {
      // Already have a trip in progress, don't start a new one
      return;
    }
    
    this.state.tripStartTime = location.timestamp;
    this.state.dwellStartTime = null;
    
    // Get place name for origin
    this.getPlaceName(location.latitude, location.longitude).then(placeName => {
      this.state.currentTrip = {
        trip_id: uuidv4(),
        user_id: '', // Will be set when saving
        trip_number: this.getNextTripNumber(),
        chain_id: this.state.currentChainId || uuidv4(),
        origin: {
          lat: location.latitude,
          lon: location.longitude,
          place_name: placeName
        },
        start_time: new Date(location.timestamp).toISOString(),
        travel_mode: {
          detected: this.detectTravelMode(),
          user_confirmed: null,
          confidence: 0.5
        },
        trip_purpose: 'other', // Default, user can correct
        num_accompanying: 0,
        accompanying_basic: [],
        sensor_summary: this.calculateSensorSummary(),
        recorded_offline: true,
        synced: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (!this.state.currentChainId) {
        this.state.currentChainId = this.state.currentTrip.chain_id!;
      }
    });
  }
  
  private handleTripEnd(location: LocationPoint): void {
    if (!this.state.currentTrip || !this.state.tripStartTime) {
      return;
    }
    
    this.state.dwellStartTime = location.timestamp;
    
    // Get place name for destination
    this.getPlaceName(location.latitude, location.longitude).then(placeName => {
      this.state.currentTrip!.destination = {
        lat: location.latitude,
        lon: location.longitude,
        place_name: placeName
      };
      
      this.state.currentTrip!.end_time = new Date(location.timestamp).toISOString();
      this.state.currentTrip!.duration_seconds = Math.floor(
        (location.timestamp - this.state.tripStartTime!) / 1000
      );
      
      // Calculate distance
      this.state.currentTrip!.distance_meters = this.calculateTripDistance();
      
      // Update sensor summary
      this.state.currentTrip!.sensor_summary = this.calculateSensorSummary();
      
      // Detect travel mode with higher confidence
      this.state.currentTrip!.travel_mode = {
        detected: this.detectTravelMode(),
        user_confirmed: null,
        confidence: this.calculateModeConfidence()
      };
      
      // End the trip
      this.endCurrentTrip();
    });
  }
  
  private updateCurrentTrip(location: LocationPoint): void {
    // Update sensor data and potentially refine travel mode detection
    if (this.state.currentTrip) {
      this.state.currentTrip.sensor_summary = this.calculateSensorSummary();
    }
  }
  
  private updateDwellTime(): void {
    if (!this.state.dwellStartTime) {
      this.state.dwellStartTime = Date.now();
    }
    
    const dwellTime = (Date.now() - this.state.dwellStartTime) / 1000; // seconds
    
    // If dwelling for too long, end the current chain
    if (dwellTime > APP_CONFIG.DWELL_TIME_THRESHOLD) {
      this.state.currentChainId = null;
    }
  }
  
  private async endCurrentTrip(): Promise<void> {
    if (!this.state.currentTrip) return;
    
    const trip = this.state.currentTrip as Trip;
    
    // Validate trip
    if (this.isValidTrip(trip)) {
      // Notify listeners
      this.listeners.forEach(listener => listener(trip));
    }
    
    // Reset state
    this.state.currentTrip = null;
    this.state.tripStartTime = null;
    this.state.dwellStartTime = null;
  }
  
  private isValidTrip(trip: Trip): boolean {
    return (
      trip.duration_seconds >= APP_CONFIG.MIN_TRIP_DURATION &&
      trip.distance_meters >= APP_CONFIG.MIN_TRIP_DISTANCE
    );
  }
  
  private detectTravelMode(): string {
    if (this.state.locationPoints.length < 2) {
      return 'other';
    }
    
    const recentPoints = this.state.locationPoints.slice(-10); // Last 10 points
    const speeds = [];
    
    for (let i = 1; i < recentPoints.length; i++) {
      const distance = this.calculateDistance(
        recentPoints[i-1].latitude,
        recentPoints[i-1].longitude,
        recentPoints[i].latitude,
        recentPoints[i].longitude
      );
      const timeDiff = (recentPoints[i].timestamp - recentPoints[i-1].timestamp) / 1000;
      const speed = distance / timeDiff;
      speeds.push(speed);
    }
    
    const avgSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    
    // Use sensor data to help with detection
    const hasVehicleAcceleration = this.hasVehicleAccelerationPattern();
    
    if (avgSpeed < APP_CONFIG.SPEED_THRESHOLDS.WALKING) {
      return 'walking';
    } else if (avgSpeed < APP_CONFIG.SPEED_THRESHOLDS.CYCLING) {
      return 'cycling';
    } else if (avgSpeed < APP_CONFIG.SPEED_THRESHOLDS.VEHICLE && !hasVehicleAcceleration) {
      return 'public_transport';
    } else {
      return 'private_vehicle';
    }
  }
  
  private hasVehicleAccelerationPattern(): boolean {
    if (this.state.sensorData.length < 5) return false;
    
    const recentAccelerations = this.state.sensorData.slice(-5);
    let accelerationVariance = 0;
    
    for (let i = 1; i < recentAccelerations.length; i++) {
      const accel1 = recentAccelerations[i-1].acceleration;
      const accel2 = recentAccelerations[i].acceleration;
      const diff = Math.sqrt(
        Math.pow(accel2.x - accel1.x, 2) +
        Math.pow(accel2.y - accel1.y, 2) +
        Math.pow(accel2.z - accel1.z, 2)
      );
      accelerationVariance += diff;
    }
    
    return accelerationVariance > APP_CONFIG.ACCELERATION_THRESHOLD;
  }
  
  private calculateModeConfidence(): number {
    // Calculate confidence based on sensor data consistency and speed patterns
    const recentPoints = this.state.locationPoints.slice(-10);
    if (recentPoints.length < 3) return 0.3;
    
    const speeds = [];
    for (let i = 1; i < recentPoints.length; i++) {
      const distance = this.calculateDistance(
        recentPoints[i-1].latitude,
        recentPoints[i-1].longitude,
        recentPoints[i].latitude,
        recentPoints[i].longitude
      );
      const timeDiff = (recentPoints[i].timestamp - recentPoints[i-1].timestamp) / 1000;
      const speed = distance / timeDiff;
      speeds.push(speed);
    }
    
    const avgSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const speedVariance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) / speeds.length;
    
    // Higher confidence for consistent speeds
    const speedConsistency = Math.max(0, 1 - (speedVariance / avgSpeed));
    
    // Higher confidence with more sensor data
    const dataConfidence = Math.min(1, this.state.sensorData.length / 20);
    
    return Math.min(0.9, (speedConsistency + dataConfidence) / 2);
  }
  
  private calculateSensorSummary(): SensorSummary {
    if (this.state.locationPoints.length === 0) {
      return {
        average_speed: 0,
        variance_accel: 0,
        gps_points_count: 0,
        max_speed: 0,
        min_speed: 0,
        total_acceleration: 0
      };
    }
    
    const speeds = [];
    let totalAcceleration = 0;
    
    // Calculate speeds from location points
    for (let i = 1; i < this.state.locationPoints.length; i++) {
      const distance = this.calculateDistance(
        this.state.locationPoints[i-1].latitude,
        this.state.locationPoints[i-1].longitude,
        this.state.locationPoints[i].latitude,
        this.state.locationPoints[i].longitude
      );
      const timeDiff = (this.state.locationPoints[i].timestamp - this.state.locationPoints[i-1].timestamp) / 1000;
      const speed = distance / timeDiff;
      speeds.push(speed);
    }
    
    // Calculate acceleration from sensor data
    for (let i = 1; i < this.state.sensorData.length; i++) {
      const accel1 = this.state.sensorData[i-1].acceleration;
      const accel2 = this.state.sensorData[i].acceleration;
      const acceleration = Math.sqrt(
        Math.pow(accel2.x - accel1.x, 2) +
        Math.pow(accel2.y - accel1.y, 2) +
        Math.pow(accel2.z - accel1.z, 2)
      );
      totalAcceleration += acceleration;
    }
    
    const averageSpeed = speeds.length > 0 ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
    const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;
    
    // Calculate acceleration variance
    const accelerationVariance = this.state.sensorData.length > 1 ? 
      totalAcceleration / (this.state.sensorData.length - 1) : 0;
    
    return {
      average_speed: averageSpeed,
      variance_accel: accelerationVariance,
      gps_points_count: this.state.locationPoints.length,
      max_speed: maxSpeed,
      min_speed: minSpeed,
      total_acceleration: totalAcceleration
    };
  }
  
  private calculateTripDistance(): number {
    if (this.state.locationPoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < this.state.locationPoints.length; i++) {
      const distance = this.calculateDistance(
        this.state.locationPoints[i-1].latitude,
        this.state.locationPoints[i-1].longitude,
        this.state.locationPoints[i].latitude,
        this.state.locationPoints[i].longitude
      );
      totalDistance += distance;
    }
    
    return totalDistance;
  }
  
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  private async getPlaceName(latitude: number, longitude: number): Promise<string> {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (result.length > 0) {
        const place = result[0];
        return `${place.name || place.street || 'Unknown'}, ${place.city || place.region || 'Unknown'}`;
      }
    } catch (error) {
      console.error('Error getting place name:', error);
    }
    return 'Unknown Location';
  }
  
  private getNextTripNumber(): number {
    this.state.dailyTripNumber++;
    return this.state.dailyTripNumber;
  }
  
  private resetDailyTripNumber(): void {
    // Reset trip number at midnight
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeUntilMidnight = midnight.getTime() - now.getTime();
    
    setTimeout(() => {
      this.state.dailyTripNumber = 0;
    }, timeUntilMidnight);
  }
  
  // Public methods
  addTripListener(listener: (trip: Trip) => void): void {
    this.listeners.push(listener);
  }
  
  removeTripListener(listener: (trip: Trip) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  getCurrentState(): Partial<TripDetectionState> {
    return {
      isTracking: this.state.isTracking,
      isMoving: this.state.isMoving,
      currentTrip: this.state.currentTrip,
      dailyTripNumber: this.state.dailyTripNumber
    };
  }
  
  async requestLocationPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }
  
  async requestBackgroundLocationPermission(): Promise<boolean> {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  }
}

// Singleton instance
export const tripDetectionService = new TripDetectionService();
