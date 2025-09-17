# Quick Start Guide

Get the Smart Travel Diary app running in 5 minutes!

## 🚀 Prerequisites

- Node.js 18+ installed
- Expo Go app on your mobile device
- Git (for cloning)

## ⚡ Quick Setup

### Option 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd smart-travel-diary

# Run the automated setup script
npm run setup
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up backend
cd backend
npm install
cp env.example .env
npm run migrate
npm run seed
cd ..

# 3. Start the app
npm start
```

## 📱 Testing the App

1. **Install Expo Go** on your mobile device:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Scan the QR code** with Expo Go to load the app

4. **Login with test credentials**:
   - Email: `test@example.com`
   - Password: `testpassword123`

## 🖥️ Backend API

The backend runs on `http://localhost:3000` with these endpoints:

- **Health Check**: `GET /health`
- **API Documentation**: `GET /api` (coming soon)
- **Test User Data**: Pre-loaded with sample trips

## 🧪 Demo Data

Generate realistic trip data for testing:

```bash
npm run simulate-trips
```

This creates a `demo-data.json` file with 50 realistic trips.

## 🔧 Development Commands

```bash
# Start mobile app
npm start

# Start backend API
cd backend && npm run dev

# Generate demo data
npm run simulate-trips

# Run database migrations
cd backend && npm run migrate

# Reset database
cd backend && npm run migrate:rollback && npm run migrate
```

## 📊 What You'll See

After setup, you'll have:

- ✅ **Mobile app** running in Expo Go
- ✅ **Backend API** with sample data
- ✅ **Test user** with 2 sample trips
- ✅ **Database** with proper schema
- ✅ **Encryption** working end-to-end

## 🐛 Troubleshooting

### Common Issues

**"Expo CLI not found"**
```bash
npm install -g @expo/cli
```

**"Database connection failed"**
```bash
cd backend
npm run migrate
```

**"App won't load in Expo Go"**
- Make sure your phone and computer are on the same WiFi
- Try restarting the development server
- Check that port 19000 is not blocked

**"Backend API not responding"**
```bash
cd backend
npm run dev
# Check http://localhost:3000/health
```

### Getting Help

- Check the [full README](README.md) for detailed documentation
- Look at the [troubleshooting section](README.md#troubleshooting)
- Open an issue on GitHub

## 🎯 Next Steps

1. **Explore the app** - Try all the screens and features
2. **Check the backend** - Visit `http://localhost:3000/health`
3. **Generate more data** - Run `npm run simulate-trips`
4. **Read the code** - Start with `src/App.tsx` and `backend/src/index.ts`
5. **Customize** - Modify the configuration in `src/constants/Config.ts`

## 🚀 Ready to Deploy?

See the [deployment section](README.md#deployment) in the main README for production setup.

---

**Happy coding! 🎉**


