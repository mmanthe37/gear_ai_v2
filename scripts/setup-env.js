#!/usr/bin/env node

/**
 * Gear AI CoPilot - Environment Setup Script
 * 
 * Validates environment variables and provides helpful feedback
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_VARS = {
  firebase: [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
  ],
  supabase: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ],
};

const OPTIONAL_VARS = {
  firebase_full: [
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'FIREBASE_MEASUREMENT_ID',
  ],
  supabase_full: [
    'SUPABASE_SERVICE_KEY',
  ],
  ai: [
    'OPENAI_API_KEY',
  ],
  payments: [
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
  ],
  apis: [
    'CARMD_PARTNER_TOKEN',
    'CARMD_AUTH_TOKEN',
    'MARKETCHECK_API_KEY',
  ],
};

function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!');
    console.log('\n📝 To create it:');
    console.log('   cp .env.example .env.local');
    console.log('   # Then edit .env.local with your actual credentials\n');
    return false;
  }
  
  return true;
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (value && !value.startsWith('your_')) {
        env[key] = value;
      }
    }
  });
  
  return env;
}

function validateEnv() {
  console.log('🔍 Validating environment configuration...\n');
  
  if (!checkEnvFile()) {
    process.exit(1);
  }
  
  const env = loadEnvFile();
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check required variables
  console.log('📋 Required Configuration:');
  
  for (const [category, vars] of Object.entries(REQUIRED_VARS)) {
    console.log(`\n  ${category.toUpperCase()}:`);
    
    for (const varName of vars) {
      if (env[varName]) {
        console.log(`    ✅ ${varName}`);
      } else {
        console.log(`    ❌ ${varName} - MISSING OR PLACEHOLDER`);
        hasErrors = true;
      }
    }
  }
  
  // Check optional variables
  console.log('\n\n📦 Optional Configuration:');
  
  for (const [category, vars] of Object.entries(OPTIONAL_VARS)) {
    console.log(`\n  ${category.toUpperCase()}:`);
    
    for (const varName of vars) {
      if (env[varName]) {
        console.log(`    ✅ ${varName}`);
      } else {
        console.log(`    ⚠️  ${varName} - Not configured`);
        hasWarnings = true;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (hasErrors) {
    console.log('\n❌ Environment validation FAILED');
    console.log('\n📝 Required variables are missing. Please:');
    console.log('   1. Create Firebase project at https://console.firebase.google.com');
    console.log('   2. Create Supabase project at https://supabase.com');
    console.log('   3. Update .env.local with your actual API keys');
    console.log('   4. Run this script again to verify\n');
    process.exit(1);
  }
  
  if (hasWarnings) {
    console.log('\n⚠️  Environment validation PASSED with warnings');
    console.log('\nOptional features will be limited without additional API keys.');
    console.log('The app will work, but some features may not be available.\n');
  } else {
    console.log('\n✅ Environment validation PASSED');
    console.log('\nAll configuration looks good! You\'re ready to start development.\n');
  }
}

function showHelp() {
  console.log(`
Gear AI CoPilot - Environment Setup

Usage:
  node scripts/setup-env.js          Validate environment configuration
  node scripts/setup-env.js --help   Show this help message

Quick Start:
  1. Copy the example file:
     cp .env.example .env.local

  2. Edit .env.local with your credentials:
     - Firebase API keys (required)
     - Supabase URL and keys (required)
     - OpenAI API key (optional, for AI features)
     - Stripe keys (optional, for payments)

  3. Run this script to validate:
     node scripts/setup-env.js

For more information, see:
  - SETUP_GUIDE.md
  - DEPLOYMENT_READY.md
`);
}

// Main execution
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
} else {
  validateEnv();
}
