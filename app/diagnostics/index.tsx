import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppShell from '../../components/layout/AppShell';
import GearActionIcon from '../../components/branding/GearActionIcon';
import GearLogo from '../../components/branding/GearLogo';
import ModernDiagnosticCard from '../../components/ModernDiagnosticCard';
import { useAuth } from '../../contexts/AuthContext';
import {
  analyzeDTC,
  calculateHealthScore,
  checkSymptoms,
  clearDTCCodes,
  connectOBDAdapter,
  getDiagnosticHistory,
  getLatestHealthScore,
  readDTCCodes,
  readFreezeFrame,
  resolveDiagnosticCode,
  saveDiagnosticCode,
  startLiveDataStream,
  updateCodeWithAIAnalysis,
} from '../../services/diagnostic-service';
import { acknowledgeRecall, getRecallAlerts, lookupTSBs } from '../../services/recall-service';
import { getUserVehicles } from '../../services/vehicle-service';
import type {
  DiagnosticCode,
  DTCAnalysis,
  LiveOBDData,
  OBDSessionState,
  RecallAlert,
  SymptomCheck,
  TSBResult,
  VehicleHealthScore,
} from '../../types/diagnostic';
import type { Vehicle } from '../../types/vehicle';
import HealthScoreGauge from '../../components/diagnostics/HealthScoreGauge';
import LiveDataGrid from '../../components/diagnostics/LiveDataGrid';
import SymptomCheckerPanel from '../../components/diagnostics/SymptomCheckerPanel';
import RecallAlertsPanel from '../../components/diagnostics/RecallAlertsPanel';
import DTCCodeCard from '../../components/diagnostics/DTCCodeCard';
import { sp, touchMinHeight, pressedOpacity } from '../../theme/spacing';
import { typeScale, fontFamilies, fontWeights, letterSpacings } from '../../theme/typography';
import { elevation, radii } from '../../theme/tokens';
import { useTheme } from '../../contexts/ThemeContext';

type Tab = 'overview' | 'codes' | 'live' | 'symptoms' | 'recalls';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'codes', label: 'Codes' },
  { key: 'live', label: 'Live Data' },
  { key: 'symptoms', label: 'Symptom Check' },
  { key: 'recalls', label: 'Recalls' },
];

// ============================================================================
// Main Screen
// ============================================================================

export default function DiagnosticsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Codes tab
  const [codes, setCodes] = useState<DiagnosticCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeFilter, setCodeFilter] = useState<'all' | 'active' | 'resolved'>('active');

  // Live data tab
  const [obdState, setObdState] = useState<OBDSessionState>({ status: 'disconnected' });
  const [liveData, setLiveData] = useState<LiveOBDData | undefined>(undefined);
  const [scanning, setScanning] = useState(false);
  const stopStreamRef = useRef<(() => void) | null>(null);

  // Recalls tab
  const [recalls, setRecalls] = useState<RecallAlert[]>([]);
  const [tsbs, setTsbs] = useState<TSBResult[]>([]);
  const [recallsLoading, setRecallsLoading] = useState(false);

  // Health score
  const [healthScore, setHealthScore] = useState<VehicleHealthScore | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Initial load
  // -------------------------------------------------------------------------

  const loadVehicles = useCallback(async () => {
    if (!user?.user_id) return;
    setLoadError(null);
    try {
      const rows = await getUserVehicles(user.user_id);
      setVehicles(rows);
      if (rows.length > 0) {
        setSelectedVehicle((prev) => prev ?? rows[0]);
      }
    } catch (err) {
      console.warn('[Diagnostics] loadVehicles error:', err);
      setLoadError((err as Error)?.message || 'Failed to load vehicles.');
    }
  }, [user?.user_id]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  // -------------------------------------------------------------------------
  // Code history
  // -------------------------------------------------------------------------

  const loadCodeHistory = useCallback(async () => {
    if (!selectedVehicle) return;
    setCodesLoading(true);
    try {
      const rows = await getDiagnosticHistory(selectedVehicle.vehicle_id);
      setCodes(rows);
    } catch (err) {
      console.warn('[Diagnostics] loadCodeHistory error:', err);
    } finally {
      setCodesLoading(false);
    }
  }, [selectedVehicle]);

  // -------------------------------------------------------------------------
  // Health score
  // -------------------------------------------------------------------------

  const loadHealthScore = useCallback(async () => {
    if (!selectedVehicle || !user?.user_id) return;
    setHealthLoading(true);
    try {
      // Try to get cached score first
      let score = await getLatestHealthScore(selectedVehicle.vehicle_id);
      if (!score) {
        // Calculate fresh
        score = await calculateHealthScore(
          selectedVehicle.vehicle_id,
          user.user_id,
          selectedVehicle.current_mileage || 0,
          selectedVehicle.year
        );
      }
      setHealthScore(score);
    } catch (err) {
      console.warn('[Diagnostics] loadHealthScore error:', err);
    } finally {
      setHealthLoading(false);
    }
  }, [selectedVehicle, user?.user_id]);

  // -------------------------------------------------------------------------
  // Recalls & TSBs
  // -------------------------------------------------------------------------

  const loadRecalls = useCallback(async () => {
    if (!selectedVehicle) return;
    setRecallsLoading(true);
    try {
      const [recallData, tsbData] = await Promise.all([
        getRecallAlerts(
          selectedVehicle.vehicle_id,
          selectedVehicle.make,
          selectedVehicle.model,
          selectedVehicle.year
        ),
        lookupTSBs(selectedVehicle.make, selectedVehicle.model, selectedVehicle.year),
      ]);
      setRecalls(recallData);
      setTsbs(tsbData);
    } catch (err) {
      console.warn('[Diagnostics] loadRecalls error:', err);
    } finally {
      setRecallsLoading(false);
    }
  }, [selectedVehicle]);

  useEffect(() => {
    if (selectedVehicle) {
      void loadCodeHistory();
      void loadHealthScore();
    }
  }, [selectedVehicle, loadCodeHistory, loadHealthScore]);

  useEffect(() => {
    if (selectedVehicle && tab === 'recalls') {
      void loadRecalls();
    }
  }, [selectedVehicle, tab, loadRecalls]);

  // -------------------------------------------------------------------------
  // OBD-II connection
  // -------------------------------------------------------------------------

  async function handleConnectOBD() {
    if (obdState.status === 'connected') {
      // Disconnect
      stopStreamRef.current?.();
      stopStreamRef.current = null;
      setObdState({ status: 'disconnected' });
      setLiveData(undefined);
      return;
    }
    setScanning(true);
    setObdState({ status: 'scanning' });
    try {
      const session = await connectOBDAdapter();
      setObdState(session);
      if (session.status === 'connected') {
        const stop = startLiveDataStream((data) => setLiveData(data));
        stopStreamRef.current = stop;
      }
    } catch (err) {
      setObdState({ status: 'error', error_message: 'Could not connect to adapter' });
    } finally {
      setScanning(false);
    }
  }

  async function handleReadCodes() {
    if (!selectedVehicle || !user?.user_id) return;
    setCodesLoading(true);
    try {
      const codeList = await readDTCCodes();
      for (const code of codeList) {
        const ff = await readFreezeFrame(code);
        const desc = (await analyzeDTC(selectedVehicle.vin || '', code, selectedVehicle.current_mileage || 0)).description;
        await saveDiagnosticCode(
          selectedVehicle.vehicle_id,
          user.user_id,
          code,
          desc,
          'medium',
          selectedVehicle.current_mileage,
          ff
        );
      }
      await loadCodeHistory();
    } finally {
      setCodesLoading(false);
    }
  }

  async function handleClearCodes() {
    await clearDTCCodes();
    await loadCodeHistory();
  }

  // -------------------------------------------------------------------------
  // Code analysis
  // -------------------------------------------------------------------------

  async function handleAnalyzeCode(code: DiagnosticCode): Promise<DTCAnalysis | null> {
    if (!selectedVehicle) return null;
    const vehicleCtx = `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`;
    const analysis = await analyzeDTC(
      selectedVehicle.vin || '',
      code.code,
      code.mileage_at_detection || selectedVehicle.current_mileage || 0,
      vehicleCtx
    );
    await updateCodeWithAIAnalysis(code.diagnostic_id, analysis);
    return analysis;
  }

  async function handleResolveCode(diagnosticId: string) {
    await resolveDiagnosticCode(diagnosticId);
    await loadCodeHistory();
  }

  // -------------------------------------------------------------------------
  // Symptom check
  // -------------------------------------------------------------------------

  async function handleSymptomCheck(symptomText: string): Promise<SymptomCheck | null> {
    if (!selectedVehicle || !user?.user_id) return null;
    return checkSymptoms(
      symptomText,
      {
        year: selectedVehicle.year,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        trim: selectedVehicle.trim,
        mileage: selectedVehicle.current_mileage,
      },
      selectedVehicle.vehicle_id,
      user.user_id
    );
  }

  // -------------------------------------------------------------------------
  // Recall acknowledgment
  // -------------------------------------------------------------------------

  async function handleAcknowledgeRecall(campaignId: string) {
    if (!selectedVehicle || !user?.user_id) return;
    await acknowledgeRecall(selectedVehicle.vehicle_id, user.user_id, campaignId);
    setRecalls((prev) => prev.map((r) =>
      r.nhtsa_campaign === campaignId ? { ...r, acknowledged: true, acknowledged_at: new Date().toISOString() } : r
    ));
  }

  // -------------------------------------------------------------------------
  // Refresh all
  // -------------------------------------------------------------------------

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadCodeHistory(), loadHealthScore()]);
    if (tab === 'recalls') await loadRecalls();
    setRefreshing(false);
  }

  // -------------------------------------------------------------------------
  // Recalculate health score
  // -------------------------------------------------------------------------

  async function handleRecalcHealth() {
    if (!selectedVehicle || !user?.user_id) return;
    setHealthLoading(true);
    try {
      const score = await calculateHealthScore(
        selectedVehicle.vehicle_id,
        user.user_id,
        selectedVehicle.current_mileage || 0,
        selectedVehicle.year
      );
      setHealthScore(score);
    } finally {
      setHealthLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Filtered codes
  // -------------------------------------------------------------------------

  const filteredCodes = codeFilter === 'all'
    ? codes
    : codes.filter((c) => codeFilter === 'active' ? c.status === 'active' || c.status === 'pending' : c.status === 'resolved' || c.status === 'false_positive');

  const activeBadge = codes.filter((c) => c.status === 'active').length;
  const recallBadge = recalls.filter((r) => !r.acknowledged).length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const styles = makeStyles(colors);
  return (
    <AppShell routeKey="diagnostics" title="Diagnostics" subtitle="OBD-II, health score, and vehicle intelligence">
      {/* Vehicle Picker */}
      {vehicles.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.vehiclePickerScroll}
          contentContainerStyle={styles.vehiclePickerContent}
        >
          {vehicles.map((v) => (
            <Pressable
              key={v.vehicle_id}
              accessibilityLabel={`Select ${v.year} ${v.make} ${v.model}`}
              style={({ pressed }) => [
                styles.vehiclePill,
                selectedVehicle?.vehicle_id === v.vehicle_id && styles.vehiclePillActive,
                pressed && styles.pressedState,
              ]}
              onPress={() => setSelectedVehicle(v)}
            >
              <Text style={[styles.vehiclePillText, selectedVehicle?.vehicle_id === v.vehicle_id && styles.vehiclePillTextActive]}>
                {v.year} {v.make} {v.model}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {vehicles.length === 1 && selectedVehicle && (
        <View style={styles.singleVehicle}>
          <Text style={styles.singleVehicleText}>{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</Text>
          {selectedVehicle.current_mileage ? (
            <Text style={styles.singleVehicleMeta}>{selectedVehicle.current_mileage.toLocaleString()} mi</Text>
          ) : null}
        </View>
      )}

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const badge = t.key === 'codes' ? activeBadge : t.key === 'recalls' ? recallBadge : 0;
          return (
            <Pressable
              key={t.key}
              accessibilityLabel={`${t.label} tab`}
              style={({ pressed }) => [styles.tabBtn, isActive && styles.tabBtnActive, pressed && styles.pressedState]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
              {badge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brandAccent} />}
      >
        {loadError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
                <View style={styles.errorBannerBody}>
                  <Text style={styles.errorBannerTitle}>Failed to load</Text>
                  <Text style={styles.errorBannerSub}>{loadError}</Text>
                </View>
                <Pressable onPress={loadVehicles} accessibilityLabel="Retry loading vehicles" style={styles.errorBannerRetry}>
                  <Ionicons name="refresh-outline" size={20} color={colors.brandAccent} />
                </Pressable>
              </View>
            )}
        {!selectedVehicle ? (
          !loadError ? <EmptyVehicleState /> : null
        ) : (
          <>
            {tab === 'overview' && (
              <OverviewTab
                vehicle={selectedVehicle}
                healthScore={healthScore}
                healthLoading={healthLoading}
                activeCodes={codes.filter((c) => c.status === 'active')}
                unacknowledgedRecalls={recallBadge}
                onRecalcHealth={handleRecalcHealth}
                onGoToTab={setTab}
              />
            )}
            {tab === 'codes' && (
              <CodesTab
                codes={filteredCodes}
                filter={codeFilter}
                loading={codesLoading}
                vehicleName={selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : ''}
                onFilterChange={setCodeFilter}
                onAnalyze={handleAnalyzeCode}
                onResolve={handleResolveCode}
                onReadCodes={handleReadCodes}
                onClearCodes={handleClearCodes}
                obdConnected={obdState.status === 'connected'}
              />
            )}
            {tab === 'live' && (
              <LiveDataTab
                obdState={obdState}
                liveData={liveData}
                scanning={scanning}
                onConnect={handleConnectOBD}
              />
            )}
            {tab === 'symptoms' && (
              <View style={styles.symptomWrapper}>
                <SymptomCheckerPanel onSubmit={handleSymptomCheck} />
              </View>
            )}
            {tab === 'recalls' && (
              <RecallAlertsPanel
                recalls={recalls}
                tsbs={tsbs}
                loading={recallsLoading}
                onAcknowledge={handleAcknowledgeRecall}
              />
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

// ============================================================================
// Sub-sections
// ============================================================================

function EmptyVehicleState() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.emptyState}>
      <GearLogo variant="micro" size="lg" />
      <Text style={styles.emptyTitle}>No Vehicle Selected</Text>
      <Text style={styles.emptySub}>Add a vehicle in the Garage tab to start diagnostics.</Text>
    </View>
  );
}

// ---------- Overview Tab ----------

interface OverviewTabProps {
  vehicle: Vehicle;
  healthScore: VehicleHealthScore | null;
  healthLoading: boolean;
  activeCodes: DiagnosticCode[];
  unacknowledgedRecalls: number;
  onRecalcHealth: () => void;
  onGoToTab: (tab: Tab) => void;
}

function OverviewTab({ vehicle, healthScore, healthLoading, activeCodes, unacknowledgedRecalls, onRecalcHealth, onGoToTab }: OverviewTabProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const severityColor: Record<string, string> = {
    critical: colors.danger,
    high: colors.danger,
    medium: colors.warning,
    low: colors.success,
  };
  return (
    <View style={styles.sectionGap}>
      {/* Health Score card */}
      <SectionCard title="Vehicle Health Score">
        {healthLoading ? (
          <View style={styles.centeredPad}>
            <ActivityIndicator color={colors.brandAccent} />
          </View>
        ) : healthScore ? (
          <View style={styles.healthScoreLayout}>
            <HealthScoreGauge score={healthScore.overall_score} trend={healthScore.trend} size={140} />
            <View style={styles.healthSystems}>
              {healthScore.systems.slice(0, 6).map((s) => (
                <View key={s.system} style={styles.systemRow}>
                  <Text style={styles.systemLabel}>{s.label}</Text>
                  <View style={styles.systemBarBg}>
                    <View style={[styles.systemBar, {
                      width: `${s.score}%` as any,
                      backgroundColor: s.score >= 80 ? colors.success : s.score >= 60 ? colors.warning : colors.danger,
                    }]} />
                  </View>
                  <Text style={styles.systemScore}>{s.score}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.centeredPad}>
            <Text style={styles.emptyText}>No health score calculated yet.</Text>
          </View>
        )}
        <Pressable accessibilityLabel="Recalculate health score" style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressedState]} onPress={onRecalcHealth}>
          <View style={styles.outlineBtnContent}>
            <GearActionIcon size="sm" />
            <Text style={styles.outlineBtnText}>Recalculate Score</Text>
          </View>
        </Pressable>
      </SectionCard>

      {/* Active codes summary */}
      <SectionCard title="Active Trouble Codes">
        {activeCodes.length === 0 ? (
          <Text style={styles.greenOk}>✓ No active trouble codes</Text>
        ) : (
          <View style={styles.codesSummary}>
            {activeCodes.slice(0, 3).map((c) => (
              <View key={c.diagnostic_id} style={styles.summaryCodeRow}>
                <Text style={[styles.summaryCode, { color: severityColor[c.severity] }]}>{c.code}</Text>
                <Text style={styles.summaryCodeDesc} numberOfLines={1}>{c.description}</Text>
              </View>
            ))}
            {activeCodes.length > 3 && (
              <Text style={styles.moreText}>+{activeCodes.length - 3} more</Text>
            )}
          </View>
        )}
        <Pressable accessibilityLabel="View all trouble codes" style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressedState]} onPress={() => onGoToTab('codes')}>
          <View style={styles.outlineBtnContent}>
            <GearActionIcon size="sm" />
            <Text style={styles.outlineBtnText}>View All Codes</Text>
          </View>
        </Pressable>
      </SectionCard>

      {/* Recalls summary */}
      {unacknowledgedRecalls > 0 && (
        <Pressable
          accessibilityLabel={`${unacknowledgedRecalls} open recalls, tap to view`}
          style={({ pressed }) => [styles.recallBanner, pressed && styles.pressedState]}
          onPress={() => onGoToTab('recalls')}
        >
          <Text style={styles.recallBannerIcon}>⚠</Text>
          <View style={styles.recallBannerContent}>
            <Text style={styles.recallBannerTitle}>{unacknowledgedRecalls} Open Recall{unacknowledgedRecalls > 1 ? 's' : ''}</Text>
            <Text style={styles.recallBannerSub}>Tap to view recall details and remedy instructions →</Text>
          </View>
        </Pressable>
      )}

      {/* Quick actions */}
      <SectionCard title="Quick Actions">
        <View style={styles.quickActions}>
          <QuickActionBtn label="Scan Codes" icon="🔌" onPress={() => onGoToTab('live')} />
          <QuickActionBtn label="Check Symptoms" icon="🩺" onPress={() => onGoToTab('symptoms')} />
          <QuickActionBtn label="View Recalls" icon="📢" onPress={() => onGoToTab('recalls')} />
        </View>
      </SectionCard>
    </View>
  );
}

function QuickActionBtn({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable accessibilityLabel={label} style={({ pressed }) => [styles.quickBtn, pressed && styles.pressedState]} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

// ---------- Codes Tab ----------

interface CodesTabProps {
  codes: DiagnosticCode[];
  filter: 'all' | 'active' | 'resolved';
  loading: boolean;
  obdConnected: boolean;
  vehicleName: string;
  onFilterChange: (f: 'all' | 'active' | 'resolved') => void;
  onAnalyze: (code: DiagnosticCode) => Promise<DTCAnalysis | null>;
  onResolve: (id: string) => Promise<void>;
  onReadCodes: () => Promise<void>;
  onClearCodes: () => Promise<void>;
}

/** Normalize DiagnosticCode severity to the values ModernDiagnosticCard accepts. */
function normalizeSeverity(severity: DiagnosticCode['severity']): 'low' | 'medium' | 'high' {
  return severity === 'critical' ? 'high' : severity;
}

function formatDateDetected(iso?: string | null): string {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function CodesTab({ codes, filter, loading, obdConnected, vehicleName, onFilterChange, onAnalyze, onResolve, onReadCodes, onClearCodes }: CodesTabProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [reading, setReading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={styles.sectionGap}>
      {/* OBD actions */}
      {obdConnected && (
        <View style={styles.obdActions}>
          <Pressable
            accessibilityLabel="Read diagnostic trouble codes"
            style={({ pressed }) => [styles.obdBtn, pressed && styles.pressedState]}
            onPress={async () => { setReading(true); await onReadCodes(); setReading(false); }}
            disabled={reading}
          >
            {reading ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.obdBtnText}>Read Codes</Text>}
          </Pressable>
          <Pressable
            accessibilityLabel="Clear diagnostic trouble codes"
            style={({ pressed }) => [styles.obdBtn, styles.obdBtnOutline, pressed && styles.pressedState]}
            onPress={async () => { setClearing(true); await onClearCodes(); setClearing(false); }}
            disabled={clearing}
          >
            {clearing ? <ActivityIndicator color={colors.danger} size="small" /> : <Text style={[styles.obdBtnText, { color: colors.danger }]}>Clear Codes</Text>}
          </Pressable>
        </View>
      )}

      {/* Filter */}
      <View style={styles.filterRow}>
        {(['active', 'all', 'resolved'] as const).map((f) => (
          <Pressable
            key={f}
            accessibilityLabel={`Filter ${f} codes`}
            style={({ pressed }) => [styles.filterBtn, filter === f && styles.filterBtnActive, pressed && styles.pressedState]}
            onPress={() => onFilterChange(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f[0].toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centeredPad}>
          <ActivityIndicator color={colors.brandAccent} />
        </View>
      ) : codes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.greenOk}>✓ No codes for this filter</Text>
        </View>
      ) : (
        codes.map((code) => (
          <View key={code.diagnostic_id}>
            <ModernDiagnosticCard
              code={code.code}
              description={code.description}
              severity={normalizeSeverity(code.severity)}
              vehicle={vehicleName}
              dateDetected={formatDateDetected(code.detected_at)}
              onPress={() => setExpandedId(expandedId === code.diagnostic_id ? null : code.diagnostic_id)}
            />
            {expandedId === code.diagnostic_id && (
              <DTCCodeCard
                code={code}
                onAnalyze={onAnalyze}
                onResolve={onResolve}
              />
            )}
          </View>
        ))
      )}
    </View>
  );
}

// ---------- Live Data Tab ----------

interface LiveDataTabProps {
  obdState: OBDSessionState;
  liveData?: LiveOBDData;
  scanning: boolean;
  onConnect: () => Promise<void>;
}

function LiveDataTab({ obdState, liveData, scanning, onConnect }: LiveDataTabProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.sectionGap}>
      {/* Connection card */}
      <SectionCard title="OBD-II Adapter">
        <View style={styles.obdConnectRow}>
          <View style={styles.obdStatus}>
            <View style={[styles.statusDot, {
              backgroundColor: obdState.status === 'connected' ? colors.success
                : obdState.status === 'error' ? colors.danger
                : obdState.status === 'scanning' || obdState.status === 'connecting' ? colors.warning
                : colors.textSecondary,
            }]} />
            <View>
              <Text style={styles.obdStatusTitle}>
                {obdState.status === 'connected' ? obdState.adapter_name || 'ELM327 OBD-II'
                  : obdState.status === 'scanning' ? 'Scanning…'
                  : obdState.status === 'connecting' ? 'Connecting…'
                  : obdState.status === 'error' ? 'Connection Error'
                  : 'No Adapter Connected'}
              </Text>
              {obdState.protocol && (
                <Text style={styles.obdStatusSub}>{obdState.protocol}</Text>
              )}
            </View>
          </View>
          <Pressable
            accessibilityLabel={obdState.status === 'connected' ? 'Disconnect OBD adapter' : 'Connect OBD adapter'}
            style={({ pressed }) => [
              styles.connectBtn,
              obdState.status === 'connected' && styles.connectBtnActive,
              pressed && styles.pressedState,
            ]}
            onPress={onConnect}
            disabled={scanning}
          >
            {scanning ? (
              <ActivityIndicator color={obdState.status === 'connected' ? colors.danger : '#000'} size="small" />
            ) : (
              <Text style={[styles.connectBtnText, obdState.status === 'connected' && { color: colors.danger }]}>
                {obdState.status === 'connected' ? 'Disconnect' : 'Connect'}
              </Text>
            )}
          </Pressable>
        </View>

        {obdState.status === 'disconnected' && (
          <Text style={styles.obdHint}>
            Connect an ELM327 Bluetooth or WiFi OBD-II adapter to your vehicle's OBD port to view live engine data.
          </Text>
        )}
      </SectionCard>

      {/* Live data grid */}
      <SectionCard title="Live Parameters">
        <LiveDataGrid sessionState={obdState} data={liveData} />
      </SectionCard>
    </View>
  );
}

// ---------- Helper card component ----------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: sp[4], gap: sp[3] },
  sectionGap: { gap: sp[3] },
  pressedState: { opacity: pressedOpacity },

  // Vehicle picker
  vehiclePickerScroll: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border },
  vehiclePickerContent: { paddingHorizontal: sp[4], paddingVertical: sp[3], gap: sp[2] },
  vehiclePill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: sp[4],
    paddingVertical: sp[2],
    backgroundColor: colors.surfaceAlt,
  },
  vehiclePillActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  vehiclePillText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  vehiclePillTextActive: { color: colors.textPrimary },
  singleVehicle: {
    paddingHorizontal: sp[4],
    paddingVertical: sp[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[2],
  },
  singleVehicleText: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  singleVehicleMeta: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },

  // Tab bar
  tabBarScroll: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBarContent: { paddingHorizontal: sp[4], paddingVertical: sp[2], gap: sp[2], flexDirection: 'row', alignItems: 'center' },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[1],
    paddingHorizontal: sp[4],
    paddingVertical: sp[2],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tabBtnActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  tabText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  tabTextActive: { color: colors.textPrimary },
  tabBadge: { backgroundColor: colors.danger, borderRadius: radii.full, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: sp[1] },
  tabBadgeText: { color: '#fff', fontFamily: fontFamilies.heading, fontSize: typeScale.xs },

  // Error banner (extracted from inline styles)
  errorBanner: {
    margin: sp[4],
    padding: sp[4],
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.danger + '40',
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[3],
  },
  errorBannerBody: { flex: 1 },
  errorBannerTitle: { color: colors.danger, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  errorBannerSub: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },
  errorBannerRetry: { padding: sp[2] },

  // Symptom wrapper
  symptomWrapper: { gap: sp[0] },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.heading,
    fontSize: typeScale.sm,
    paddingHorizontal: sp[4],
    paddingVertical: sp[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardBody: { padding: sp[4], gap: sp[3] },

  // Empty states
  emptyState: { alignItems: 'center', paddingVertical: sp[6], gap: sp[2] },
  emptyTitle: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.lg },
  emptySub: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm, textAlign: 'center' },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  greenOk: { color: colors.success, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  centeredPad: { paddingVertical: sp[6], alignItems: 'center', justifyContent: 'center' },

  // Health score layout
  healthScoreLayout: { flexDirection: 'row', gap: sp[4], alignItems: 'flex-start' },
  healthSystems: { flex: 1, gap: sp[2] },
  systemRow: { flexDirection: 'row', alignItems: 'center', gap: sp[2] },
  systemLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, width: 72 },
  systemBarBg: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  systemBar: { height: 6, borderRadius: 3 },
  systemScore: { color: colors.textPrimary, fontFamily: fontFamilies.heading, fontSize: typeScale.xs, width: 24, textAlign: 'right' },

  // Buttons
  outlineBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, minHeight: touchMinHeight, alignItems: 'center', justifyContent: 'center' },
  outlineBtnContent: { flexDirection: 'row', alignItems: 'center', gap: sp[2] },
  outlineBtnText: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },

  // Recall banner
  recallBanner: {
    backgroundColor: colors.dangerBannerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.lg,
    padding: sp[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[3],
  },
  recallBannerIcon: { fontSize: typeScale.xl, color: colors.danger },
  recallBannerContent: { flex: 1 },
  recallBannerTitle: { color: colors.danger, fontFamily: fontFamilies.heading, fontSize: typeScale.sm },
  recallBannerSub: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 2 },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: sp[2] },
  quickBtn: { flex: 1, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, alignItems: 'center', paddingVertical: sp[3], gap: sp[1] },
  quickIcon: { fontSize: typeScale.xl },
  quickLabel: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, textAlign: 'center' },

  // Codes summary
  codesSummary: { gap: sp[2] },
  summaryCodeRow: { flexDirection: 'row', alignItems: 'center', gap: sp[3] },
  summaryCode: { fontFamily: fontFamilies.heading, fontSize: typeScale.sm, width: 60 },
  summaryCodeDesc: { flex: 1, color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  moreText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },

  // Filter bar
  filterRow: { flexDirection: 'row', gap: sp[2] },
  filterBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, paddingHorizontal: sp[4], paddingVertical: sp[2], backgroundColor: colors.surfaceAlt },
  filterBtnActive: { borderColor: colors.brandAccent, backgroundColor: colors.accentTint },
  filterText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs },
  filterTextActive: { color: colors.textPrimary },

  // OBD actions
  obdActions: { flexDirection: 'row', gap: sp[2] },
  obdBtn: { flex: 1, backgroundColor: colors.brandAccent, borderRadius: radii.md, minHeight: touchMinHeight, alignItems: 'center', justifyContent: 'center' },
  obdBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  obdBtnText: { color: '#000', fontFamily: fontFamilies.heading, fontSize: typeScale.xs },

  // OBD connect panel
  obdConnectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp[3] },
  obdStatus: { flexDirection: 'row', alignItems: 'center', gap: sp[3], flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  obdStatusTitle: { color: colors.textPrimary, fontFamily: fontFamilies.body, fontSize: typeScale.sm },
  obdStatusSub: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, marginTop: 1 },
  connectBtn: { backgroundColor: colors.brandAccent, borderRadius: radii.md, paddingHorizontal: sp[4], paddingVertical: sp[2] },
  connectBtnActive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  connectBtnText: { color: '#000', fontFamily: fontFamilies.heading, fontSize: typeScale.xs },
  obdHint: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: typeScale.xs, lineHeight: typeScale.lg },
});
}
