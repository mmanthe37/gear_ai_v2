/**
 * Gear AI CoPilot - Subscription Service
 * 
 * Manages user subscriptions and tier limits
 */

import { supabase } from '../lib/supabase';
import { UNLIMITED_VEHICLES } from './constants';

export type SubscriptionTier = 'free' | 'pro' | 'mechanic' | 'dealer';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';

export interface TierLimits {
  maxVehicles: number;
  features: {
    ocrVinScan: boolean;
    ragManualChat: boolean;
    obdDiagnostics: boolean;
    damageDetection: boolean;
    valuationTracking: boolean;
    marketplaceTools: boolean;
    webDashboard: boolean;
    apiAccess: boolean;
  };
}

/**
 * Tier limits configuration
 */
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxVehicles: 1,
    features: {
      ocrVinScan: false,
      ragManualChat: false,
      obdDiagnostics: false,
      damageDetection: false,
      valuationTracking: false,
      marketplaceTools: false,
      webDashboard: false,
      apiAccess: false,
    },
  },
  pro: {
    maxVehicles: 3,
    features: {
      ocrVinScan: true,
      ragManualChat: true,
      obdDiagnostics: false,
      damageDetection: false,
      valuationTracking: true,
      marketplaceTools: false,
      webDashboard: false,
      apiAccess: false,
    },
  },
  mechanic: {
    maxVehicles: UNLIMITED_VEHICLES,
    features: {
      ocrVinScan: true,
      ragManualChat: true,
      obdDiagnostics: true,
      damageDetection: true,
      valuationTracking: true,
      marketplaceTools: true,
      webDashboard: false,
      apiAccess: false,
    },
  },
  dealer: {
    maxVehicles: UNLIMITED_VEHICLES,
    features: {
      ocrVinScan: true,
      ragManualChat: true,
      obdDiagnostics: true,
      damageDetection: true,
      valuationTracking: true,
      marketplaceTools: true,
      webDashboard: true,
      apiAccess: true,
    },
  },
};

/**
 * Get user's subscription tier and status
 */
export async function getUserSubscription(userId: string): Promise<{
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  periodEnd?: string;
  stripeCustomerId?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('tier, subscription_status, subscription_period_end, stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user subscription:', error);
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    return {
      tier: (data.tier as SubscriptionTier) || 'free',
      status: (data.subscription_status as SubscriptionStatus) || 'none',
      periodEnd: data.subscription_period_end,
      stripeCustomerId: data.stripe_customer_id,
    };
  } catch (error: any) {
    console.error('Error in getUserSubscription:', error);
    throw error;
  }
}

/**
 * Get tier limits for a user
 */
export async function getUserTierLimits(userId: string): Promise<TierLimits> {
  try {
    const subscription = await getUserSubscription(userId);
    return TIER_LIMITS[subscription.tier];
  } catch (error: any) {
    console.error('Error in getUserTierLimits:', error);
    // Return free tier limits as fallback
    return TIER_LIMITS.free;
  }
}

/**
 * Check if user has access to a specific feature
 */
export async function hasFeatureAccess(
  userId: string,
  feature: keyof TierLimits['features']
): Promise<boolean> {
  try {
    const limits = await getUserTierLimits(userId);
    return limits.features[feature];
  } catch (error: any) {
    console.error('Error in hasFeatureAccess:', error);
    return false;
  }
}

/**
 * Update user's subscription tier (for internal use)
 */
export async function updateSubscriptionTier(
  userId: string,
  tier: SubscriptionTier,
  status: SubscriptionStatus,
  periodEnd?: string
): Promise<void> {
  try {
    const updateData: any = {
      tier,
      subscription_status: status,
      updated_at: new Date().toISOString(),
    };

    if (periodEnd) {
      updateData.subscription_period_end = periodEnd;
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating subscription tier:', error);
      throw new Error(`Failed to update subscription tier: ${error.message}`);
    }

    console.log('✅ Subscription tier updated:', userId, tier);
  } catch (error: any) {
    console.error('Error in updateSubscriptionTier:', error);
    throw error;
  }
}

/**
 * Set Stripe customer ID for a user
 */
export async function setStripeCustomerId(
  userId: string,
  stripeCustomerId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        stripe_customer_id: stripeCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error setting Stripe customer ID:', error);
      throw new Error(`Failed to set Stripe customer ID: ${error.message}`);
    }

    console.log('✅ Stripe customer ID set:', userId);
  } catch (error: any) {
    console.error('Error in setStripeCustomerId:', error);
    throw error;
  }
}

/**
 * Cancel subscription (set status to canceled, but keep tier until period end)
 */
export async function cancelSubscription(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error canceling subscription:', error);
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }

    console.log('✅ Subscription canceled:', userId);
  } catch (error: any) {
    console.error('Error in cancelSubscription:', error);
    throw error;
  }
}

/**
 * Reactivate subscription
 */
export async function reactivateSubscription(
  userId: string,
  tier: SubscriptionTier
): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        tier,
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error reactivating subscription:', error);
      throw new Error(`Failed to reactivate subscription: ${error.message}`);
    }

    console.log('✅ Subscription reactivated:', userId, tier);
  } catch (error: any) {
    console.error('Error in reactivateSubscription:', error);
    throw error;
  }
}

/**
 * Check if subscription is active
 */
export async function isSubscriptionActive(userId: string): Promise<boolean> {
  try {
    const subscription = await getUserSubscription(userId);
    return subscription.status === 'active' || subscription.status === 'trialing';
  } catch (error: any) {
    console.error('Error in isSubscriptionActive:', error);
    return false;
  }
}

/**
 * Get subscription price for tier (stub for future Stripe integration)
 */
export function getSubscriptionPrice(
  tier: SubscriptionTier,
  interval: 'monthly' | 'yearly'
): { amount: number; currency: string } {
  const prices: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 9.99, yearly: 99.99 },
    mechanic: { monthly: 19.99, yearly: 199.99 },
    dealer: { monthly: 99.99, yearly: 999.99 },
  };

  return {
    amount: prices[tier][interval],
    currency: 'USD',
  };
}

/**
 * Create Stripe checkout session (stub - requires Stripe integration)
 */
export async function createCheckoutSession(
  userId: string,
  tier: SubscriptionTier,
  interval: 'monthly' | 'yearly'
): Promise<{ sessionId: string; url: string }> {
  // TODO: Implement Stripe checkout session creation
  // This is a stub that should be replaced with actual Stripe integration
  console.warn('Stripe integration not yet implemented');
  throw new Error('Stripe checkout not available. Please configure Stripe API keys.');
}

/**
 * Handle Stripe webhook (stub - requires Stripe integration)
 */
export async function handleStripeWebhook(event: any): Promise<void> {
  // TODO: Implement Stripe webhook handling
  // This is a stub that should be replaced with actual Stripe integration
  console.warn('Stripe webhook handling not yet implemented');
  throw new Error('Stripe webhook handling not available.');
}
