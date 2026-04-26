#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Checks if required environment variables are set
 */

// Define required environment variables by context.
// Each entry may be a string (single var) or an array of strings (any one is acceptable,
// matching the fallback logic in app.config.js).
const REQUIRED_VARS = {
  development: [
    ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
    ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  ],
  production: [
    ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
    ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  ],
};

// Optional but recommended variables
const RECOMMENDED_VARS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'ALLOWED_ORIGINS',
  'SENTRY_DSN',
];

function validateEnvironment(env = 'development') {
  console.log('🔍 Validating environment variables...\n');

  // Validate environment value
  const validEnvs = ['development', 'production'];
  if (!validEnvs.includes(env)) {
    console.log(`⚠ Warning: Unknown environment '${env}', using 'development' requirements`);
    env = 'development';
  }

  const required = REQUIRED_VARS[env] || REQUIRED_VARS.development;
  const missing = [];
  const present = [];

  // Check required variables (entries may be a string or an array of accepted aliases)
  required.forEach((entry) => {
    const aliases = Array.isArray(entry) ? entry : [entry];
    const found = aliases.find((name) => process.env[name]);
    if (found) {
      present.push(found);
      console.log('✓', found, aliases.length > 1 ? `(alias: ${aliases.join(' | ')})` : '');
    } else {
      const primary = aliases[0];
      missing.push(primary);
      console.log('✗', aliases.join(' | '), '(REQUIRED)');
    }
  });

  console.log();

  // Check recommended variables
  const missingRecommended = [];
  RECOMMENDED_VARS.forEach((varName) => {
    if (!process.env[varName]) {
      missingRecommended.push(varName);
      console.log('⚠', varName, '(optional)');
    }
  });

  console.log();

  // Summary
  if (missing.length === 0) {
    console.log('✓ All required environment variables are set!');
    
    if (missingRecommended.length > 0) {
      console.log(`\n⚠ ${missingRecommended.length} optional variable(s) not set.`);
      console.log('These are not required but enable additional features.');
    }
    
    process.exit(0);
  } else {
    console.log(`✗ ${missing.length} required variable(s) missing!`);
    console.log('\nMissing variables:');
    missing.forEach((varName) => {
      console.log('  -', varName);
    });
    console.log('\nTo fix:');
    console.log('1. Copy .env.example to .env.local');
    console.log('2. Fill in your API keys');
    console.log('3. Run this script again\n');
    
    process.exit(1);
  }
}

// Run validation
const env = process.env.NODE_ENV || 'development';
validateEnvironment(env);
