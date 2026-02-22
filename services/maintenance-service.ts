/**
 * Gear AI CoPilot - Maintenance Service
 * 
 * CRUD operations for maintenance records and service tracking
 */

import { supabase } from '../lib/supabase';
import {
  MaintenanceRecord,
  MaintenanceFormData,
  MaintenanceStats,
  ServiceReminder,
} from '../types/maintenance';

/**
 * Create a new maintenance record
 */
export async function createMaintenanceRecord(
  vehicleId: string,
  userId: string,
  data: MaintenanceFormData
): Promise<MaintenanceRecord> {
  try {
    // Verify vehicle belongs to user
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('vehicle_id')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .single();

    if (vehicleError || !vehicle) {
      throw new Error('Vehicle not found or access denied');
    }

    const newRecord = {
      vehicle_id: vehicleId,
      type: data.type,
      date: data.date,
      mileage: data.mileage,
      title: data.title,
      description: data.description,
      cost: data.cost,
      labor_cost: data.labor_cost,
      parts_cost: data.parts_cost,
      shop_name: data.shop_name,
      shop_location: data.shop_location,
      parts_replaced: data.parts_replaced || [],
      attachment_urls: [],
    };

    const { data: record, error } = await supabase
      .from('maintenance_records')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error('Error creating maintenance record:', error);
      throw new Error(`Failed to create maintenance record: ${error.message}`);
    }

    console.log('✅ Maintenance record created:', record.record_id);
    return record;
  } catch (error: any) {
    console.error('Error in createMaintenanceRecord:', error);
    throw error;
  }
}

/**
 * Get all maintenance records for a vehicle
 */
export async function getMaintenanceRecords(
  vehicleId: string,
  userId: string
): Promise<MaintenanceRecord[]> {
  try {
    // Verify vehicle belongs to user
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('vehicle_id')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .single();

    if (vehicleError || !vehicle) {
      throw new Error('Vehicle not found or access denied');
    }

    const { data, error } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching maintenance records:', error);
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getMaintenanceRecords:', error);
    throw error;
  }
}

/**
 * Get a single maintenance record by ID
 */
export async function getMaintenanceRecordById(
  recordId: string,
  userId: string
): Promise<MaintenanceRecord | null> {
  try {
    const { data, error } = await supabase
      .from('maintenance_records')
      .select(`
        *,
        vehicles!inner (
          user_id
        )
      `)
      .eq('record_id', recordId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching maintenance record:', error);
      throw new Error(`Failed to fetch maintenance record: ${error.message}`);
    }

    // Check if user owns the vehicle
    if ((data as any).vehicles.user_id !== userId) {
      throw new Error('Access denied');
    }

    return data;
  } catch (error: any) {
    console.error('Error in getMaintenanceRecordById:', error);
    throw error;
  }
}

/**
 * Update a maintenance record
 */
export async function updateMaintenanceRecord(
  recordId: string,
  userId: string,
  updates: Partial<MaintenanceFormData>
): Promise<MaintenanceRecord> {
  try {
    // Verify ownership
    const existing = await getMaintenanceRecordById(recordId, userId);
    if (!existing) {
      throw new Error('Maintenance record not found or access denied');
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Map updates
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.date !== undefined) updateData.date = updates.date;
    if (updates.mileage !== undefined) updateData.mileage = updates.mileage;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.cost !== undefined) updateData.cost = updates.cost;
    if (updates.labor_cost !== undefined) updateData.labor_cost = updates.labor_cost;
    if (updates.parts_cost !== undefined) updateData.parts_cost = updates.parts_cost;
    if (updates.shop_name !== undefined) updateData.shop_name = updates.shop_name;
    if (updates.shop_location !== undefined) updateData.shop_location = updates.shop_location;
    if (updates.parts_replaced !== undefined) updateData.parts_replaced = updates.parts_replaced;

    const { data, error } = await supabase
      .from('maintenance_records')
      .update(updateData)
      .eq('record_id', recordId)
      .select()
      .single();

    if (error) {
      console.error('Error updating maintenance record:', error);
      throw new Error(`Failed to update maintenance record: ${error.message}`);
    }

    console.log('✅ Maintenance record updated:', recordId);
    return data;
  } catch (error: any) {
    console.error('Error in updateMaintenanceRecord:', error);
    throw error;
  }
}

/**
 * Delete a maintenance record
 */
export async function deleteMaintenanceRecord(
  recordId: string,
  userId: string
): Promise<void> {
  try {
    // Verify ownership
    const existing = await getMaintenanceRecordById(recordId, userId);
    if (!existing) {
      throw new Error('Maintenance record not found or access denied');
    }

    const { error } = await supabase
      .from('maintenance_records')
      .delete()
      .eq('record_id', recordId);

    if (error) {
      console.error('Error deleting maintenance record:', error);
      throw new Error(`Failed to delete maintenance record: ${error.message}`);
    }

    console.log('✅ Maintenance record deleted:', recordId);
  } catch (error: any) {
    console.error('Error in deleteMaintenanceRecord:', error);
    throw error;
  }
}

/**
 * Get maintenance statistics for a vehicle
 */
export async function getMaintenanceStats(
  vehicleId: string,
  userId: string
): Promise<MaintenanceStats> {
  try {
    const records = await getMaintenanceRecords(vehicleId, userId);

    const totalServices = records.length;
    const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);
    const averageCostPerService = totalServices > 0 ? totalCost / totalServices : 0;

    const sortedByDate = [...records].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const lastServiceDate = sortedByDate[0]?.date;

    // Find next service due from records with next_service_date
    const upcomingServices = records
      .filter((r) => r.next_service_date)
      .sort(
        (a, b) =>
          new Date(a.next_service_date!).getTime() -
          new Date(b.next_service_date!).getTime()
      );

    const nextServiceDue = upcomingServices[0]?.next_service_date;

    // Count overdue services (next_service_date is in the past)
    const now = new Date();
    const overdueServices = records.filter(
      (r) => r.next_service_date && new Date(r.next_service_date) < now
    ).length;

    return {
      total_services: totalServices,
      total_cost: totalCost,
      average_cost_per_service: averageCostPerService,
      last_service_date: lastServiceDate,
      next_service_due: nextServiceDue,
      overdue_services: overdueServices,
    };
  } catch (error: any) {
    console.error('Error in getMaintenanceStats:', error);
    throw error;
  }
}

/**
 * Get all maintenance records for all user vehicles
 */
export async function getAllUserMaintenanceRecords(
  userId: string
): Promise<MaintenanceRecord[]> {
  try {
    const { data, error } = await supabase
      .from('maintenance_records')
      .select(`
        *,
        vehicles!inner (
          user_id
        )
      `)
      .eq('vehicles.user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching all maintenance records:', error);
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getAllUserMaintenanceRecords:', error);
    throw error;
  }
}

/**
 * Get recent maintenance records (last N records)
 */
export async function getRecentMaintenanceRecords(
  vehicleId: string,
  userId: string,
  limit: number = 5
): Promise<MaintenanceRecord[]> {
  try {
    // Verify vehicle belongs to user
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('vehicle_id')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .single();

    if (vehicleError || !vehicle) {
      throw new Error('Vehicle not found or access denied');
    }

    const { data, error } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent maintenance records:', error);
      throw new Error(`Failed to fetch recent maintenance records: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getRecentMaintenanceRecords:', error);
    throw error;
  }
}

/**
 * Add attachment URL to a maintenance record
 */
export async function addMaintenanceAttachment(
  recordId: string,
  userId: string,
  attachmentUrl: string
): Promise<void> {
  try {
    // Verify ownership
    const existing = await getMaintenanceRecordById(recordId, userId);
    if (!existing) {
      throw new Error('Maintenance record not found or access denied');
    }

    const currentAttachments = existing.attachment_urls || [];
    const updatedAttachments = [...currentAttachments, attachmentUrl];

    const { error } = await supabase
      .from('maintenance_records')
      .update({
        attachment_urls: updatedAttachments,
        updated_at: new Date().toISOString(),
      })
      .eq('record_id', recordId);

    if (error) {
      console.error('Error adding attachment:', error);
      throw new Error(`Failed to add attachment: ${error.message}`);
    }

    console.log('✅ Attachment added to maintenance record:', recordId);
  } catch (error: any) {
    console.error('Error in addMaintenanceAttachment:', error);
    throw error;
  }
}

/**
 * Remove attachment URL from a maintenance record
 */
export async function removeMaintenanceAttachment(
  recordId: string,
  userId: string,
  attachmentUrl: string
): Promise<void> {
  try {
    // Verify ownership
    const existing = await getMaintenanceRecordById(recordId, userId);
    if (!existing) {
      throw new Error('Maintenance record not found or access denied');
    }

    const currentAttachments = existing.attachment_urls || [];
    const updatedAttachments = currentAttachments.filter((url) => url !== attachmentUrl);

    const { error } = await supabase
      .from('maintenance_records')
      .update({
        attachment_urls: updatedAttachments,
        updated_at: new Date().toISOString(),
      })
      .eq('record_id', recordId);

    if (error) {
      console.error('Error removing attachment:', error);
      throw new Error(`Failed to remove attachment: ${error.message}`);
    }

    console.log('✅ Attachment removed from maintenance record:', recordId);
  } catch (error: any) {
    console.error('Error in removeMaintenanceAttachment:', error);
    throw error;
  }
}
