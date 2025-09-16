# Smart Travel Diary

A privacy-first mobile application that automatically tracks travel patterns to help researchers and city planners make better transportation decisions. Built with Expo React Native and Node.js backend, featuring end-to-end encryption and comprehensive privacy protections.

## 🚀 Features

### Privacy-First Design
- **End-to-end encryption** for all sensitive data
- **Location anonymization** with configurable grid sizes
- **Time aggregation** to 5-minute intervals
- **Pseudonymous user IDs** that cannot be traced back to individuals
- **Client-side encryption** before data transmission
- **Differential privacy** for research data

### Automatic Trip Detection
- **GPS-based trip detection** with motion sensors
- **Background location tracking** with battery optimization
- **Travel mode detection** (walking, cycling, public transport, private vehicle)
- **Trip chain analysis** for complex journeys
- **Plausibility scoring** for fraud detection

### Offline-First Architecture
- **Local SQLite database** for offline storage
- **Automatic sync** when network is available
- **Conflict resolution** for data consistency
- **Battery-aware sampling** to preserve device battery

### Research & Analytics
- **OD Matrix generation** for origin-destination analysis
- **Heatmap visualization** of travel patterns
- **Mode share statistics** for transportation planning
- **Trip chain analysis** for understanding complex journeys
- **Anonymized data export** for researchers

### User Experience
- **Intuitive mobile interface** with React Native
- **Personal dashboard** with travel insights
- **Reward system** for participation
- **Data export/delete** for user control
- **Privacy controls** and consent management

## 📱 Mobile App (Expo React Native)

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Expo Go app on your mobile device

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smart-travel-diary
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on device**
   - Install Expo Go on your mobile device
   - Scan the QR code from the terminal
   - The app will load on your device

### Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # App screens (Home, Map, Dashboard, etc.)
├── services/           # Business logic (Database, API, Trip Detection)
├── types/              # TypeScript type definitions
├── utils/              # Utility functions (encryption, formatters)
├── constants/          # App configuration and constants
└── hooks/              # Custom React hooks
```

### Key Components

- **TripDetectionService**: Handles GPS tracking and trip detection
- **DatabaseService**: Manages local SQLite storage
- **SyncService**: Handles offline-first synchronization
- **ApiService**: Manages backend communication
- **EncryptionService**: Handles client-side encryption

## 🖥️ Backend API (Node.js + Express)

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Run database migrations**
   ```bash
   npm run migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

### API Endpoints

#### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

#### Trip Management
- `POST /api/trips/bulk` - Sync multiple trips
- `GET /api/trips` - Get user trips
- `POST /api/trips/confirm` - Confirm/correct trip data
- `GET /api/trips/stats` - Get trip statistics

#### Analytics (Public)
- `GET /api/analytics/od-matrix` - Origin-destination matrix
- `GET /api/analytics/heatmap` - Travel pattern heatmap
- `GET /api/analytics/trip-chains` - Trip chain analysis
- `GET /api/analytics/mode-share` - Travel mode statistics

#### Data Management
- `POST /api/data/export` - Export user data
- `POST /api/data/delete` - Delete user data
- `GET /api/data/summary` - Get data summary

#### Admin (Protected)
- `POST /api/admin/anonymize` - Trigger anonymization pipeline
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/data-quality` - Data quality metrics

### Database Schema

The backend uses SQLite with the following main tables:

- **users**: User accounts with encrypted credentials
- **trips**: Encrypted trip data
- **consent_records**: User consent tracking
- **reward_points**: User reward system
- **anonymized_trips**: Research-ready anonymized data
- **anonymization_jobs**: Background processing jobs

## 🔒 Privacy & Security

### Data Protection
- **Client-side encryption** using AES-256-GCM
- **End-to-end encryption** for all sensitive data
- **HMAC signatures** for data integrity
- **Pseudonymous user IDs** generated from email + salt
- **No plaintext storage** of personal information

### Privacy Controls
- **Granular consent** for different data uses
- **Data export** in multiple formats (JSON, CSV, encrypted)
- **Data deletion** with audit trails
- **Privacy mode** with enhanced protections
- **Configurable retention** periods

### Anonymization Pipeline
- **Location aggregation** to configurable grid sizes
- **Time binning** to 5-minute intervals
- **Differential privacy** for statistical queries
- **K-anonymity** enforcement
- **Automatic data purging** after retention periods

## 🧪 Testing & Development

### Running Tests
```bash
# Frontend tests
npm test

# Backend tests
cd backend
npm test
```

### Demo Data
The backend includes seed data for development:
- Test user: `test@example.com` / `testpassword123`
- Sample trips with various travel modes
- Reward points and transactions

### Development Setup
1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `npm start`
3. Use Expo Go to test on device
4. Backend API available at `http://localhost:3000`

## 📊 Analytics & Research

### For Researchers
The system provides anonymized data exports including:

- **OD Matrices**: Origin-destination trip counts by time and mode
- **Heatmaps**: Spatial distribution of travel activity
- **Trip Chains**: Sequential trip patterns
- **Mode Share**: Transportation mode usage statistics

### Data Format
All research data is:
- **Anonymized** with no personal identifiers
- **Aggregated** to protect individual privacy
- **Time-binned** to 5-minute intervals
- **Spatially aggregated** to configurable zones
- **Differentially private** for statistical queries

## 🚀 Deployment

### Mobile App
1. **Build for production**
   ```bash
   expo build:android
   expo build:ios
   ```

2. **Deploy to app stores**
   - Follow Expo's deployment guide
   - Configure app store metadata
   - Set up app store accounts

### Backend
1. **Build the application**
   ```bash
   cd backend
   npm run build
   ```

2. **Deploy to cloud provider**
   - **Heroku**: `git push heroku main`
   - **Railway**: Connect GitHub repository
   - **DigitalOcean**: Use App Platform
   - **AWS**: Use Elastic Beanstalk

3. **Set up database**
   - Use managed PostgreSQL for production
   - Run migrations: `npm run migrate`
   - Configure environment variables

### Environment Variables

#### Mobile App
```bash
API_BASE_URL=https://your-backend-url.com/api
```

#### Backend
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
ENCRYPTION_KEY=your-32-character-encryption-key
CORS_ORIGIN=https://your-frontend-url.com
```

## 📈 Monitoring & Analytics

### Health Checks
- `GET /health` - API health status
- Database connection monitoring
- Error tracking with structured logging

### Metrics
- User registration and activity
- Trip detection accuracy
- Data quality metrics
- API performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Conventional commits for changelog

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **NATPAC** for research requirements and validation
- **Expo** for the excellent React Native development platform
- **Privacy researchers** for differential privacy techniques
- **Open source community** for the foundational libraries

## 📞 Support

For support and questions:
- **Email**: support@smarttraveldiary.com
- **Issues**: GitHub Issues
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Core trip detection and tracking
- ✅ Privacy-first data handling
- ✅ Basic analytics and reporting
- ✅ Mobile app with offline support

### Phase 2 (Next)
- 🔄 Advanced trip detection with ML
- 🔄 Real-time traffic integration
- 🔄 Enhanced privacy controls
- 🔄 Researcher dashboard

### Phase 3 (Future)
- 📋 Multi-city deployment
- 📋 Advanced analytics with AI
- 📋 Integration with smart city systems
- 📋 Carbon footprint tracking

---

**Built with ❤️ for better transportation planning and privacy protection.**
#   S I H - H P  
 #   S I H - H P  
 