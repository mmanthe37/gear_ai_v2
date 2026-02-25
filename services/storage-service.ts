/**
 * Gear AI CoPilot - Storage Service
 * 
 * Handles file uploads and management with Supabase Storage
 */

import { supabase } from '../lib/supabase';
import { MAX_FILE_SIZE_BYTES } from './constants';

/**
 * Storage bucket names
 */
export const STORAGE_BUCKETS = {
  VEHICLE_PHOTOS: 'vehicle-photos',
  MAINTENANCE_RECEIPTS: 'maintenance-receipts',
  PROFILE_AVATARS: 'profile-avatars',
  MANUALS: 'manuals',
} as const;

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: {
    cacheControl?: string;
    contentType?: string;
    upsert?: boolean;
  }
): Promise<{ url: string; path: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: options?.cacheControl || '3600',
        contentType: options?.contentType,
        upsert: options?.upsert || false,
      });

    if (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    console.log('✅ File uploaded:', data.path);
    return {
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error: any) {
    console.error('Error in uploadFile:', error);
    throw error;
  }
}

/**
 * Upload vehicle photo
 */
export async function uploadVehiclePhoto(
  userId: string,
  vehicleId: string,
  file: File | Blob,
  filename?: string
): Promise<{ url: string; path: string }> {
  try {
    const ext = filename?.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const path = `${userId}/${vehicleId}/${timestamp}.${ext}`;

    return await uploadFile(STORAGE_BUCKETS.VEHICLE_PHOTOS, path, file, {
      contentType: `image/${ext}`,
      upsert: true,
    });
  } catch (error: any) {
    console.error('Error in uploadVehiclePhoto:', error);
    throw error;
  }
}

/**
 * Upload maintenance receipt/photo
 */
export async function uploadMaintenanceReceipt(
  userId: string,
  vehicleId: string,
  recordId: string,
  file: File | Blob,
  filename?: string
): Promise<{ url: string; path: string }> {
  try {
    const ext = filename?.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const path = `${userId}/${vehicleId}/${recordId}/${timestamp}.${ext}`;

    return await uploadFile(STORAGE_BUCKETS.MAINTENANCE_RECEIPTS, path, file, {
      contentType: `image/${ext}`,
      upsert: false,
    });
  } catch (error: any) {
    console.error('Error in uploadMaintenanceReceipt:', error);
    throw error;
  }
}

/**
 * Upload user profile avatar
 */
export async function uploadProfileAvatar(
  userId: string,
  file: File | Blob,
  filename?: string
): Promise<{ url: string; path: string }> {
  try {
    const ext = filename?.split('.').pop() || 'jpg';
    const path = `${userId}/avatar.${ext}`;

    return await uploadFile(STORAGE_BUCKETS.PROFILE_AVATARS, path, file, {
      contentType: `image/${ext}`,
      upsert: true, // Replace existing avatar
    });
  } catch (error: any) {
    console.error('Error in uploadProfileAvatar:', error);
    throw error;
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }

    console.log('✅ File deleted:', path);
  } catch (error: any) {
    console.error('Error in deleteFile:', error);
    throw error;
  }
}

/**
 * Delete vehicle photo
 */
export async function deleteVehiclePhoto(path: string): Promise<void> {
  return deleteFile(STORAGE_BUCKETS.VEHICLE_PHOTOS, path);
}

/**
 * Delete maintenance receipt
 */
export async function deleteMaintenanceReceipt(path: string): Promise<void> {
  return deleteFile(STORAGE_BUCKETS.MAINTENANCE_RECEIPTS, path);
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * List files in a directory
 */
export async function listFiles(
  bucket: string,
  path: string
): Promise<Array<{ name: string; id: string; updated_at: string; size: number }>> {
  try {
    const { data, error } = await supabase.storage.from(bucket).list(path);

    if (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return (data || []).map(file => ({
      name: file.name,
      id: file.id || '',
      updated_at: file.updated_at || '',
      size: file.metadata?.size || 0
    }));
  } catch (error: any) {
    console.error('Error in listFiles:', error);
    throw error;
  }
}

/**
 * Get all vehicle photos for a vehicle
 */
export async function getVehiclePhotos(
  userId: string,
  vehicleId: string
): Promise<Array<{ url: string; path: string; size: number; updated_at: string }>> {
  try {
    const path = `${userId}/${vehicleId}`;
    const files = await listFiles(STORAGE_BUCKETS.VEHICLE_PHOTOS, path);

    return files.map((file) => ({
      url: getPublicUrl(STORAGE_BUCKETS.VEHICLE_PHOTOS, `${path}/${file.name}`),
      path: `${path}/${file.name}`,
      size: file.size,
      updated_at: file.updated_at,
    }));
  } catch (error: any) {
    console.error('Error in getVehiclePhotos:', error);
    return [];
  }
}

/**
 * Get maintenance receipts for a record
 */
export async function getMaintenanceReceipts(
  userId: string,
  vehicleId: string,
  recordId: string
): Promise<Array<{ url: string; path: string; size: number; updated_at: string }>> {
  try {
    const path = `${userId}/${vehicleId}/${recordId}`;
    const files = await listFiles(STORAGE_BUCKETS.MAINTENANCE_RECEIPTS, path);

    return files.map((file) => ({
      url: getPublicUrl(STORAGE_BUCKETS.MAINTENANCE_RECEIPTS, `${path}/${file.name}`),
      path: `${path}/${file.name}`,
      size: file.size,
      updated_at: file.updated_at,
    }));
  } catch (error: any) {
    console.error('Error in getMaintenanceReceipts:', error);
    return [];
  }
}

/**
 * Create storage buckets (for initialization)
 * This should be run during setup/deployment
 */
export async function initializeStorageBuckets(): Promise<void> {
  const buckets = [
    { name: STORAGE_BUCKETS.VEHICLE_PHOTOS, public: true },
    { name: STORAGE_BUCKETS.MAINTENANCE_RECEIPTS, public: false },
    { name: STORAGE_BUCKETS.PROFILE_AVATARS, public: true },
    { name: STORAGE_BUCKETS.MANUALS, public: false },
  ];

  for (const bucket of buckets) {
    try {
      // Check if bucket exists
      const { data: existing } = await supabase.storage.getBucket(bucket.name);

      if (!existing) {
        // Create bucket
        const { error } = await supabase.storage.createBucket(bucket.name, {
          public: bucket.public,
          fileSizeLimit: MAX_FILE_SIZE_BYTES,
        });

        if (error) {
          console.error(`Error creating bucket ${bucket.name}:`, error);
        } else {
          console.log(`✅ Bucket created: ${bucket.name}`);
        }
      } else {
        console.log(`✅ Bucket already exists: ${bucket.name}`);
      }
    } catch (error) {
      console.error(`Error initializing bucket ${bucket.name}:`, error);
    }
  }
}
