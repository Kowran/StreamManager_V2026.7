import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  Activity,
  Database,
  Server,
  Zap,
  AlertCircle,
  Info,
  Clock,
  Filter,
  ScrollText,
  Terminal,
  KeyRound,
  Bug,
  TrendingDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface TableSecurityInfo {
  tablename: string;
  rls_enabled: boolean;
  policy_count: number;
  select_policies: number;
  insert_policies: number;
  update_policies: number;
  delete_policies: number;
  approx_rows: number;
}

interface PolicyInfo {
  tablename: string;
  policyname: string;
  cmd: string;
  roles: string[];
  qual: string | null;
  with_check: string | null;
}

interface AuditLog {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  event_type: string;
  severity: string;
  affected_table: string | null;
  message: string;
  metadata: any;
  ip_address: string | null;
}

interface ScanResult {
  scanned_at: string;
  total_tables: number;
  total_issues: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  issues: Array<{
    severity: string;
    table: string;
    policy?: string;
    issue: string;
    recommendation: string;
  }>;
}

type TabId = 'overview' | 'policies' | 'vulnerabilities' | 'logs' | 'scan';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-security-center`;

export function AdminSecurityCenter() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<TableSecurityInfo[]>([]);
  const [policies, setPolicies] = useState<PolicyInfo[]>([]);
  const [vulnerablePolicies, setVulnerablePolicies] = useState<PolicyInfo[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logSeverity, setLogSeverity] = useState<string>('all');
  const [logsLoading, setLogsLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [rlsFilter, setRlsFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  const tr = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  const getAuthHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    return {
      'Authorization': `Bearer ${data.session?.access_token || ''}`,
      'Content-Type': 'application/json',
    };
  };

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FUNCTION_URL}?action=overview`, { headers });
      if (!res.ok) throw new Error('Failed to load overview');
      const json = await res.json();
      setTables(json.data || []);
    } catch (err) {
      console.error('Security overview error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPolicies = useCallback(async (table?: string) => {
    try {
      const headers = await getAuthHeaders();
      const url = table
        ? `${FUNCTION_URL}?action=policies&table=${encodeURIComponent(table)}`
        : `${FUNCTION_URL}?action=policies`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to load policies');
      const json = await res.json();
      setPolicies(json.data || []);
    } catch (err) {
      console.error('Policies error:', err);
    }
  }, []);

  const loadVulnerable = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FUNCTION_URL}?action=vulnerable`, { headers });
      if (!res.ok) throw new Error('Failed to load vulnerable policies');
      const json = await res.json();
      setVulnerablePolicies(json.data || []);
    } catch (err) {
      console.error('Vulnerable policies error:', err);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${FUNCTION_URL}?action=logs&limit=100&offset=0&severity=${logSeverity}`,
        { headers }
      );
      if (!res.ok) throw new Error('Failed to load logs');
      const json = await res.json();
      setLogs(json.logs || []);
      setLogsTotal(json.total || 0);
    } catch (err) {
      console.error('Logs error:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [logSeverity]);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FUNCTION_URL}?action=scan`, { headers, method: 'POST', body: JSON.stringify({}) });
      if (!res.ok) throw new Error('Failed to run scan');
      const json = await res.json();
      setScanResult(json);
      // Refresh overview after scan
      loadOverview();
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  }, [loadOverview]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === 'policies' && policies.length === 0) {
      loadPolicies();
    }
    if (activeTab === 'vulnerabilities' && vulnerablePolicies.length === 0) {
      loadVulnerable();
    }
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [activeTab]);

  const filteredTables = tables.filter(t => {
    if (rlsFilter === 'enabled' && !t.rls_enabled) return false;
    if (rlsFilter === 'disabled' && t.rls_enabled) return false;
    if (searchQuery && !t.tablename.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: tables.length,
    rlsEnabled: tables.filter(t => t.rls_enabled).length,
    rlsDisabled: tables.filter(t => !t.rls_enabled).length,
    noPolicies: tables.filter(t => t.rls_enabled && t.policy_count === 0).length,
    totalPolicies: tables.reduce((sum, t) => sum + t.policy_count, 0),
    vulnerable: vulnerablePolicies.length,
  };

  const tabs: Array<{ id: TabId; label: string; icon: any; color: string }> = [
    { id: 'overview', label: tr('Visão Geral', 'Overview', 'Vista General'), icon: Database, color: 'text-blue-500' },
    { id: 'policies', label: tr('Políticas RLS', 'RLS Policies', 'Políticas RLS'), icon: Lock, color: 'text-emerald-500' },
    { id: 'vulnerabilities', label: tr('Vulnerabilidades', 'Vulnerabilities', 'Vulnerabilidades'), icon: Bug, color: 'text-red-500' },
    { id: 'logs', label: tr('Logs de Auditoria', 'Audit Logs', 'Registros'), icon: ScrollText, color: 'text-amber-500' },
    { id: 'scan', label: tr('Scanner', 'Scanner', 'Escáner'), icon: Zap, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-emerald-400 to-teal-600 p-3 rounded-xl shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {tr('Centro de Segurança', 'Security Center', 'Centro de Seguridad')}
              </h1>
              <p className="text-gray-300 text-sm mt-1">
                {tr(
                  'Monitore e configure toda a segurança do banco de dados',
                  'Monitor and configure all database security',
                  'Monitore y configure toda la seguridad de la base de datos'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium shadow-lg transition-all disabled:opacity-50"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {tr('Executar Scanner', 'Run Scan', 'Ejecutar Escáner')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Database}
          label={tr('Tabelas', 'Tables', 'Tablas')}
          value={stats.total}
          color="from-blue-500 to-blue-600"
        />
        <StatCard
          icon={ShieldCheck}
          label={tr('RLS Ativo', 'RLS Enabled', 'RLS Activo')}
          value={stats.rlsEnabled}
          color="from-emerald-500 to-emerald-600"
        />
        <StatCard
          icon={ShieldX}
          label={tr('RLS Desativado', 'RLS Disabled', 'RLS Desactivado')}
          value={stats.rlsDisabled}
          color="from-red-500 to-red-600"
          alert={stats.rlsDisabled > 0}
        />
        <StatCard
          icon={Lock}
          label={tr('Políticas', 'Policies', 'Políticas')}
          value={stats.totalPolicies}
          color="from-teal-500 to-teal-600"
        />
        <StatCard
          icon={AlertTriangle}
          label={tr('Sem Políticas', 'No Policies', 'Sin Políticas')}
          value={stats.noPolicies}
          color="from-orange-500 to-orange-600"
          alert={stats.noPolicies > 0}
        />
        <StatCard
          icon={Bug}
          label={tr('Vulneráveis', 'Vulnerable', 'Vulnerables')}
          value={stats.vulnerable}
          color="from-rose-500 to-rose-600"
          alert={stats.vulnerable > 0}
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-px">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-x border-t border-gray-200 dark:border-gray-700 -mb-px'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? tab.color : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {loading && activeTab === 'overview' ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={tr('Buscar tabelas...', 'Search tables...', 'Buscar tablas...')}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {(['all', 'enabled', 'disabled'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setRlsFilter(f)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        rlsFilter === f
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {f === 'all' ? tr('Todas', 'All', 'Todas') : f === 'enabled' ? tr('Ativas', 'Enabled', 'Activas') : tr('Desativadas', 'Disabled', 'Desactivadas')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table List */}
              <div className="space-y-2">
                {filteredTables.map(table => (
                  <TableSecurityRow
                    key={table.tablename}
                    table={table}
                    policies={policies.filter(p => p.tablename === table.tablename)}
                    expanded={expandedTable === table.tablename}
                    onToggle={() => {
                      if (expandedTable === table.tablename) {
                        setExpandedTable(null);
                      } else {
                        setExpandedTable(table.tablename);
                        if (policies.filter(p => p.tablename === table.tablename).length === 0) {
                          loadPolicies(table.tablename);
                        }
                      }
                    }}
                  />
                ))}
                {filteredTables.length === 0 && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    {tr('Nenhuma tabela encontrada', 'No tables found', 'No se encontraron tablas')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* POLICIES TAB */}
          {activeTab === 'policies' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Info className="h-4 w-4" />
                {tr(
                  'Todas as políticas RLS do banco de dados. Clique para ver detalhes.',
                  'All RLS policies in the database. Click to see details.',
                  'Todas las políticas RLS de la base de datos. Haga clic para ver detalles.'
                )}
              </div>
              <div className="space-y-2">
                {policies.map((policy, i) => (
                  <PolicyCard key={`${policy.tablename}-${policy.policyname}-${i}`} policy={policy} />
                ))}
                {policies.length === 0 && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
                    {tr('Carregando políticas...', 'Loading policies...', 'Cargando políticas...')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VULNERABILITIES TAB */}
          {activeTab === 'vulnerabilities' && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 border ${vulnerablePolicies.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
                <div className="flex items-center gap-3">
                  {vulnerablePolicies.length > 0 ? (
                    <>
                      <ShieldAlert className="h-6 w-6 text-red-500" />
                      <div>
                        <p className="font-semibold text-red-700 dark:text-red-300">
                          {tr(
                            `${vulnerablePolicies.length} políticas potencialmente vulneráveis encontradas`,
                            `${vulnerablePolicies.length} potentially vulnerable policies found`,
                            `${vulnerablePolicies.length} políticas potencialmente vulnerables encontradas`
                          )}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          {tr(
                            'Políticas com USING(true) ou WITH CHECK(true) podem permitir acesso não autorizado.',
                            'Policies with USING(true) or WITH CHECK(true) may allow unauthorized access.',
                            'Políticas con USING(true) o WITH CHECK(true) pueden permitir acceso no autorizado.'
                          )}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-6 w-6 text-emerald-500" />
                      <div>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                          {tr('Nenhuma vulnerabilidade detectada', 'No vulnerabilities detected', 'Ninguna vulnerabilidad detectada')}
                        </p>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                          {tr('Todas as políticas possuem verificações de propriedade adequadas.', 'All policies have proper ownership checks.', 'Todas las políticas tienen verificaciones de propiedad adecuadas.')}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {vulnerablePolicies.map((policy, i) => (
                <PolicyCard key={`vuln-${policy.tablename}-${policy.policyname}-${i}`} policy={policy} highlight />
              ))}
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  {(['all', 'info', 'warning', 'critical'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setLogSeverity(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        logSeverity === s
                          ? s === 'critical' ? 'bg-red-500 text-white'
                            : s === 'warning' ? 'bg-amber-500 text-white'
                            : s === 'info' ? 'bg-blue-500 text-white'
                            : 'bg-gray-700 dark:bg-gray-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {s === 'all' ? tr('Todos', 'All', 'Todos') : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={loadLogs}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  {tr('Atualizar', 'Refresh', 'Actualizar')}
                </button>
              </div>

              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  {tr('Nenhum log encontrado', 'No logs found', 'Sin registros')}
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => (
                    <AuditLogRow key={log.id} log={log} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SCAN TAB */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              {!scanResult && !scanning && (
                <div className="text-center py-16">
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Zap className="h-10 w-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {tr('Scanner de Segurança', 'Security Scanner', 'Escáner de Seguridad')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                    {tr(
                      'Execute uma verificação completa do banco de dados para identificar vulnerabilidades, políticas inseguras e problemas de configuração.',
                      'Run a full database scan to identify vulnerabilities, insecure policies, and configuration issues.',
                      'Ejecute un escaneo completo de la base de datos para identificar vulnerabilidades, políticas inseguras y problemas de configuración.'
                    )}
                  </p>
                  <button
                    onClick={runScan}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium shadow-lg transition-all"
                  >
                    <Zap className="h-5 w-5" />
                    {tr('Iniciar Verificação', 'Start Scan', 'Iniciar Escaneo')}
                  </button>
                </div>
              )}

              {scanning && (
                <div className="text-center py-16">
                  <Loader2 className="h-10 w-10 text-purple-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {tr('Verificando segurança do banco de dados...', 'Scanning database security...', 'Escaneando seguridad de la base de datos...')}
                  </p>
                </div>
              )}

              {scanResult && !scanning && (
                <div className="space-y-4">
                  {/* Scan Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{scanResult.total_tables}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{tr('Tabelas Verificadas', 'Tables Scanned', 'Tablas Escaneadas')}</div>
                    </div>
                    <div className={`rounded-xl p-4 border ${scanResult.critical_count > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
                      <div className={`text-2xl font-bold ${scanResult.critical_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{scanResult.critical_count}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{tr('Críticos', 'Critical', 'Críticos')}</div>
                    </div>
                    <div className={`rounded-xl p-4 border ${scanResult.warning_count > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
                      <div className={`text-2xl font-bold ${scanResult.warning_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{scanResult.warning_count}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{tr('Avisos', 'Warnings', 'Advertencias')}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{scanResult.info_count}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{tr('Informativos', 'Info', 'Informativos')}</div>
                    </div>
                  </div>

                  {/* Issues */}
                  {scanResult.issues.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {tr('Problemas Encontrados', 'Issues Found', 'Problemas Encontrados')}
                      </h3>
                      {scanResult.issues.map((issue, i) => (
                        <div
                          key={i}
                          className={`rounded-xl p-4 border ${
                            issue.severity === 'critical'
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              : issue.severity === 'warning'
                              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {issue.severity === 'critical' ? (
                              <ShieldX className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            ) : issue.severity === 'warning' ? (
                              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            ) : (
                              <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm text-gray-900 dark:text-white">{issue.table}</span>
                                {issue.policy && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                    {issue.policy}
                                  </span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  issue.severity === 'critical' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                  : issue.severity === 'warning' ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                                  : 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                                }`}>
                                  {issue.severity.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{issue.issue}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
                                <Terminal className="h-3 w-3" />
                                {issue.recommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                      <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                        {tr('Nenhum problema encontrado!', 'No issues found!', '¡Sin problemas!')}
                      </p>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                        {tr('Sua base de dados está segura.', 'Your database is secure.', 'Su base de datos está segura.')}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={runScan}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {tr('Verificar Novamente', 'Scan Again', 'Escanear de Nuevo')}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({ icon: Icon, label, value, color, alert }: { icon: any; label: string; value: number; color: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${alert ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`bg-gradient-to-br ${color} p-1.5 rounded-lg`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${alert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </div>
    </div>
  );
}

function TableSecurityRow({ table, policies, expanded, onToggle }: {
  table: TableSecurityInfo;
  policies: PolicyInfo[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasIssue = !table.rls_enabled || (table.rls_enabled && table.policy_count === 0);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${hasIssue ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          {table.rls_enabled ? (
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          ) : (
            <ShieldX className="h-5 w-5 text-red-500" />
          )}
          <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{table.tablename}</span>
          {hasIssue && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              {table.rls_enabled ? 'NO POLICIES' : 'RLS OFF'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {table.approx_rows.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {table.policy_count}
          </span>
          <div className="flex items-center gap-1">
            <PolicyBadge count={table.select_policies} cmd="SELECT" />
            <PolicyBadge count={table.insert_policies} cmd="INSERT" />
            <PolicyBadge count={table.update_policies} cmd="UPDATE" />
            <PolicyBadge count={table.delete_policies} cmd="DELETE" />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 space-y-2">
          {policies.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {table.policy_count === 0 ? 'No policies defined' : 'Loading policies...'}
            </div>
          ) : (
            policies.map((p, i) => <PolicyCard key={i} policy={p} compact />)
          )}
        </div>
      )}
    </div>
  );
}

function PolicyBadge({ count, cmd }: { count: number; cmd: string }) {
  const colors: Record<string, string> = {
    SELECT: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    INSERT: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    UPDATE: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    DELETE: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  };
  const abbr = cmd[0];
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${count > 0 ? colors[cmd] : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'}`}
      title={`${cmd}: ${count} policy(ies)`}
    >
      {abbr}
    </span>
  );
}

function PolicyCard({ policy, highlight, compact }: { policy: PolicyInfo; highlight?: boolean; compact?: boolean }) {
  const [expanded, setExpanded] = useState(!compact);
  const isVulnerable = policy.qual === 'true' || policy.with_check === 'true';

  const cmdColors: Record<string, string> = {
    SELECT: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    INSERT: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    UPDATE: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    DELETE: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  };

  return (
    <div className={`rounded-lg border ${highlight || isVulnerable ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'} ${compact ? '' : 'p-4'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between ${compact ? 'p-3' : ''}`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cmdColors[policy.cmd] || 'bg-gray-100 text-gray-600'}`}>
            {policy.cmd}
          </span>
          <span className="font-mono text-sm text-gray-900 dark:text-white">{policy.policyname}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">on</span>
          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{policy.tablename}</span>
          {isVulnerable && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              VULNERABLE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {policy.roles.map(r => (
            <span key={r} className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {r}
            </span>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 text-xs">
          {policy.qual && (
            <div>
              <span className="font-semibold text-gray-500 dark:text-gray-400">USING: </span>
              <code className={`block mt-1 p-2 rounded-lg overflow-x-auto ${policy.qual === 'true' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                {policy.qual}
              </code>
            </div>
          )}
          {policy.with_check && (
            <div>
              <span className="font-semibold text-gray-500 dark:text-gray-400">WITH CHECK: </span>
              <code className={`block mt-1 p-2 rounded-lg overflow-x-auto ${policy.with_check === 'true' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                {policy.with_check}
              </code>
            </div>
          )}
          {!policy.qual && !policy.with_check && (
            <span className="text-gray-400 dark:text-gray-500">No conditions defined</span>
          )}
        </div>
      )}
    </div>
  );
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
    critical: { icon: ShieldX, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  };

  const config = severityConfig[log.severity] || severityConfig.info;
  const Icon = config.icon;

  const eventTypeIcons: Record<string, any> = {
    rls_change: Lock,
    admin_action: Shield,
    suspicious_access: Eye,
    config_change: Settings,
    security_scan: Zap,
    login_anomaly: AlertCircle,
  };
  const EventIcon = eventTypeIcons[log.event_type] || Activity;

  return (
    <div className={`rounded-lg border p-3 ${config.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 ${config.color} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color} bg-opacity-10`}>
              {log.severity.toUpperCase()}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <EventIcon className="h-3 w-3" />
              {log.event_type}
            </span>
            {log.affected_table && (
              <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
                {log.affected_table}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{log.message}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(log.created_at).toLocaleString()}
            </span>
            {log.actor_email && (
              <span>{log.actor_email}</span>
            )}
            {log.ip_address && (
              <span className="font-mono">{log.ip_address}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
