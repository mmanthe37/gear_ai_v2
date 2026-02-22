/**
 * Gear AI CoPilot - Chat Service
 * 
 * Manages chat sessions and message persistence
 */

import { supabase } from '../lib/supabase';
import { ChatSession, ChatMessage, RetrievalContext } from '../types/chat';

/**
 * Create a new chat session
 */
export async function createChatSession(
  userId: string,
  vehicleId?: string,
  contextType?: ChatSession['context_type']
): Promise<ChatSession> {
  try {
    const newSession = {
      user_id: userId,
      vehicle_id: vehicleId,
      context_type: contextType || 'general',
      title: null,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(newSession)
      .select()
      .single();

    if (error) {
      console.error('Error creating chat session:', error);
      throw new Error(`Failed to create chat session: ${error.message}`);
    }

    console.log('✅ Chat session created:', data.session_id);
    return data;
  } catch (error: any) {
    console.error('Error in createChatSession:', error);
    throw error;
  }
}

/**
 * Get a chat session by ID
 */
export async function getChatSession(
  sessionId: string,
  userId: string
): Promise<ChatSession | null> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching chat session:', error);
      throw new Error(`Failed to fetch chat session: ${error.message}`);
    }

    return data;
  } catch (error: any) {
    console.error('Error in getChatSession:', error);
    throw error;
  }
}

/**
 * Get all chat sessions for a user
 */
export async function getUserChatSessions(
  userId: string,
  includeInactive: boolean = false
): Promise<ChatSession[]> {
  try {
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    query = query.order('last_message_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching chat sessions:', error);
      throw new Error(`Failed to fetch chat sessions: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getUserChatSessions:', error);
    throw error;
  }
}

/**
 * Get chat sessions for a specific vehicle
 */
export async function getVehicleChatSessions(
  vehicleId: string,
  userId: string
): Promise<ChatSession[]> {
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching vehicle chat sessions:', error);
      throw new Error(`Failed to fetch vehicle chat sessions: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getVehicleChatSessions:', error);
    throw error;
  }
}

/**
 * Update chat session title
 */
export async function updateChatSessionTitle(
  sessionId: string,
  userId: string,
  title: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ title })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating chat session title:', error);
      throw new Error(`Failed to update chat session title: ${error.message}`);
    }

    console.log('✅ Chat session title updated:', sessionId);
  } catch (error: any) {
    console.error('Error in updateChatSessionTitle:', error);
    throw error;
  }
}

/**
 * Mark chat session as inactive
 */
export async function archiveChatSession(
  sessionId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ is_active: false })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error archiving chat session:', error);
      throw new Error(`Failed to archive chat session: ${error.message}`);
    }

    console.log('✅ Chat session archived:', sessionId);
  } catch (error: any) {
    console.error('Error in archiveChatSession:', error);
    throw error;
  }
}

/**
 * Delete a chat session and all its messages
 */
export async function deleteChatSession(
  sessionId: string,
  userId: string
): Promise<void> {
  try {
    // Verify ownership
    const session = await getChatSession(sessionId, userId);
    if (!session) {
      throw new Error('Chat session not found or access denied');
    }

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting chat session:', error);
      throw new Error(`Failed to delete chat session: ${error.message}`);
    }

    console.log('✅ Chat session deleted:', sessionId);
  } catch (error: any) {
    console.error('Error in deleteChatSession:', error);
    throw error;
  }
}

/**
 * Add a message to a chat session
 */
export async function addChatMessage(
  sessionId: string,
  userId: string,
  role: ChatMessage['role'],
  content: string,
  options?: {
    tokensUsed?: number;
    modelVersion?: string;
    retrievalContext?: RetrievalContext;
  }
): Promise<ChatMessage> {
  try {
    // Verify session ownership
    const session = await getChatSession(sessionId, userId);
    if (!session) {
      throw new Error('Chat session not found or access denied');
    }

    const newMessage = {
      session_id: sessionId,
      role,
      content,
      tokens_used: options?.tokensUsed,
      model_version: options?.modelVersion,
      retrieval_context: options?.retrievalContext,
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(newMessage)
      .select()
      .single();

    if (error) {
      console.error('Error adding chat message:', error);
      throw new Error(`Failed to add chat message: ${error.message}`);
    }

    // Update session metadata
    await supabase
      .from('chat_sessions')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: session.message_count + 1,
      })
      .eq('session_id', sessionId);

    console.log('✅ Chat message added:', data.message_id);
    return data;
  } catch (error: any) {
    console.error('Error in addChatMessage:', error);
    throw error;
  }
}

/**
 * Get all messages for a chat session
 */
export async function getChatMessages(
  sessionId: string,
  userId: string
): Promise<ChatMessage[]> {
  try {
    // Verify session ownership
    const session = await getChatSession(sessionId, userId);
    if (!session) {
      throw new Error('Chat session not found or access denied');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching chat messages:', error);
      throw new Error(`Failed to fetch chat messages: ${error.message}`);
    }

    return data || [];
  } catch (error: any) {
    console.error('Error in getChatMessages:', error);
    throw error;
  }
}

/**
 * Get recent messages (for context in AI requests)
 */
export async function getRecentChatMessages(
  sessionId: string,
  userId: string,
  limit: number = 10
): Promise<ChatMessage[]> {
  try {
    // Verify session ownership
    const session = await getChatSession(sessionId, userId);
    if (!session) {
      throw new Error('Chat session not found or access denied');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent chat messages:', error);
      throw new Error(`Failed to fetch recent chat messages: ${error.message}`);
    }

    // Reverse to get chronological order
    return (data || []).reverse();
  } catch (error: any) {
    console.error('Error in getRecentChatMessages:', error);
    throw error;
  }
}

/**
 * Delete a specific message
 */
export async function deleteChatMessage(
  messageId: string,
  userId: string
): Promise<void> {
  try {
    // Verify ownership through session
    const { data: message, error: fetchError } = await supabase
      .from('chat_messages')
      .select(`
        *,
        chat_sessions!inner (
          user_id
        )
      `)
      .eq('message_id', messageId)
      .single();

    if (fetchError || !message) {
      throw new Error('Message not found');
    }

    if ((message as any).chat_sessions.user_id !== userId) {
      throw new Error('Access denied');
    }

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('message_id', messageId);

    if (error) {
      console.error('Error deleting chat message:', error);
      throw new Error(`Failed to delete chat message: ${error.message}`);
    }

    // Update message count in chat session
    // Note: This requires a Supabase RPC function 'decrement_message_count'
    // to be created in the database. See supabase/migrations for implementation.
    await supabase.rpc('decrement_message_count', {
      p_session_id: (message as any).session_id,
    });

    console.log('✅ Chat message deleted:', messageId);
  } catch (error: any) {
    console.error('Error in deleteChatMessage:', error);
    throw error;
  }
}

/**
 * Get total token usage for a user
 */
export async function getUserTokenUsage(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<{ totalTokens: number; messageCount: number }> {
  try {
    let query = supabase
      .from('chat_messages')
      .select(`
        tokens_used,
        chat_sessions!inner (
          user_id
        )
      `)
      .eq('chat_sessions.user_id', userId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching token usage:', error);
      throw new Error(`Failed to fetch token usage: ${error.message}`);
    }

    const totalTokens = (data || []).reduce(
      (sum, msg) => sum + (msg.tokens_used || 0),
      0
    );

    return {
      totalTokens,
      messageCount: data?.length || 0,
    };
  } catch (error: any) {
    console.error('Error in getUserTokenUsage:', error);
    throw error;
  }
}

/**
 * Generate a title for a chat session based on first message
 */
export async function generateSessionTitle(
  sessionId: string,
  userId: string
): Promise<string> {
  try {
    const messages = await getChatMessages(sessionId, userId);

    if (messages.length === 0) {
      return 'New Chat';
    }

    // Get first user message
    const firstUserMessage = messages.find((m) => m.role === 'user');

    if (!firstUserMessage) {
      return 'New Chat';
    }

    // Create a title from the first 50 characters
    const title = firstUserMessage.content.substring(0, 50);
    return title.length < firstUserMessage.content.length ? `${title}...` : title;
  } catch (error: any) {
    console.error('Error in generateSessionTitle:', error);
    return 'New Chat';
  }
}
