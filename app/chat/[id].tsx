import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import {
  addChatMessage,
  createChatSession,
  getChatMessages,
  getVehicleChatSessions,
} from '../../services/chat-service';
import { generateAIResponse } from '../../services/ai-service';
import { getVehicleById } from '../../services/vehicle-service';
import type { ChatMessage as StoredChatMessage, RAGSource } from '../../types/chat';
import { colors, radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  sources?: RAGSource[];
  isLoading?: boolean;
}

function initialAssistantMessage(vehicleName: string): Message {
  return {
    id: 'intro',
    text: `You are connected to ${vehicleName}. Ask about manuals, maintenance, diagnostics, and service planning.`,
    isUser: false,
    timestamp: new Date(),
  };
}

function mapStoredMessage(message: StoredChatMessage): Message {
  return {
    id: message.message_id,
    text: message.content,
    isUser: message.role === 'user',
    timestamp: new Date(message.created_at),
    sources: message.retrieval_context?.sources,
  };
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    id: string;
    make?: string;
    model?: string;
    year?: string;
  }>();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [vehicleName, setVehicleName] = useState('Vehicle Assistant');
  const [messages, setMessages] = useState<Message[]>([initialAssistantMessage('your vehicle')]);
  const [inputText, setInputText] = useState('');
  const [isResponding, setIsResponding] = useState(false);

  const routeId = String(params.id || '');
  const routeMake = params.make || '';
  const routeModel = params.model || '';
  const routeYear = params.year || '';
  const isManualThread = routeId.startsWith('manual-');

  const vehicleContext = useMemo(() => {
    if (routeMake && routeModel && routeYear) {
      return {
        make: routeMake,
        model: routeModel,
        year: routeYear,
      };
    }

    return {
      make: '',
      model: '',
      year: '',
    };
  }, [routeMake, routeModel, routeYear]);

  const syncHeaderName = useCallback((make: string, model: string, year: string) => {
    if (make && model && year) {
      setVehicleName(`${year} ${make} ${model}`);
      setMessages((prev) => {
        if (prev.length > 0 && prev[0].id === 'intro') {
          return [initialAssistantMessage(`${year} ${make} ${model}`), ...prev.slice(1)];
        }
        return prev;
      });
      return;
    }

    setVehicleName('Vehicle Assistant');
  }, []);

  useEffect(() => {
    let mounted = true;

    async function resolveVehicleContext() {
      if (!mounted) return;

      if (vehicleContext.make && vehicleContext.model && vehicleContext.year) {
        syncHeaderName(vehicleContext.make, vehicleContext.model, vehicleContext.year);
        return;
      }

      const userId = user?.user_id;
      if (!userId || isManualThread || !routeId) {
        syncHeaderName('', '', '');
        return;
      }

      try {
        const vehicle = await getVehicleById(routeId, userId);
        if (!mounted || !vehicle) return;
        syncHeaderName(vehicle.make, vehicle.model, String(vehicle.year));
      } catch {
        syncHeaderName('', '', '');
      }
    }

    resolveVehicleContext();
    return () => {
      mounted = false;
    };
  }, [user?.user_id, routeId, isManualThread, vehicleContext, syncHeaderName]);

  useEffect(() => {
    const userId = user?.user_id;
    const vehicleOrThreadId = routeId;
    if (!vehicleOrThreadId) return;
    let mounted = true;

    async function initSession() {
      const resolvedUserId = userId;
      if (!resolvedUserId) return;

      try {
        let sessionId: string | null = null;

        if (!isManualThread) {
          const existing = await getVehicleChatSessions(vehicleOrThreadId, resolvedUserId);
          if (existing[0]) {
            sessionId = existing[0].session_id;
          }
        }

        if (!sessionId) {
          const created = await createChatSession(
            resolvedUserId,
            isManualThread ? undefined : vehicleOrThreadId,
            'manual'
          );
          sessionId = created.session_id;
        }

        sessionIdRef.current = sessionId;

        if (!sessionId) return;
        const history = await getChatMessages(sessionId, resolvedUserId);
        if (!mounted) return;

        if (history.length > 0) {
          setMessages(history.map(mapStoredMessage));
        }
      } catch (error) {
        console.warn('Chat session init failed. Falling back to local-only mode.', error);
      }
    }

    initSession();
    return () => {
      mounted = false;
    };
  }, [user?.user_id, routeId, isManualThread]);

  const persistMessage = useCallback(
    async (role: 'user' | 'assistant', content: string) => {
      if (!sessionIdRef.current || !user?.user_id) return;
      try {
        await addChatMessage(sessionIdRef.current, user.user_id, role, content);
      } catch (error) {
        console.warn('Could not persist message:', error);
      }
    },
    [user?.user_id]
  );

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isResponding) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      isUser: true,
      timestamp: new Date(),
    };

    const loadingId = `loading-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: loadingId,
        text: '',
        isUser: false,
        timestamp: new Date(),
        isLoading: true,
      },
    ]);

    setInputText('');
    setIsResponding(true);
    persistMessage('user', text);

    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const response = await generateAIResponse({
        session_id: sessionIdRef.current || routeId || 'default',
        message: text,
        include_rag: true,
        context_type: 'manual',
        vehicle_year: parseInt(vehicleContext.year || '0', 10),
        vehicle_make: vehicleContext.make,
        vehicle_model: vehicleContext.model,
      } as any);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingId
            ? {
                ...message,
                text: response.content,
                isLoading: false,
                sources: response.sources,
              }
            : message
        )
      );

      persistMessage('assistant', response.content);
    } catch (error) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingId
            ? {
                ...message,
                text: 'I hit an error while generating a response. Please try again.',
                isLoading: false,
              }
            : message
        )
      );
    } finally {
      setIsResponding(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
    }
  };

  return (
    <AppShell routeKey="chat" title={vehicleName} subtitle="Gear AI Vehicle Assistant">
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatCard}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[styles.messageRow, message.isUser ? styles.userRow : styles.assistantRow]}
              >
                <View style={[styles.messageBubble, message.isUser ? styles.userBubble : styles.assistantBubble]}>
                  {message.isLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={colors.textPrimary} />
                      <Text style={styles.loadingText}>Searching manuals and references...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.messageText, message.isUser ? styles.userText : styles.assistantText]}>
                        {message.text}
                      </Text>

                      {!!message.sources?.length && (
                        <View style={styles.sourceWrap}>
                          {message.sources.map((source, index) => (
                            <View key={`${source.embedding_id}-${index}`} style={styles.sourcePill}>
                              <Ionicons name="book-outline" size={10} color={colors.brandAccent} />
                              <Text numberOfLines={1} style={styles.sourceText}>
                                {source.section_title || 'Manual'} {source.page_number ? `p.${source.page_number}` : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              style={styles.input}
              multiline
              editable={!isResponding}
              placeholder="Ask a vehicle question..."
              placeholderTextColor={colors.textSecondary}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleSend}
              disabled={isResponding}
              style={({ pressed }) => [
                styles.sendButton,
                pressed && styles.buttonInteraction,
                isResponding && styles.sendButtonDisabled,
              ]}
            >
              <Ionicons name="send" size={16} color={colors.background} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  chatCard: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(18, 26, 35, 0.75)',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 10,
  },
  messageRow: {
    flexDirection: 'row',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '86%',
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  userBubble: {
    backgroundColor: 'rgba(74, 163, 255, 0.22)',
    borderColor: colors.actionAccent,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  messageText: {
    fontSize: typeScale.sm,
    lineHeight: 20,
    fontFamily: fontFamilies.body,
  },
  userText: {
    color: colors.textPrimary,
  },
  assistantText: {
    color: colors.textPrimary,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  sourceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourcePill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 220,
  },
  sourceText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: 11,
  },
  inputRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.brandAccent,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  buttonInteraction: {
    opacity: 0.92,
  },
});
