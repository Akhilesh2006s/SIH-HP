import mongoose from 'mongoose';

class DatabaseService {
  private static instance: DatabaseService;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('MongoDB already connected');
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-travel-diary';
      
      await mongoose.connect(mongoUri, {
        // Remove deprecated options and use modern ones
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      console.log('✅ Connected to MongoDB successfully');

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('MongoDB disconnected');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  public isConnectionActive(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  public getConnection() {
    return mongoose.connection;
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();

// Export mongoose for direct use if needed
export { mongoose };

// Legacy export for compatibility
export const db = mongoose;

// Initialize database (replaces migrations)
export async function initializeDatabase(): Promise<void> {
  try {
    await databaseService.connect();
    console.log('✅ MongoDB connection established');
    
    // Create indexes for better performance
    await createIndexes();
    console.log('✅ Database indexes created');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Create database indexes
async function createIndexes(): Promise<void> {
  try {
    // Import models to ensure they're registered
    await import('../models/User');
    await import('../models/Trip');
    await import('../models/ConsentRecord');
    await import('../models/RewardPoints');
    await import('../models/RewardTransaction');
    await import('../models/AnonymizedData');
    await import('../models/AdminUser');
    await import('../models/AuditLog');

    // Indexes are already defined in the models, but we can create additional ones here if needed
    console.log('Database indexes are ready');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    return databaseService.isConnectionActive();
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  try {
    await databaseService.disconnect();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
}