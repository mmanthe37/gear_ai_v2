/**
 * Gear AI CoPilot - Vehicle Service
 * 
 * CRUD operations for vehicle management in Supabase
 */

import { supabase } from '../lib/supabase';
import { Vehicle, VehicleFormData } from '../types/vehicle';

/**
 * Create a new vehicle for a user
 */
export async function createVehicle(
  userId: string,
  vehicleData: VehicleFormData
): Promise<Vehicle> {
  try {
    const newVehicle = {
      user_id: userId,
      vin: vehicleData.vin || '',
      year: vehicleData.year,
      make: vehicleData.make,
      model: vehicleData.model,
      trim: vehicleData.trim,
      current_mileage: vehicleData.mileage,
      color: vehicleData.color,
      license_plate: vehicleData.license_plate,
      purchase_date: vehicleData.purchase_date,
      purchase_price: vehicleData.purchase_price,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('vehicles')
      .insert(newVehicle)
      .select()
      .single();

    if (error) {
      console.error('Error creating vehicle:', error);
      throw new Error(`Failed to create vehicle: ${error.message}`);
    }

    console.log('✅ Vehicle created:', data.vehicle_id);
    return data;
  } catch (error: any) {
    console.error('Error in createVehicle:', error);
    throw error;
  }
}

/**
 * Get all vehicles for a user
 */
export async function getUserVehicles(userId: string): Promise<Vehicle[]> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching vehicles:', error);
      throw new Error(`Failed to fetch vehicles: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getUserVehicles:', error);
    throw error;
  }
}

/**
 * Get a single vehicle by ID
 */
export async function getVehicleById(
  vehicleId: string,
  userId: string
): Promise<Vehicle | null> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Vehicle not found
      }
      console.error('Error fetching vehicle:', error);
      throw new Error(`Failed to fetch vehicle: ${error.message}`);
    }

    return data;
  } catch (error: any) {
    console.error('Error in getVehicleById:', error);
    throw error;
  }
}

/**
 * Update vehicle information
 */
export async function updateVehicle(
  vehicleId: string,
  userId: string,
  updates: Partial<VehicleFormData>
): Promise<Vehicle> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Map VehicleFormData to database columns
    if (updates.year !== undefined) updateData.year = updates.year;
    if (updates.make !== undefined) updateData.make = updates.make;
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.trim !== undefined) updateData.trim = updates.trim;
    if (updates.mileage !== undefined) updateData.current_mileage = updates.mileage;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.license_plate !== undefined) updateData.license_plate = updates.license_plate;
    if (updates.purchase_date !== undefined) updateData.purchase_date = updates.purchase_date;
    if (updates.purchase_price !== undefined) updateData.purchase_price = updates.purchase_price;

    const { data, error } = await supabase
      .from('vehicles')
      .update(updateData)
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vehicle:', error);
      throw new Error(`Failed to update vehicle: ${error.message}`);
    }

    console.log('✅ Vehicle updated:', vehicleId);
    return data;
  } catch (error: any) {
    console.error('Error in updateVehicle:', error);
    throw error;
  }
}

/**
 * Update vehicle mileage
 */
export async function updateVehicleMileage(
  vehicleId: string,
  userId: string,
  mileage: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .update({
        current_mileage: mileage,
        updated_at: new Date().toISOString(),
      })
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating vehicle mileage:', error);
      throw new Error(`Failed to update mileage: ${error.message}`);
    }

    console.log('✅ Vehicle mileage updated:', vehicleId);
  } catch (error: any) {
    console.error('Error in updateVehicleMileage:', error);
    throw error;
  }
}

/**
 * Update vehicle profile image
 */
export async function updateVehicleImage(
  vehicleId: string,
  userId: string,
  imageUrl: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .update({
        profile_image: imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating vehicle image:', error);
      throw new Error(`Failed to update vehicle image: ${error.message}`);
    }

    console.log('✅ Vehicle image updated:', vehicleId);
  } catch (error: any) {
    console.error('Error in updateVehicleImage:', error);
    throw error;
  }
}

/**
 * Soft delete a vehicle (set is_active to false)
 */
export async function deleteVehicle(
  vehicleId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting vehicle:', error);
      throw new Error(`Failed to delete vehicle: ${error.message}`);
    }

    console.log('✅ Vehicle deleted (soft):', vehicleId);
  } catch (error: any) {
    console.error('Error in deleteVehicle:', error);
    throw error;
  }
}

/**
 * Hard delete a vehicle (permanently remove from database)
 * This will cascade delete all related records (maintenance, diagnostics, etc.)
 */
export async function hardDeleteVehicle(
  vehicleId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error hard deleting vehicle:', error);
      throw new Error(`Failed to permanently delete vehicle: ${error.message}`);
    }

    console.log('✅ Vehicle permanently deleted:', vehicleId);
  } catch (error: any) {
    console.error('Error in hardDeleteVehicle:', error);
    throw error;
  }
}

/**
 * Get vehicle count for a user (for tier limit checking)
 */
export async function getUserVehicleCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Error counting vehicles:', error);
      throw new Error(`Failed to count vehicles: ${error.message}`);
    }

    return count || 0;
  } catch (error: any) {
    console.error('Error in getUserVehicleCount:', error);
    throw error;
  }
}

/**
 * Check if user can add more vehicles based on their subscription tier
 */
export async function canAddVehicle(userId: string): Promise<{
  canAdd: boolean;
  currentCount: number;
  maxAllowed: number;
  tier: string;
}> {
  try {
    // Get user tier
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tier')
      .eq('user_id', userId)
      .single();

    if (userError) {
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }

    const tier = userData?.tier || 'free';

    // Define tier limits
    const tierLimits: Record<string, number> = {
      free: 1,
      pro: 3,
      mechanic: 999999, // unlimited
      dealer: 999999, // unlimited
    };

    const maxAllowed = tierLimits[tier] || 1;
    const currentCount = await getUserVehicleCount(userId);

    return {
      canAdd: currentCount < maxAllowed,
      currentCount,
      maxAllowed,
      tier,
    };
  } catch (error: any) {
    console.error('Error in canAddVehicle:', error);
    throw error;
  }
}

/**
 * Search vehicles by VIN
 */
export async function searchVehicleByVIN(
  vin: string,
  userId: string
): Promise<Vehicle | null> {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('vin', vin)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Vehicle not found
      }
      console.error('Error searching vehicle by VIN:', error);
      throw new Error(`Failed to search vehicle: ${error.message}`);
    }

    return data;
  } catch (error: any) {
    console.error('Error in searchVehicleByVIN:', error);
    throw error;
  }
}
