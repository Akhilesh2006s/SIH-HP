# MongoDB Setup Guide

## 🗄️ Database Configuration

The Smart Travel Diary backend now uses **MongoDB** with **Mongoose** as the ODM (Object Document Mapper).

## 📋 Prerequisites

1. **MongoDB Installation**
   - **Local Development**: Install MongoDB Community Server
   - **Cloud**: Use MongoDB Atlas (recommended for production)

2. **Node.js Dependencies**
   ```bash
   npm install mongoose
   ```

## 🚀 Quick Setup

### Option 1: Local MongoDB

1. **Install MongoDB Community Server**
   - Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
   - Follow installation instructions for your OS
   - Start MongoDB service

2. **Configure Environment**
   ```bash
   # In backend/.env
   MONGODB_URI=mongodb://localhost:27017/smart-travel-diary
   ```

3. **Run Setup**
   ```bash
   npm run setup
   ```

### Option 2: MongoDB Atlas (Cloud)

1. **Create Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a free account
   - Create a new cluster

2. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string

3. **Configure Environment**
   ```bash
   # In backend/.env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smart-travel-diary?retryWrites=true&w=majority
   ```

4. **Run Setup**
   ```bash
   npm run setup
   ```

## 📊 Database Collections

### Users Collection
```javascript
{
  _id: ObjectId,
  email: String,
  password_hash: String,
  salt: String,
  pseudonymized_id: String,
  created_at: Date,
  updated_at: Date
}
```

### Trips Collection
```javascript
{
  _id: ObjectId,
  trip_id: String,
  user_id: String,
  trip_number: Number,
  chain_id: String,
  origin: {
    lat: Number,
    lon: Number,
    place_name: String
  },
  destination: {
    lat: Number,
    lon: Number,
    place_name: String
  },
  start_time: Date,
  end_time: Date,
  duration_seconds: Number,
  distance_meters: Number,
  travel_mode: {
    detected: String,
    user_confirmed: String,
    confidence: Number
  },
  trip_purpose: String,
  num_accompanying: Number,
  accompanying_basic: Array,
  notes: String,
  sensor_summary: {
    average_speed: Number,
    variance_accel: Number,
    gps_points_count: Number,
    max_speed: Number,
    min_speed: Number,
    total_acceleration: Number
  },
  recorded_offline: Boolean,
  synced: Boolean,
  is_private: Boolean,
  plausibility_score: Number,
  anonymized_at: Date,
  created_at: Date,
  updated_at: Date
}
```

### Consent Records Collection
```javascript
{
  _id: ObjectId,
  user_id: String,
  consent_version: String,
  background_tracking_consent: Boolean,
  data_sharing_consent: Boolean,
  analytics_consent: Boolean,
  consent_timestamp: Date,
  created_at: Date,
  updated_at: Date
}
```

### Reward Points Collection
```javascript
{
  _id: ObjectId,
  user_id: String,
  points_balance: Number,
  last_updated: Date,
  created_at: Date,
  updated_at: Date
}
```

### Reward Transactions Collection
```javascript
{
  _id: ObjectId,
  user_id: String,
  points_change: Number,
  transaction_type: String,
  description: String,
  trip_id: String,
  timestamp: Date,
  created_at: Date,
  updated_at: Date
}
```

### Anonymized Data Collection
```javascript
{
  _id: ObjectId,
  pseudonymized_user_id: String,
  origin_zone: String,
  destination_zone: String,
  start_time_bucket: String,
  end_time_bucket: String,
  duration_bucket: String,
  distance_bucket: String,
  travel_mode: String,
  trip_purpose: String,
  num_accompanying_bucket: String,
  created_at: Date,
  updated_at: Date
}
```

## 🔧 Development Commands

```bash
# Start MongoDB (local)
mongod

# Connect to MongoDB shell
mongosh

# Seed development data
npm run seed

# Run analytics scripts
npm run analytics:all
```

## 📈 Performance Optimization

### Indexes
The application automatically creates indexes for optimal query performance:

- **Users**: `email`, `pseudonymized_id`
- **Trips**: `user_id + start_time`, `chain_id`, `travel_mode`, `synced + anonymized_at`
- **Consent Records**: `user_id + consent_timestamp`
- **Reward Transactions**: `user_id + timestamp`, `transaction_type`

### Connection Settings
```javascript
{
  maxPoolSize: 10,           // Maximum number of connections
  serverSelectionTimeoutMS: 5000,  // How long to try selecting a server
  socketTimeoutMS: 45000,    // How long to wait for a response
}
```

## 🔒 Security Best Practices

1. **Connection String Security**
   - Use environment variables for connection strings
   - Never commit credentials to version control
   - Use MongoDB Atlas IP whitelist for production

2. **Data Encryption**
   - Enable MongoDB encryption at rest
   - Use TLS/SSL for connections
   - Implement field-level encryption for sensitive data

3. **Access Control**
   - Create dedicated database users with minimal privileges
   - Use MongoDB's built-in authentication
   - Implement proper role-based access control

## 🚀 Production Deployment

### MongoDB Atlas (Recommended)
1. Create production cluster
2. Configure IP whitelist
3. Create database user
4. Set connection string in environment variables
5. Enable monitoring and backups

### Self-Hosted MongoDB
1. Set up MongoDB replica set
2. Configure authentication
3. Enable SSL/TLS
4. Set up monitoring (MongoDB Ops Manager)
5. Configure automated backups

## 🐛 Troubleshooting

### Common Issues

**Connection Refused**
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

**Authentication Failed**
- Verify username/password in connection string
- Check database user permissions
- Ensure IP is whitelisted (Atlas)

**Index Creation Errors**
- Check MongoDB version compatibility
- Verify schema definitions
- Review index specifications

### Useful Commands

```bash
# Check database status
mongosh --eval "db.adminCommand('ismaster')"

# List databases
mongosh --eval "show dbs"

# Check collections
mongosh smart-travel-diary --eval "show collections"

# View indexes
mongosh smart-travel-diary --eval "db.trips.getIndexes()"
```

## 📚 Additional Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [MongoDB University](https://university.mongodb.com/)

---

**Ready to start?** Run `npm run setup` to get started with MongoDB! 🚀
