import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import GearActionIcon from '../../components/branding/GearActionIcon';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../contexts/AuthContext';
import {
  addChatMessage,
  createChatSession,
  getChatMessages,
  getUserChatSessions,
  getVehicleChatSessions,
  updateChatSessionTitle,
} from '../../services/chat-service';
import {
  generateAIResponse,
  getProactiveSuggestions,
  parseMaintenanceFromText,
  analyzePrepurchaseVIN,
} from '../../services/ai-service';
import {
  analyzeVehiclePhoto,
  analyzeRepairDocument,
} from '../../services/ai-multimodal-service';
import { getVehicleById, getMileageLogs } from '../../services/vehicle-service';
import { getMaintenanceRecords, createMaintenanceRecord, getServiceReminders } from '../../services/maintenance-service';
import { getDiagnosticHistory } from '../../services/diagnostic-service';
import type {
  ChatMessage as StoredChatMessage,
  ChatSession,
  RAGSource,
  VehicleFullContext,
  ParsedMaintenanceLog,
} from '../../types/chat';
import { radii } from '../../theme/tokens';
import { fontFamilies, typeScale } from '../../theme/typography';
import { useTheme } from '../../contexts/ThemeContext';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  sources?: RAGSource[];
  isLoading?: boolean;
  /** Parsed maintenance log awaiting user confirmation (F5) */
  pendingMaintenanceLog?: ParsedMaintenanceLog;
  /** True if this message contains an analyzed photo (F2) */
  hasPhotoAnalysis?: boolean;
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

function formatSessionDate(iso?: string | null): string {
  if (!iso) return 'No messages yet';
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ChatScreen() {
  const { colors } = useTheme();
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
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  /** F1: Full vehicle context for enhanced AI calls */
  const vehicleFullContextRef = useRef<VehicleFullContext | null>(null);
  /** F1: Proactive suggestion chips */
  const [proactiveSuggestions, setProactiveSuggestions] = useState<string[]>([]);
  /** F2: Photo analysis in progress */
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  /** F6: Pre-purchase VIN input panel */
  const [showVinInput, setShowVinInput] = useState(false);
  const [prepurchaseVin, setPrepurchaseVin] = useState('');
  const [isAnalyzingVin, setIsAnalyzingVin] = useState(false);

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

        // F1: Load full context in parallel for enhanced AI responses
        const [maintenanceRecords, activeCodes, mileageLogs, serviceReminders] = await Promise.allSettled([
          getMaintenanceRecords(routeId, userId),
          getDiagnosticHistory(routeId),
          getMileageLogs(routeId, userId),
          getServiceReminders(routeId, userId),
        ]);

        const maintenance = maintenanceRecords.status === 'fulfilled' ? maintenanceRecords.value : [];
        const codes = activeCodes.status === 'fulfilled' ? activeCodes.value : [];
        const logs = mileageLogs.status === 'fulfilled' ? mileageLogs.value : [];
        const reminders = serviceReminders.status === 'fulfilled' ? serviceReminders.value : [];

        // Calculate 30-day mileage delta
        let monthlyDelta: number | undefined;
        if (logs.length >= 2) {
          const sorted = [...logs].sort((a, b) => new Date(b.logged_date).getTime() - new Date(a.logged_date).getTime());
          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const recent = sorted.filter((l) => new Date(l.logged_date).getTime() > cutoff);
          if (recent.length >= 2) {
            monthlyDelta = recent[0].mileage - recent[recent.length - 1].mileage;
          }
        }

        const fullCtx: VehicleFullContext = {
          vehicle_id: vehicle.vehicle_id,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim,
          vin: vehicle.vin || undefined,
          current_mileage: vehicle.current_mileage,
          monthly_mileage_delta: monthlyDelta,
          recent_maintenance: maintenance.slice(0, 10).map((r) => ({
            title: r.title,
            date: r.date,
            mileage: r.mileage,
            cost: r.cost,
            parts_replaced: r.parts_replaced,
          })),
          active_codes: codes
            .filter((c) => c.status === 'active' || c.status === 'pending')
            .map((c) => ({ code: c.code, description: c.description, severity: c.severity })),
          pending_services: reminders
            .filter((r) => r.status === 'upcoming' || r.status === 'due' || r.status === 'overdue')
            .map((r) => ({
              title: r.title,
              due_mileage: r.due_mileage,
              due_date: r.due_date,
              priority: r.priority,
            })),
        };

        if (!mounted) return;
        vehicleFullContextRef.current = fullCtx;

        // F1: Generate proactive suggestions
        const suggestions = await getProactiveSuggestions(fullCtx);
        if (mounted) setProactiveSuggestions(suggestions);
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
        setActiveSessionId(sessionId);

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

  const loadHistory = useCallback(async () => {
    const userId = user?.user_id;
    if (!userId) return;
    setIsLoadingHistory(true);
    try {
      const fetched = isManualThread
        ? await getUserChatSessions(userId, true)
        : await getVehicleChatSessions(routeId, userId);
      setSessions(fetched);
    } catch (e) {
      console.warn('Could not load chat history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.user_id, routeId, isManualThread]);

  const handleNewChat = useCallback(async () => {
    const userId = user?.user_id;
    if (!userId) return;
    try {
      const created = await createChatSession(
        userId,
        isManualThread ? undefined : routeId,
        'manual'
      );
      sessionIdRef.current = created.session_id;
      setActiveSessionId(created.session_id);
      setMessages([initialAssistantMessage(vehicleName)]);
      setView('chat');
      setSessions((prev) => [created, ...prev]);
    } catch (e) {
      console.warn('Failed to create new chat:', e);
    }
  }, [user?.user_id, routeId, isManualThread, vehicleName]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      const userId = user?.user_id;
      if (!userId) return;
      try {
        sessionIdRef.current = sessionId;
        setActiveSessionId(sessionId);
        const history = await getChatMessages(sessionId, userId);
        setMessages(history.length > 0 ? history.map(mapStoredMessage) : [initialAssistantMessage(vehicleName)]);
        setView('chat');
      } catch (e) {
        console.warn('Failed to load session:', e);
      }
    },
    [user?.user_id, vehicleName]
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

    // Auto-title session from first user message
    if (!messages.some((m) => m.isUser) && sessionIdRef.current && user?.user_id) {
      const autoTitle = text.length > 50 ? `${text.substring(0, 50)}...` : text;
      updateChatSessionTitle(sessionIdRef.current, user.user_id, autoTitle).catch(() => {});
      setSessions((prev) =>
        prev.map((s) => (s.session_id === sessionIdRef.current ? { ...s, title: autoTitle } : s))
      );
    }

    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      // F5: Check for maintenance logging intent in parallel with AI response
      const [response, parsedMaintenance] = await Promise.all([
        generateAIResponse({
          session_id: sessionIdRef.current || routeId || 'default',
          message: text,
          include_rag: true,
          context_type: 'manual',
          // F1: Pass full vehicle context if available
          vehicle_context: vehicleFullContextRef.current || undefined,
          // Legacy fallback
          vehicle_year: parseInt(vehicleContext.year || '0', 10),
          vehicle_make: vehicleContext.make,
          vehicle_model: vehicleContext.model,
        } as any),
        // F5: Only try to parse if the text sounds like a maintenance log entry
        isMaintenanceLogIntent(text)
          ? parseMaintenanceFromText(text, vehicleFullContextRef.current || undefined)
          : Promise.resolve(null),
      ]);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === loadingId
            ? {
                ...message,
                text: response.content,
                isLoading: false,
                sources: response.sources,
                // F5: Attach parsed log to message for confirmation card
                pendingMaintenanceLog: parsedMaintenance || undefined,
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

  /** F5: Heuristic to detect maintenance logging intent */
  function isMaintenanceLogIntent(text: string): boolean {
    const lower = text.toLowerCase();
    const logKeywords = ['i changed', 'i replaced', 'just changed', 'just replaced', 'i did', 'i had', 'got the', 'oil change', 'brake job', 'tire rotation', 'i spent', 'shop charged', 'i installed', 'put in', 'topped off'];
    return logKeywords.some((kw) => lower.includes(kw));
  }

  /** F2: Handle photo attachment — pick from library or camera */
  const handleAttachPhoto = useCallback(async (mode: 'camera' | 'library') => {
    const pickFn = mode === 'camera'
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await pickFn({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const base64 = asset.base64;
    const mimeType = (asset.mimeType as 'image/jpeg' | 'image/png' | 'image/webp') || 'image/jpeg';
    const label = asset.fileName || 'photo';

    if (!base64) return;

    // Determine analysis mode based on simple heuristic (could be made interactive)
    const isDocScan = inputText.toLowerCase().includes('estimate') || inputText.toLowerCase().includes('quote') || inputText.toLowerCase().includes('receipt');

    const userMsg: Message = {
      id: `user-photo-${Date.now()}`,
      text: isDocScan ? `📄 Analyzing repair document: ${label}` : `📷 Analyzing photo: ${label}`,
      isUser: true,
      timestamp: new Date(),
    };

    const loadingId = `loading-photo-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: loadingId, text: '', isUser: false, timestamp: new Date(), isLoading: true },
    ]);
    setIsAnalyzingPhoto(true);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const vehicleCtx = vehicleFullContextRef.current
        ? `${vehicleFullContextRef.current.year} ${vehicleFullContextRef.current.make} ${vehicleFullContextRef.current.model}`
        : undefined;

      let responseText = '';
      if (isDocScan) {
        const analysis = await analyzeRepairDocument(base64, mimeType, vehicleCtx);
        responseText = formatDocumentAnalysis(analysis);
      } else {
        const analysis = await analyzeVehiclePhoto(base64, mimeType, vehicleCtx);
        responseText = formatPhotoAnalysis(analysis);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, text: responseText, isLoading: false, hasPhotoAnalysis: true }
            : m
        )
      );
      persistMessage('assistant', responseText);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, text: 'Could not analyze the image. Please try again.', isLoading: false }
            : m
        )
      );
    } finally {
      setIsAnalyzingPhoto(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [inputText, persistMessage]);

  /** F6: Analyze a VIN for pre-purchase inspection */
  const handlePrepurchaseAnalysis = useCallback(async () => {
    const vin = prepurchaseVin.trim().toUpperCase();
    if (!vin || vin.length < 11) {
      Alert.alert('Invalid VIN', 'Please enter a valid 17-character VIN.');
      return;
    }

    setIsAnalyzingVin(true);
    setShowVinInput(false);

    const loadingId = `loading-vin-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `user-vin-${Date.now()}`, text: `🔍 Pre-purchase inspection for VIN: ${vin}`, isUser: true, timestamp: new Date() },
      { id: loadingId, text: '', isUser: false, timestamp: new Date(), isLoading: true },
    ]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const report = await analyzePrepurchaseVIN(vin);
      const responseText = formatPrepurchaseReport(report);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId ? { ...m, text: responseText, isLoading: false } : m
        )
      );
      persistMessage('assistant', responseText);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, text: 'Could not analyze this VIN. Please try again.', isLoading: false }
            : m
        )
      );
    } finally {
      setIsAnalyzingVin(false);
      setPrepurchaseVin('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [prepurchaseVin, persistMessage]);

  /** F5: Save a parsed maintenance log to the database */
  const handleSaveMaintenanceLog = useCallback(async (log: ParsedMaintenanceLog, messageId: string) => {
    const userId = user?.user_id;
    const vehicleId = vehicleFullContextRef.current?.vehicle_id || routeId;
    if (!userId || !vehicleId) return;

    try {
      await createMaintenanceRecord(vehicleId, userId, {
        type: log.type,
        date: log.date,
        title: log.title,
        mileage: log.mileage,
        cost: log.cost,
        parts_cost: log.parts_cost,
        labor_cost: log.labor_cost,
        parts_replaced: log.parts_replaced,
        shop_name: log.shop_name,
        description: log.description,
      });

      // Remove the pending log from the message so confirmation card disappears
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, pendingMaintenanceLog: undefined } : m
        )
      );

      // Add a confirmation message
      setMessages((prev) => [
        ...prev,
        {
          id: `system-log-saved-${Date.now()}`,
          text: `✅ Maintenance record saved: **${log.title}** on ${log.date}${log.mileage ? ` at ${log.mileage.toLocaleString()} miles` : ''}.`,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save the maintenance record. Please try again.');
    }
  }, [user?.user_id, routeId]);

  // ---------------------------------------------------------------------------
  // Formatting helpers for F2, F6
  // ---------------------------------------------------------------------------

  function formatPhotoAnalysis(a: import('../../services/ai-multimodal-service').PhotoAnalysisResult): string {
    const severity = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟠' : a.severity === 'caution' ? '🟡' : 'ℹ️';
    let out = `${severity} **Photo Analysis**\n\n${a.diagnosis}`;
    if (a.identified_items?.length) out += `\n\n**Identified:** ${a.identified_items.join(', ')}`;
    if (a.recommended_actions?.length) out += `\n\n**Actions:**\n${a.recommended_actions.map((x) => `• ${x}`).join('\n')}`;
    if (a.estimated_cost_range) out += `\n\n**Estimated cost:** ${a.estimated_cost_range}`;
    if (a.safe_to_drive !== null) out += `\n\n**Safe to drive:** ${a.safe_to_drive ? 'Yes ✅' : 'No — address immediately ⛔'}`;
    return out;
  }

  function formatDocumentAnalysis(a: import('../../services/ai-multimodal-service').RepairDocumentAnalysis): string {
    const badge = a.overall_assessment === 'overpriced' ? '🔴 Overpriced' : a.overall_assessment === 'slightly_high' ? '🟡 Slightly High' : '🟢 Fair';
    let out = `📄 **Repair Estimate Analysis** — ${badge}\n\n${a.summary}`;
    if (a.total_estimate != null) out += `\n\n**Total:** $${a.total_estimate.toFixed(2)}`;
    if (a.flagged_items?.length) out += `\n\n**⚠️ Flagged items:**\n${a.flagged_items.map((x) => `• ${x}`).join('\n')}`;
    if (a.negotiation_tips?.length) out += `\n\n**Negotiation tips:**\n${a.negotiation_tips.map((x) => `• ${x}`).join('\n')}`;
    return out;
  }

  function formatPrepurchaseReport(r: import('../../types/chat').PrepurchaseReport): string {
    const risk = r.overall_risk === 'high' ? '🔴 High Risk' : r.overall_risk === 'medium' ? '🟡 Medium Risk' : '🟢 Low Risk';
    let out = `🔍 **Pre-Purchase Report — ${r.vehicle}**\nRisk: ${risk}\n\n${r.summary}`;
    if (r.recalls?.length) out += `\n\n**⚠️ Open Recalls (${r.recalls.length}):**\n${r.recalls.map((rc) => `• ${rc.component}: ${rc.summary}`).join('\n')}`;
    if (r.common_issues?.length) out += `\n\n**Known Issues:**\n${r.common_issues.slice(0, 5).map((i) => `• [${i.severity.toUpperCase()}] ${i.issue}: ${i.description}`).join('\n')}`;
    if (r.inspection_checklist?.length) out += `\n\n**Inspection Checklist:**\n${r.inspection_checklist.slice(0, 6).map((c) => `• **${c.area}:** ${c.what_to_check}`).join('\n')}`;
    if (r.negotiation_tips?.length) out += `\n\n**Negotiation Tips:**\n${r.negotiation_tips.map((t) => `• ${t}`).join('\n')}`;
    return out;
  }

  const styles = makeStyles(colors);
  return (
    <AppShell routeKey="chat" title={vehicleName} subtitle="Gear AI Vehicle Assistant">
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.chatCard}>
          {/* Toolbar: History + New Chat */}
          <View style={styles.chatToolbar}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.toolbarBtn, pressed && styles.buttonInteraction]}
              onPress={() => {
                loadHistory();
                setView('history');
              }}
            >
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.toolbarBtnLabel}>History</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.toolbarBtn, styles.toolbarBtnAccent, pressed && styles.buttonInteraction]}
              onPress={handleNewChat}
            >
              <Ionicons name="create-outline" size={16} color={colors.brandAccent} />
              <Text style={[styles.toolbarBtnLabel, styles.toolbarBtnLabelAccent]}>New Chat</Text>
            </Pressable>
          </View>

          {view === 'history' ? (
            /* ── History Panel ── */
            <View style={styles.historyPanel}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.historyBack, pressed && styles.buttonInteraction]}
                onPress={() => setView('chat')}
              >
                <Ionicons name="arrow-back-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.historyBackLabel}>Back to Chat</Text>
              </Pressable>

              {isLoadingHistory ? (
                <ActivityIndicator color={colors.brandAccent} style={{ marginTop: 32 }} />
              ) : sessions.length === 0 ? (
                <Text style={styles.emptyHistory}>No previous conversations found.</Text>
              ) : (
                <ScrollView
                  style={styles.sessionList}
                  contentContainerStyle={styles.sessionListContent}
                  showsVerticalScrollIndicator={false}
                >
                  {sessions.map((session) => {
                    const isActive = session.session_id === activeSessionId;
                    return (
                      <Pressable
                        key={session.session_id}
                        accessibilityRole="button"
                        onPress={() => handleSelectSession(session.session_id)}
                        style={({ pressed }) => [
                          styles.sessionItem,
                          isActive && styles.sessionItemActive,
                          pressed && styles.buttonInteraction,
                        ]}
                      >
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={16}
                          color={isActive ? colors.brandAccent : colors.actionAccent}
                        />
                        <View style={styles.sessionCopy}>
                          <Text style={styles.sessionTitle} numberOfLines={1}>
                            {session.title || 'Chat session'}
                          </Text>
                          <Text style={styles.sessionMeta}>
                            {formatSessionDate(session.last_message_at)} · {session.message_count}{' '}
                            msg{session.message_count !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        {isActive && <View style={styles.activeDot} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            /* ── Chat View ── */
            <>
              {/* F1: Proactive suggestion chips */}
              {proactiveSuggestions.length > 0 && !messages.some((m) => m.isUser) && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.suggestionsScroll}
                  contentContainerStyle={styles.suggestionsContent}
                >
                  {proactiveSuggestions.map((s, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [styles.suggestionChip, pressed && styles.buttonInteraction]}
                      onPress={() => setInputText(s)}
                    >
                      <Text style={styles.suggestionText} numberOfLines={2}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* F6: Pre-purchase VIN input panel */}
              {showVinInput && (
                <View style={styles.vinPanel}>
                  <Text style={styles.vinPanelTitle}>🔍 Pre-Purchase VIN Lookup</Text>
                  <TextInput
                    value={prepurchaseVin}
                    onChangeText={setPrepurchaseVin}
                    style={styles.vinInput}
                    placeholder="Enter 17-character VIN"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="characters"
                    maxLength={17}
                  />
                  <View style={styles.vinButtons}>
                    <Pressable style={styles.vinCancelBtn} onPress={() => setShowVinInput(false)}>
                      <Text style={styles.vinCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.vinAnalyzeBtn, isAnalyzingVin && styles.sendButtonDisabled]}
                      onPress={handlePrepurchaseAnalysis}
                      disabled={isAnalyzingVin}
                    >
                      {isAnalyzingVin
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.vinAnalyzeText}>Analyze</Text>
                      }
                    </Pressable>
                  </View>
                </View>
              )}

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
                          <Text style={styles.loadingText}>
                            {isAnalyzingPhoto ? 'Analyzing image...' : 'Searching manuals and references...'}
                          </Text>
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

                          {/* F5: Maintenance log confirmation card */}
                          {!!message.pendingMaintenanceLog && (
                            <View style={styles.maintenanceCard}>
                              <Text style={styles.maintenanceCardTitle}>💾 Save to Maintenance Log?</Text>
                              <Text style={styles.maintenanceCardDetail}>
                                {message.pendingMaintenanceLog.title} · {message.pendingMaintenanceLog.date}
                                {message.pendingMaintenanceLog.mileage ? ` · ${message.pendingMaintenanceLog.mileage.toLocaleString()} mi` : ''}
                                {message.pendingMaintenanceLog.cost ? ` · $${message.pendingMaintenanceLog.cost}` : ''}
                              </Text>
                              <View style={styles.maintenanceCardButtons}>
                                <Pressable
                                  style={styles.maintenanceDismissBtn}
                                  onPress={() => setMessages((prev) =>
                                    prev.map((m) => m.id === message.id ? { ...m, pendingMaintenanceLog: undefined } : m)
                                  )}
                                >
                                  <Text style={styles.maintenanceDismissText}>Dismiss</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.maintenanceSaveBtn}
                                  onPress={() => handleSaveMaintenanceLog(message.pendingMaintenanceLog!, message.id)}
                                >
                                  <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                                  <Text style={styles.maintenanceSaveText}>Save Record</Text>
                                </Pressable>
                              </View>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.inputRow}>
                {/* F2: Photo attachment button */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    Alert.alert('Attach Photo', 'Choose source', [
                      { text: 'Camera', onPress: () => handleAttachPhoto('camera') },
                      { text: 'Photo Library', onPress: () => handleAttachPhoto('library') },
                      { text: 'Cancel', style: 'cancel' },
                    ])
                  }
                  disabled={isResponding || isAnalyzingPhoto}
                  style={({ pressed }) => [styles.attachButton, pressed && styles.buttonInteraction]}
                >
                  <Ionicons name="camera-outline" size={20} color={colors.textSecondary} />
                </Pressable>

                {/* F6: Pre-purchase VIN lookup button */}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowVinInput((v) => !v)}
                  style={({ pressed }) => [styles.attachButton, pressed && styles.buttonInteraction]}
                >
                  <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                </Pressable>

                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  style={styles.input}
                  multiline
                  editable={!isResponding}
                  placeholder="Ask a vehicle question..."
                  placeholderTextColor={colors.textSecondary}
                  onKeyPress={(e: any) => {
                    const { key, metaKey, ctrlKey } = e.nativeEvent;
                    if (key === 'Enter' && (metaKey || ctrlKey)) {
                      e.preventDefault?.();
                      handleSend();
                    }
                  }}
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
                  <GearActionIcon size="sm" />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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
  chatToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  toolbarBtnAccent: {
    borderColor: colors.brandAccent,
    backgroundColor: 'rgba(51, 214, 210, 0.10)',
  },
  toolbarBtnLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  toolbarBtnLabelAccent: {
    color: colors.brandAccent,
  },
  historyPanel: {
    flex: 1,
    backgroundColor: 'rgba(18, 26, 35, 0.75)',
  },
  historyBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyBackLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  emptyHistory: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },
  sessionList: {
    flex: 1,
  },
  sessionListContent: {
    padding: 12,
    gap: 8,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sessionItemActive: {
    borderColor: colors.brandAccent,
    backgroundColor: 'rgba(51, 214, 210, 0.10)',
  },
  sessionCopy: {
    flex: 1,
    gap: 3,
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  sessionMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandAccent,
  },
  // F1: Proactive suggestion chips
  suggestionsScroll: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    maxHeight: 72,
  },
  suggestionsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: colors.brandAccent,
    borderRadius: radii.full,
    backgroundColor: 'rgba(51, 214, 210, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 240,
  },
  suggestionText: {
    color: colors.brandAccent,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  // F2: Photo attachment button
  attachButton: {
    width: 38,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  // F5: Maintenance log confirmation card
  maintenanceCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.brandAccent,
    borderRadius: radii.md,
    backgroundColor: 'rgba(51, 214, 210, 0.08)',
    padding: 12,
    gap: 8,
  },
  maintenanceCardTitle: {
    color: colors.brandAccent,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
    fontWeight: '600',
  },
  maintenanceCardDetail: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  maintenanceCardButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  maintenanceDismissBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  maintenanceDismissText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
  },
  maintenanceSaveBtn: {
    flex: 2,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: colors.brandAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  maintenanceSaveText: {
    color: '#fff',
    fontFamily: fontFamilies.body,
    fontSize: typeScale.xs,
    fontWeight: '600',
  },
  // F6: Pre-purchase VIN panel
  vinPanel: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
  },
  vinPanelTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
    fontWeight: '600',
  },
  vinInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  vinButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  vinCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  vinCancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
  },
  vinAnalyzeBtn: {
    flex: 2,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.brandAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinAnalyzeText: {
    color: '#fff',
    fontFamily: fontFamilies.body,
    fontSize: typeScale.sm,
    fontWeight: '600',
  },
});
}
