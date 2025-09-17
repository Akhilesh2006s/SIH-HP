const mongoose = require('mongoose');

class DatabaseService {
  constructor() {
    this.isConnected = false;
  }

  static getInstance() {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect() {
    if (this.isConnected) {
      console.log('MongoDB already connected');
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-travel-diary';
      
      // Check if it's a MongoDB Atlas URI
      const isAtlas = mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb.net');
      
      console.log(`🔗 Connecting to ${isAtlas ? 'MongoDB Atlas' : 'local MongoDB'}...`);
      
      const connectionOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 30000, // Increased for Atlas
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000, // Added for Atlas
        retryWrites: true,
        w: 'majority'
      };

      // Add additional options for Atlas
      if (isAtlas) {
        connectionOptions.retryReads = true;
        connectionOptions.heartbeatFrequencyMS = 10000;
      }

      await mongoose.connect(mongoUri, connectionOptions);

      this.isConnected = true;
      console.log('✅ Connected to MongoDB successfully');
      console.log(`📍 Database: ${mongoose.connection.name}`);
      console.log(`🌐 Host: ${mongoose.connection.host}`);

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
      
      // Provide helpful error messages
      if (error.name === 'MongooseServerSelectionError') {
        console.error('❌ Could not connect to MongoDB server. Please check:');
        console.error('   1. MongoDB server is running (if using local)');
        console.error('   2. MongoDB Atlas cluster is accessible (if using Atlas)');
        console.error('   3. Network connection is stable');
        console.error('   4. MONGODB_URI environment variable is set correctly');
      }
      
      throw error;
    }
  }

  async disconnect() {
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

  isConnectionActive() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  getConnection() {
    return mongoose.connection;
  }
}

// Export singleton instance
const databaseService = DatabaseService.getInstance();

// Create database indexes function
async function createIndexes() {
  try {
    // Import models to ensure they're registered
    require('../models/User');
    require('../models/Trip');
    require('../models/ConsentRecord');
    require('../models/RewardPoints');
    require('../models/RewardTransaction');
    require('../models/AnonymizedData');
    require('../models/AdminUser');
    require('../models/AuditLog');

    // Indexes are already defined in the models, but we can create additional ones here if needed
    console.log('Database indexes are ready');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
}

// Export mongoose for direct use if needed
module.exports = {
  databaseService,
  mongoose,
  // Legacy export for compatibility
  db: mongoose,
  // Initialize database (replaces migrations)
  async initializeDatabase() {
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
  },
  // Create database indexes
  createIndexes,
  // Database health check
  async checkDatabaseHealth() {
    try {
      return databaseService.isConnectionActive();
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  },
  // Close database connection
  async closeDatabase() {
    try {
      await databaseService.disconnect();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
    }
  }
};
