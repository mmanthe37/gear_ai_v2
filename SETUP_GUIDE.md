# 🚀 Quick Setup Guide for Gear AI CoPilot

This guide will help you set up the Gear AI CoPilot application for development and deployment.

## Prerequisites

- **Node.js** 18+ and npm
- **Git** for version control
- **Firebase account** (free tier is sufficient for development)
- **Supabase account** (free tier is sufficient for development)

## Step 1: Clone and Install

```bash
git clone https://github.com/mmanthe37/gear_ai_v2.git
cd gear_ai_v2
npm install
```

## Step 2: Set Up Firebase

### 2.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Enter project name (e.g., "gear-ai-copilot")
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2.2 Enable Firebase Authentication

1. In your Firebase project, go to **Build → Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. Save

### 2.3 Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click "Add app" → Web (</>) icon
4. Register app with nickname (e.g., "gear-ai-web")
5. Copy the Firebase configuration object

You'll need these values:
- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

## Step 3: Set Up Supabase

### 3.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New project"
3. Enter project name (e.g., "gear-ai-copilot")
4. Set a strong database password (save it securely!)
5. Choose a region close to your users
6. Click "Create new project"

### 3.2 Run Database Migrations

1. Once your project is ready, go to **SQL Editor**
2. Copy the contents of `supabase/migrations/20250101000000_initial_schema.sql`
3. Paste into SQL Editor and click "Run"
4. Repeat for `supabase/migrations/20250101000001_rls_policies.sql`
5. Repeat for `supabase/migrations/20250201000000_search_manual_chunks_rpc.sql`

### 3.3 Get Supabase Configuration

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (under "Project API keys")
   - **service_role key** (optional, for server-side operations)

### 3.4 Set Up Storage Buckets

1. Go to **Storage** in Supabase dashboard
2. Create four buckets:
   - `vehicle-photos` (public)
   - `maintenance-receipts` (private)
   - `profile-avatars` (public)
   - `manuals` (private)

Or run this code after setting up environment:

```javascript
import { initializeStorageBuckets } from './services/storage-service';
await initializeStorageBuckets();
```

## Step 4: Configure Environment Variables

### 4.1 Create .env.local

```bash
cp .env.example .env.local
```

### 4.2 Edit .env.local

Open `.env.local` and update with your actual credentials:

```env
# Firebase Configuration (REQUIRED)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# OpenAI Configuration (OPTIONAL - for AI chat features)
OPENAI_API_KEY=sk-proj-...
```

### 4.3 Validate Configuration

```bash
node scripts/setup-env.js
```

This will check your environment variables and provide feedback.

## Step 5: Start Development

### 5.1 Start the Development Server

```bash
npm start
```

Then:
- Press **w** to open in web browser
- Press **i** to open iOS simulator (macOS only)
- Press **a** to open Android emulator

### 5.2 Verify Setup

1. Open the app in your browser
2. Try to sign up with a new account
3. Check Firebase Console → Authentication to see the new user
4. Check Supabase → Table Editor → users to see synced data

## Step 6: Configure GitHub Secrets (For Deployment)

### 6.1 Add Repository Secrets

Go to your GitHub repository → **Settings → Secrets and variables → Actions**

Add these secrets:

**Required:**
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

**Optional:**
- `OPENAI_API_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`

### 6.2 Environment Variables for Vercel/Netlify

If deploying to Vercel or Netlify, add the same variables in their dashboard:

**Vercel:**
```bash
vercel env add FIREBASE_API_KEY
vercel env add FIREBASE_AUTH_DOMAIN
vercel env add FIREBASE_PROJECT_ID
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
```

**Netlify:**
```bash
netlify env:set FIREBASE_API_KEY "your-key"
netlify env:set FIREBASE_AUTH_DOMAIN "your-domain"
netlify env:set FIREBASE_PROJECT_ID "your-project"
netlify env:set SUPABASE_URL "your-url"
netlify env:set SUPABASE_ANON_KEY "your-key"
```

## Step 7: Optional Configurations

### 7.1 OpenAI API (For AI Chat Features)

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Create an account or sign in
3. Go to **API keys**
4. Create new secret key
5. Add to `.env.local`: `OPENAI_API_KEY=sk-proj-...`

### 7.2 Stripe (For Subscriptions)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your **Publishable key** and **Secret key** from Developers → API keys
3. Add to `.env.local`:
   ```env
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   ```

## Troubleshooting

### Firebase Auth Not Working

- Verify Firebase configuration in `.env.local`
- Check Firebase Console → Authentication → Sign-in method is enabled
- Clear browser cache and restart dev server

### Supabase Connection Issues

- Verify Supabase URL and keys in `.env.local`
- Check if project is active in Supabase dashboard
- Verify RLS policies are applied (run migrations)

### Build Errors

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Expo cache
npx expo start --clear
```

### Environment Variables Not Loading

- Ensure `.env.local` is in the project root
- Restart the development server after changing variables
- For web builds, variables must be prefixed with `EXPO_PUBLIC_`

## Next Steps

- 📖 Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand the codebase
- 🗄️ Review [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) for data models
- 🔌 Check [API_INTEGRATION.md](docs/API_INTEGRATION.md) for third-party APIs
- 🚀 See [BUILD_DEPLOYMENT.md](docs/BUILD_DEPLOYMENT.md) for deployment options

## Support

If you encounter issues:

1. Check the [Troubleshooting section](#troubleshooting) above
2. Review documentation in `/docs`
3. Check GitHub Issues
4. Ensure all dependencies are up to date: `npm update`

---

**Need help?** Open an issue on GitHub or check the documentation in the `/docs` directory.
