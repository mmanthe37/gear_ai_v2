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
  MaintenanceInterval,
  InstalledPart,
  ServiceProvider,
  MaintenanceBudget,
  CostAnalytics,
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
      attachment_urls: Array.isArray(data.photos) ? (data.photos as string[]).filter((p) => typeof p === 'string') : [],
      next_service_date: data.next_service_date,
      next_service_mileage: data.next_service_mileage,
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
    if (updates.next_service_date !== undefined) updateData.next_service_date = updates.next_service_date;
    if (updates.next_service_mileage !== undefined) updateData.next_service_mileage = updates.next_service_mileage;

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

// ---------------------------------------------------------------------------
// Service Reminders CRUD
// ---------------------------------------------------------------------------

export async function getServiceReminders(vehicleId: string, userId: string): Promise<ServiceReminder[]> {
  try {
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('vehicle_id')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .single();
    if (vehicleError || !vehicle) throw new Error('Vehicle not found or access denied');

    const { data, error } = await supabase
      .from('service_reminders')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('due_date', { ascending: true });
    if (error) throw new Error(`Failed to fetch reminders: ${error.message}`);
    return data || [];
  } catch (error: any) {
    console.error('Error in getServiceReminders:', error);
    throw error;
  }
}

export async function createServiceReminder(
  vehicleId: string,
  userId: string,
  data: Partial<ServiceReminder>
): Promise<ServiceReminder> {
  try {
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('vehicle_id')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .single();
    if (vehicleError || !vehicle) throw new Error('Vehicle not found or access denied');

    const { data: record, error } = await supabase
      .from('service_reminders')
      .insert({ ...data, vehicle_id: vehicleId })
      .select()
      .single();
    if (error) throw new Error(`Failed to create reminder: ${error.message}`);
    return record;
  } catch (error: any) {
    console.error('Error in createServiceReminder:', error);
    throw error;
  }
}

export async function updateServiceReminderStatus(
  reminderId: string,
  status: ServiceReminder['status']
): Promise<void> {
  try {
    const { error } = await supabase
      .from('service_reminders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('reminder_id', reminderId);
    if (error) throw new Error(`Failed to update reminder: ${error.message}`);
  } catch (error: any) {
    console.error('Error in updateServiceReminderStatus:', error);
    throw error;
  }
}

export async function deleteServiceReminder(reminderId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('service_reminders')
      .delete()
      .eq('reminder_id', reminderId);
    if (error) throw new Error(`Failed to delete reminder: ${error.message}`);
  } catch (error: any) {
    console.error('Error in deleteServiceReminder:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// AI Maintenance Plan
// ---------------------------------------------------------------------------

export async function generateAIMaintenancePlan(
  vehicle: { make: string; model: string; year: number; current_mileage?: number },
  openAiKey: string
): Promise<MaintenanceInterval[]> {
  const prompt = `Generate a comprehensive maintenance schedule for a ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.current_mileage ? ` with ${vehicle.current_mileage} miles` : ''}.
Return a JSON object with a "schedule" array. Each item must have: service_type (string), description (string), first_interval_miles (number), first_interval_months (number), recurring_interval_miles (number), recurring_interval_months (number), estimated_cost_min (number), estimated_cost_max (number), severity ("critical"|"important"|"recommended"|"optional").
Include: oil change, tire rotation, brake inspection, air filter, cabin filter, spark plugs, coolant flush, transmission fluid, battery check, wheel alignment, brake pads.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert automotive technician. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content from OpenAI');

  const parsed = JSON.parse(content);
  return (parsed.schedule || parsed) as MaintenanceInterval[];
}

// ---------------------------------------------------------------------------
// Cost Analytics
// ---------------------------------------------------------------------------

export async function getCostAnalytics(userId: string, vehicleId?: string): Promise<CostAnalytics> {
  try {
    let query = supabase
      .from('maintenance_records')
      .select('*, vehicles!inner(user_id, make, model, year)')
      .eq('vehicles.user_id', userId);

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch records: ${error.message}`);

    const records = data || [];
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    const total_lifetime = records.reduce((sum, r) => sum + (r.cost || 0), 0);
    const total_this_year = records
      .filter((r) => new Date(r.date).getFullYear() === thisYear)
      .reduce((sum, r) => sum + (r.cost || 0), 0);
    const total_this_month = records
      .filter((r) => {
        const d = new Date(r.date);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
      })
      .reduce((sum, r) => sum + (r.cost || 0), 0);

    const mileages = records.map((r) => r.mileage).filter((m): m is number => typeof m === 'number' && m > 0);
    const minMileage = mileages.length > 0 ? Math.min(...mileages) : 0;
    const maxMileage = mileages.length > 0 ? Math.max(...mileages) : 0;
    const mileageDiff = maxMileage - minMileage;
    const cost_per_mile = mileageDiff > 0 ? total_lifetime / mileageDiff : 0;

    const categoryMap = new Map<string, number>();
    records.forEach((r) => {
      const cat = r.type || 'other';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + (r.cost || 0));
    });
    const by_category = Array.from(categoryMap.entries()).map(([category, total]) => ({ category, total }));

    // Last 12 months
    const by_month: { month: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const monthKey = d.toISOString().slice(0, 7);
      const total = records
        .filter((r) => r.date && r.date.startsWith(monthKey))
        .reduce((sum, r) => sum + (r.cost || 0), 0);
      by_month.push({ month: monthKey, total });
    }

    const vehicleMap = new Map<string, { name: string; total: number }>();
    records.forEach((r) => {
      const v = (r as any).vehicles;
      const name = v ? `${v.year} ${v.make} ${v.model}` : r.vehicle_id;
      const existing = vehicleMap.get(r.vehicle_id) || { name, total: 0 };
      vehicleMap.set(r.vehicle_id, { name, total: existing.total + (r.cost || 0) });
    });
    const by_vehicle = Array.from(vehicleMap.entries()).map(([vehicle_id, v]) => ({ vehicle_id, name: v.name, total: v.total }));

    return { total_lifetime, total_this_year, total_this_month, cost_per_mile, by_category, by_month, by_vehicle };
  } catch (error: any) {
    console.error('Error in getCostAnalytics:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Parts Installed CRUD
// ---------------------------------------------------------------------------

export async function getInstalledParts(vehicleId: string): Promise<InstalledPart[]> {
  try {
    const { data, error } = await supabase
      .from('parts_installed')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('install_date', { ascending: false });
    if (error) throw new Error(`Failed to fetch parts: ${error.message}`);
    return data || [];
  } catch (error: any) {
    console.error('Error in getInstalledParts:', error);
    throw error;
  }
}

export async function createInstalledPart(
  data: Omit<InstalledPart, 'part_id' | 'created_at' | 'updated_at'>
): Promise<InstalledPart> {
  try {
    const { data: part, error } = await supabase
      .from('parts_installed')
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(`Failed to create part: ${error.message}`);
    return part;
  } catch (error: any) {
    console.error('Error in createInstalledPart:', error);
    throw error;
  }
}

export async function deleteInstalledPart(partId: string): Promise<void> {
  try {
    const { error } = await supabase.from('parts_installed').delete().eq('part_id', partId);
    if (error) throw new Error(`Failed to delete part: ${error.message}`);
  } catch (error: any) {
    console.error('Error in deleteInstalledPart:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Service Providers CRUD
// ---------------------------------------------------------------------------

export async function getServiceProviders(userId: string): Promise<ServiceProvider[]> {
  try {
    const { data, error } = await supabase
      .from('service_providers')
      .select('*')
      .eq('user_id', userId)
      .order('is_preferred', { ascending: false });
    if (error) throw new Error(`Failed to fetch providers: ${error.message}`);
    return data || [];
  } catch (error: any) {
    console.error('Error in getServiceProviders:', error);
    throw error;
  }
}

export async function createServiceProvider(
  userId: string,
  data: Omit<ServiceProvider, 'provider_id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<ServiceProvider> {
  try {
    const { data: provider, error } = await supabase
      .from('service_providers')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(`Failed to create provider: ${error.message}`);
    return provider;
  } catch (error: any) {
    console.error('Error in createServiceProvider:', error);
    throw error;
  }
}

export async function deleteServiceProvider(providerId: string): Promise<void> {
  try {
    const { error } = await supabase.from('service_providers').delete().eq('provider_id', providerId);
    if (error) throw new Error(`Failed to delete provider: ${error.message}`);
  } catch (error: any) {
    console.error('Error in deleteServiceProvider:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export async function getMaintenanceBudget(
  userId: string,
  vehicleId?: string,
  period?: 'monthly' | 'annual'
): Promise<MaintenanceBudget | null> {
  try {
    let query = supabase.from('maintenance_budgets').select('*').eq('user_id', userId);
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    if (period) query = query.eq('period', period);

    const { data, error } = await query.limit(1).single();
    if (error && error.code !== 'PGRST116') throw new Error(`Failed to fetch budget: ${error.message}`);
    return data || null;
  } catch (error: any) {
    if (error.message?.includes('PGRST116')) return null;
    console.error('Error in getMaintenanceBudget:', error);
    throw error;
  }
}

export async function upsertMaintenanceBudget(
  userId: string,
  data: { vehicle_id?: string; period: 'monthly' | 'annual'; amount: number; alert_at_percent: number }
): Promise<MaintenanceBudget> {
  try {
    const { data: budget, error } = await supabase
      .from('maintenance_budgets')
      .upsert({ ...data, user_id: userId, updated_at: new Date().toISOString() }, {
        onConflict: 'user_id,vehicle_id,period',
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to upsert budget: ${error.message}`);
    return budget;
  } catch (error: any) {
    console.error('Error in upsertMaintenanceBudget:', error);
    throw error;
  }
}
