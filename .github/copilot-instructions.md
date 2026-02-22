# GitHub Copilot Instructions for Gear AI CoPilot

## Project Overview

**Gear AI CoPilot** is a comprehensive mobile application that consolidates fragmented automotive tools into a single, intelligent "Digital Twin" for vehicles. The app combines VIN decoding, owner's manual RAG chat, OBD-II diagnostics, and real-time market valuation using AI, telematics, and real-time market data.

**Development Status**: Phase 1 MVP (65% Complete)
- Infrastructure: 95% complete (deployment-ready)
- Frontend UI: 95% complete (all screens designed)
- Backend: 35% complete (schema ready, services partial)

## Technology Stack

### Frontend
- **Framework**: React Native 0.79 with Expo SDK 53
- **Language**: TypeScript 5.8 with strict mode enabled
- **Navigation**: Expo Router (file-based routing)
- **UI Design**: Custom "Liquid Glass" glassmorphism design system
- **Styling**: Expo Linear Gradient, Expo Blur

### Backend
- **BaaS**: Supabase (PostgreSQL 15 + pgvector extension)
- **Auth**: Firebase Auth (synced with Supabase)
- **Serverless**: Supabase Edge Functions (Deno runtime)
- **Storage**: Supabase Storage (for photos, manuals)

### AI/ML
- **LLM**: OpenAI GPT-4 for conversational AI
- **Embeddings**: intfloat/e5-base-v2 (768 dimensions)
- **Vector Search**: pgvector with ivfflat indexing

### Third-Party APIs
- **VIN Decoding**: NHTSA vPIC API
- **Diagnostics**: CarMD API
- **Valuation**: MarketCheck, Black Book
- **Payments**: Stripe Connect

## Coding Conventions

### TypeScript Standards
- **Always use TypeScript strict mode** - no implicit any
- Define explicit types for all function parameters and return values
- Avoid using `any` type - use `unknown` or proper types instead
- Use interfaces for object shapes, type aliases for unions/primitives
- Prefer named exports over default exports for better refactoring

### File Naming Conventions
- **Components**: PascalCase.tsx (e.g., `VehicleCard.tsx`, `GlassCard.tsx`)
- **Services/Utilities**: kebab-case.ts (e.g., `vin-decoder.ts`, `auth-service.ts`)
- **Type Definitions**: PascalCase.ts, matching the main type name (e.g., `Vehicle.ts`, `User.ts`)
- **Expo Router Pages**: lowercase.tsx or [dynamic].tsx (e.g., `index.tsx`, `[id].tsx`)

### React/React Native Patterns
- Use functional components with React hooks exclusively
- Keep components small, focused, and single-purpose
- Extract reusable logic into custom hooks
- Use meaningful prop names with TypeScript interfaces
- Destructure props in function parameters
- Use React.memo() for components that render frequently with same props

### Code Style
- Follow ESLint configuration (extends expo/tsconfig.base)
- Use Prettier for consistent formatting
- Write JSDoc comments for public functions and components
- Explain "why" not "what" in inline comments
- Maximum line length: 100 characters

### Import Organization
Order imports as follows:
1. React and React Native imports
2. Third-party library imports (alphabetical)
3. Local imports: types, contexts, components, services, utilities
4. Relative imports (../.. imports)

Example:
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Vehicle } from '@/types/vehicle';
import { useAuth } from '@/contexts/AuthContext';
import { GlassCard } from '@/components/GlassCard';
import { getVehicles } from '@/services/vehicle-service';
```

## Project Structure

```
gear_ai_v2/
├── app/                    # Expo Router screens (file-based routing)
│   ├── (tabs)/            # Bottom tab navigation screens
│   ├── chat/              # Chat conversation screens
│   ├── _layout.tsx        # Root layout with providers
│   ├── index.tsx          # Landing/home screen
│   └── login.tsx          # Authentication screen
├── components/            # Reusable UI components
├── contexts/              # React Context providers (Auth, etc.)
├── lib/                   # Third-party integrations (Firebase, Supabase clients)
├── services/              # Business logic and API integrations
├── types/                 # TypeScript type definitions
├── docs/                  # Comprehensive documentation
├── supabase/              # Database migrations and functions
│   └── migrations/        # SQL migration files
└── assets/                # Images, fonts, icons
```

## Database Conventions

### Schema Naming
- **Tables**: Plural, snake_case (e.g., `users`, `vehicles`, `maintenance_records`)
- **Columns**: snake_case (e.g., `user_id`, `created_at`, `firebase_uid`)
- **Primary Keys**: `{table_name}_id` UUID (e.g., `vehicle_id`, `user_id`)
- **Foreign Keys**: Match the referenced table's primary key name
- **Timestamps**: Always include `created_at` and `updated_at` columns

### Row Level Security (RLS)
- All user-facing tables MUST have RLS enabled
- Always use `auth.uid()` to match Firebase UID with `firebase_uid` column
- Create separate policies for SELECT, INSERT, UPDATE, DELETE
- Users should only access their own data (via user_id reference)

### Migrations
- **Naming**: `YYYYMMDDHHMMSS_description.sql` (e.g., `20250101000000_initial_schema.sql`)
- **Order**: Run migrations in chronological order:
  1. `20250101000000_initial_schema.sql` (base tables)
  2. `20250101000001_rls_policies.sql` (security policies)
  3. `20250201000000_search_manual_chunks_rpc.sql` (RPC functions)
  4. `20250301000000_helper_functions.sql` (utility functions)

## Service Layer Patterns

### Service Organization
- One service file per domain (e.g., `vehicle-service.ts`, `maintenance-service.ts`)
- Export named functions, not classes
- Each function should be async and return Promise<T>
- Handle errors gracefully with try-catch blocks
- Log errors with descriptive context

### Supabase Client Usage
- Import from `@/lib/supabase`
- Always use `.select()` with specific columns or `*`
- Use `.single()` for queries expecting one row
- Handle both `data` and `error` from responses
- Use `.order()`, `.limit()`, and `.range()` for pagination

### Example Service Function
```typescript
/**
 * Get all vehicles for the authenticated user
 * @param userId - The user's UUID from Supabase
 * @returns Array of vehicles or empty array on error
 */
export async function getVehicles(userId: string): Promise<Vehicle[]> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching vehicles:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Unexpected error fetching vehicles:', error);
    return [];
  }
}
```

## Subscription Tiers

The app enforces subscription tier limits. **Always check tier limits before operations**:

### Vehicle Limits
- **Free**: 1 vehicle
- **Pro**: 3 vehicles
- **Mechanic**: Unlimited
- **Dealer**: Unlimited

### Key Functions
- Use `canAddVehicle()` from `vehicle-service.ts` before allowing users to add vehicles
- Use constants from `services/constants.ts` (e.g., `UNLIMITED_VEHICLES`, `MAX_FILE_SIZE_BYTES`)
- Check subscription status before enabling premium features (RAG chat, OBD-II, etc.)

## UI/UX Patterns - Liquid Glass Design System

### Glass Card Components
- Use `GlassCard` component for all card-based UI elements
- Glass cards use semi-transparent backgrounds with blur effects
- Standard elevation: `backgroundColor: 'rgba(255, 255, 255, 0.1)'`
- Apply `BlurView` with intensity 20-40 for glassmorphism effect

### Color Palette
- **Primary**: `#00D4FF` (cyan blue)
- **Secondary**: `#8B5CF6` (purple)
- **Success**: `#10B981` (green)
- **Warning**: `#F59E0B` (orange)
- **Error**: `#EF4444` (red)
- **Text on Glass**: `#FFFFFF` (white) with varying opacity
- **Dark Background**: `#0F172A` (slate-900)

### Gradients
- Use `LinearGradient` from expo-linear-gradient
- Common gradient: `['#1E293B', '#0F172A']` (slate-800 to slate-900)
- Accent gradients: `['#00D4FF', '#8B5CF6']` (cyan to purple)

### Typography
- Use system fonts: 'System' or 'SF Pro' on iOS, 'Roboto' on Android
- Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Heading hierarchy: 28px (h1), 24px (h2), 20px (h3), 16px (h4)
- Body text: 14-16px

## AI & RAG Pipeline

### Vector Search
- Embeddings are stored in `vector_embeddings` table with pgvector
- Use `search_manual_chunks_rpc()` function for similarity search
- Embedding model: intfloat/e5-base-v2 (768 dimensions)
- Search with cosine similarity, threshold 0.7 for relevance

### OpenAI Integration
- Import from `@/services/ai-service.ts`
- Use GPT-4 for conversational AI (not GPT-3.5)
- Set temperature: 0.7 for balanced creativity/consistency
- Include system prompts with automotive context
- Stream responses for better UX on long outputs

### RAG Pipeline Flow
1. User asks a question about their vehicle
2. Generate embedding for the question
3. Search `vector_embeddings` for similar manual chunks
4. Pass top 5 chunks as context to GPT-4
5. Generate answer grounded in manual content
6. Return answer with chunk citations

## Testing & Build

### Environment Setup
- Copy `.env.example` to `.env.local` for local development
- Never commit `.env.local` or any files with API keys
- Run `npm run setup` to validate environment configuration (if available)

### Development Commands
- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator/device
- `npm run ios` - Run on iOS simulator/device
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint
- `npm run build` - Build for production (web export)

### Pre-commit Checklist
- Run `npm run lint` and fix all errors
- Ensure no console.log statements in production code (use proper logging)
- Test on both iOS and Android (or web for web-specific changes)
- Verify no TypeScript errors with `tsc --noEmit`
- Check that no secrets are committed

## Security Best Practices

### Authentication
- Never store Firebase credentials in code
- Use Firebase Auth for user authentication
- Sync Firebase UID to Supabase `users.firebase_uid` column
- Always verify auth state before API calls

### API Keys
- Store all API keys in environment variables (`.env.local`)
- Use different keys for development and production
- Never log API keys or tokens
- Rotate keys if accidentally exposed

### Data Privacy
- Implement RLS policies for all user data tables
- Sanitize user inputs before database operations
- Don't log sensitive user information (emails, VINs, etc.)
- Follow GDPR and CCPA compliance guidelines

### Supabase Security
- Use service role key only for admin operations (never in client code)
- Use anon key for client-side Supabase operations
- RLS policies provide security - don't bypass them
- Validate all user inputs before database writes

## Common Patterns & Examples

### Adding a New Feature Screen
1. Create screen file in `app/` directory (e.g., `app/new-feature.tsx`)
2. Define TypeScript types in `types/` if needed
3. Create service functions in `services/` for data operations
4. Build UI components using Liquid Glass design system
5. Update navigation in `app/_layout.tsx` if adding to tabs

### Creating a New Service
1. Create `new-service.ts` in `services/` directory
2. Import Supabase client: `import { supabase } from '@/lib/supabase'`
3. Define TypeScript interfaces for parameters and return types
4. Export async functions with JSDoc comments
5. Handle errors with try-catch and descriptive logging
6. Export from `services/index.ts` for easier imports

### Adding Database Migrations
1. Create new file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Write SQL for schema changes (CREATE, ALTER, etc.)
3. Add RLS policies if creating new user-facing tables
4. Update `docs/DATABASE_SCHEMA.md` with schema changes
5. Test migration on local Supabase instance before deploying

## Documentation References

- **[ARCHITECTURE.md](../docs/ARCHITECTURE.md)** - System architecture and design
- **[DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md)** - Complete database schema
- **[DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md)** - UI/UX guidelines and components
- **[API_INTEGRATION.md](../docs/API_INTEGRATION.md)** - Third-party API specifications
- **[QUICK_START.md](../docs/QUICK_START.md)** - Setup and getting started guide
- **[DEVELOPMENT_STATUS.md](../docs/DEVELOPMENT_STATUS.md)** - Current feature completion
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines

## Known Limitations & Todos

- Backend services are partially implemented (~35% complete)
- Some UI screens need backend integration
- OBD-II Bluetooth integration not yet implemented
- RAG pipeline needs manual content ingestion
- Stripe payment integration in progress
- No automated tests yet (test infrastructure needed)

## Best Practices Summary

1. **Type Safety**: Use TypeScript strict mode, explicit types everywhere
2. **File Organization**: Follow established naming conventions and structure
3. **Code Quality**: Run linter, write clean code, add JSDoc comments
4. **Security First**: RLS policies, environment variables, input validation
5. **UI Consistency**: Use Liquid Glass components, follow design system
6. **Error Handling**: Try-catch blocks, descriptive error messages, user-friendly feedback
7. **Performance**: React.memo for expensive components, lazy loading, optimize images
8. **Documentation**: Update docs when changing architecture or adding features
9. **Subscription Tiers**: Always check tier limits before operations
10. **Conventional Commits**: Use semantic commit messages (feat, fix, docs, etc.)

---

**Last Updated**: February 22, 2026
**Repository**: github.com/mmanthe37/gear_ai_v2
