import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { staffDb, isStaffMock } from '../../lib/staff-client';
import { staffMock } from '../../lib/staff-mock';
import { useSession } from '../../hooks/useSession';
import { useStaffRoles } from '../../hooks/useStaffRoles';
import { auditTargetLabel, banIdsWithoutTarget, formatStaffTime, isUuid, missingBanUserIds, type BanRow, type ProfileName } from '../../lib/staff-audit';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { buildUserSearchArgs, isMissingBackend, pageInfo, SEARCH_PAGE_SIZE, totalFromRows } from '../../lib/staff-search';
import { REPORT_CATEGORY_LABEL, reportCategory, type ReportCategory, actionConfirmText, auditLinkedToReport, BAN_DURATIONS, buildReportActionArgs, describeSnapshot, isReportOpen, reportActions, reportOutcomeLabel, MIN_ACTION_REASON, type ReportAction, type ReportSnapshot } from '../../lib/staff-reports';
import { checkRoleChange, grantableRoles, sortRoles, STAFF_ROLE_LABEL, type StaffRoleName } from '../../lib/staff-roles';
import { staffHeaderLayout } from '../../lib/staff-layout';
import { EdgeScrollRow } from '../../components/EdgeScrollRow';

type Section = 'dashboard' | 'users' | 'moderation' | 'bans' | 'reports' | 'logs' | 'settings';
type Report = { id: string; reporter_id: string; message_id: string | null; story_id: string | null; reason: string; status: string; created_at: string; review_note: string | null; reported_user_id?: string | null; content_snapshot?: ReportSnapshot | null; action_taken?: string | null; action_ref?: string | null };
type DashboardCounts = { users_total: number; users_new_7d: number; reports_open: number; reports_reviewing: number; reports_24h: number; bans_active: number; bans_active_user: number; warnings_30d: number; chats_total: number };
type StaffMember = { user_id: string; username: string | null; display_name: string | null; roles: string[]; is_banned: boolean };
const REPORT_COLUMNS = 'id,reporter_id,message_id,story_id,reason,status,created_at,review_note';
const REPORT_COLUMNS_1B = `${REPORT_COLUMNS},reported_user_id,content_snapshot,action_taken,action_ref`;
const MIGRATION_HINT = 'migratie 20261012090100 nog niet toegepast';
type Audit = { id: string; actor_id: string|null; action: string; entity_type: string | null; entity_id: string | null; created_at: string; metadata?: Record<string,unknown> | null };
type Person = { id: string; username: string | null; display_name: string | null; created_at: string | null; is_verified: boolean | null; is_banned?: boolean | null; total_count?: number | null };
type BanEntry = { id: string; ban_type: 'user'|'ip'|'device'; target_user_id: string|null; target_ip: string|null; target_device_id: string|null; issued_by: string|null; reason: string; created_at: string; ends_at: string|null; revoked_at: string|null };
type LoginEvent = { id: string; user_id: string; logged_at: string; ip_address: string|null; device_id: string; device_label: string|null; user_agent: string|null };
type ChatEntry = { thread_id: string; title: string|null; created_at: string; member_count: number; last_message_at: string|null };
type ChatMessage = { message_id: string; sender_id: string; kind: string; body: string|null; created_at: string; is_deleted: boolean };

const NAV: { id: Section; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' }, { id: 'users', label: 'Gebruikers', icon: 'people-outline' },
  { id: 'moderation', label: 'Chats', icon: 'chatbubbles-outline' }, { id: 'bans', label: 'Bans', icon: 'ban-outline' },
  { id: 'reports', label: 'Meldingen', icon: 'flag-outline' }, { id: 'logs', label: 'Auditlog', icon: 'reader-outline' },
  { id: 'settings', label: 'Instellingen', icon: 'settings-outline' },
];

/** Resolves ban audit targets: ban rows for audits without metadata.target, and profiles for banned users not in the loaded list. */
async function fetchAuditTargets(rows: Audit[], known: ProfileName[]): Promise<{ profiles: ProfileName[]; bans: BanRow[] }> {
  const knownProfiles = new Map(known.map(p => [p.id, p]));
  const banIds = banIdsWithoutTarget(rows, new Map());
  let bans: BanRow[] = [];
  if (banIds.length) {
    const { data } = await staffDb().from('sx_staff_bans').select('id,ban_type,target_user_id,target_ip,target_device_id').in('id', banIds);
    bans = data || [];
  }
  const userIds = missingBanUserIds(rows, knownProfiles, new Map(bans.map(b => [b.id, b])));
  let profiles: ProfileName[] = [];
  if (userIds.length) {
    const { data } = await staffDb().from('profiles').select('id,username,display_name').in('id', userIds);
    profiles = data || [];
  }
  return { profiles, bans };
}

/** Profiles for the given ids in chunks of 100 (keeps PostgREST URLs short). */
async function fetchProfiles(ids: string[]): Promise<ProfileName[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));
  const results = await Promise.all(chunks.map(chunk => staffDb().from('profiles').select('id,username,display_name').in('id', chunk)));
  return results.flatMap(r => r.data || []);
}

const nameOf = (p: ProfileName | undefined, id: string | null | undefined) => p ? `@${p.username || p.display_name || p.id.slice(0, 8)}` : id ? `${id.slice(0, 8)}…` : 'onbekend';

export default function StaffPanel() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const header = staffHeaderLayout(width);
  const wideLayout = header.wide;
  const realSession = useSession();
  const mock = staffMock();
  // Dev harness (app/dev-staff): fake signed-in staff session backed by the in-memory StaffMock.
  const { session, ready } = mock ? { session: { user: { id: mock.actorId, email: `${mock.profile(mock.actorId)?.username}@mock.snapshotx` } } as NonNullable<typeof realSession.session>, ready: true } : realSession;
  const { roles, loading, isStaff, isAdmin, isOwner, refresh } = useStaffRoles();
  const [section, setSection] = useState<Section>('dashboard');
  const [reports, setReports] = useState<Report[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [userActions,setUserActions]=useState<{ userId: string; items: Audit[] } | null>(null);
  const [auditProfiles,setAuditProfiles]=useState<ProfileName[]>([]);
  const [auditBans,setAuditBans]=useState<BanRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [banEntries, setBanEntries] = useState<BanEntry[]>([]);
  const [loginEvents,setLoginEvents]=useState<LoginEvent[]>([]);
  const [chats,setChats]=useState<ChatEntry[]>([]);
  const [chatPending,setChatPending]=useState<ChatEntry|null>(null);
  const [activeChat,setActiveChat]=useState<ChatEntry|null>(null);
  const [chatMessages,setChatMessages]=useState<ChatMessage[]>([]);
  const [chatReason,setChatReason]=useState('');
  const [messageQuery,setMessageQuery]=useState('');
  const [deleteTarget,setDeleteTarget]=useState<ChatMessage|null>(null);
  const [deleteReason,setDeleteReason]=useState('');
  const [revokeTarget,setRevokeTarget]=useState<BanEntry|null>(null);
  const [revokeReason,setRevokeReason]=useState('');
  const [banType,setBanType]=useState<'user'|'ip'|'device'>('user');
  const [targetIp,setTargetIp]=useState('');
  const [targetDevice,setTargetDevice]=useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);
  // Last opened profile: keeps the popup filled while its fade-out animation runs after `selected` is cleared.
  const [shownProfile, setShownProfile] = useState<Person | null>(null);
  if (selected && selected !== shownProfile) setShownProfile(selected);
  const [banTarget, setBanTarget] = useState<Person | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banError, setBanError] = useState('');
  const [duration, setDuration] = useState('24 uur');
  const [username, setUsername] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmDialog = useConfirmDialog();
  const [searchPage, setSearchPage] = useState(0);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchFallback, setSearchFallback] = useState(false);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [knownProfiles, setKnownProfiles] = useState<ProfileName[]>([]);
  const [reportsLegacy, setReportsLegacy] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[] | null>(null);
  const [actionTarget, setActionTarget] = useState<{ report: Report; action: ReportAction } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionDuration, setActionDuration] = useState<number | null>(1440);
  const [actionError, setActionError] = useState('');
  const [openReport, setOpenReport] = useState<string | null>(null);
  // Bumped by load() so search results and the open profile's history re-fetch after an action.
  const [dataNonce, setDataNonce] = useState(0);
  const [reportFilter, setReportFilter] = useState<ReportCategory | 'all' | 'closed'>('all');
  const [modInfo, setModInfo] = useState<{ userId: string; warnings: number; plus: boolean; plus_source: string | null; banned: boolean } | null>(null);
  const [userAct, setUserAct] = useState<{ kind: 'warn' | 'plus_grant' | 'plus_revoke'; person: Person } | null>(null);
  const [userActReason, setUserActReason] = useState('');
  const [userActDays, setUserActDays] = useState<number | null>(30);
  const [userActError, setUserActError] = useState('');

  const loadStaffMembers = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await staffDb().rpc('sx_staff_list_members');
    if (error) { setStaffMembers(null); setNotice(isMissingBackend(error) ? `Stafflijst niet beschikbaar (${MIGRATION_HINT}).` : `Stafflijst: ${error.message}`); }
    else setStaffMembers((data || []) as StaffMember[]);
  }, [isAdmin]);

  const load = useCallback(async () => {
    const [reportResult0,countResult,bansResult]=await Promise.all([
      staffDb().from('sx_reports').select(REPORT_COLUMNS_1B).order('created_at',{ascending:false}).limit(100),
      staffDb().rpc('sx_staff_dashboard_counts'),
      staffDb().from('sx_staff_bans').select('id,ban_type,target_user_id,target_ip,target_device_id,reason,issued_by,created_at,ends_at,revoked_at').is('revoked_at',null).order('created_at',{ascending:false}).limit(300),
    ]);
    // Before the 1b migration the snapshot columns do not exist: fall back to the old columns.
    let reportResult: { data: Report[] | null; error: { message: string } | null } = reportResult0 as never;
    const legacy = !!reportResult0.error && isMissingBackend(reportResult0.error);
    setReportsLegacy(legacy);
    if (legacy) reportResult = await staffDb().from('sx_reports').select(REPORT_COLUMNS).order('created_at',{ascending:false}).limit(100) as never;
    const reportRows: Report[] = reportResult.error ? [] : reportResult.data || [];
    if(reportResult.error)setNotice(`Meldingen niet geladen: ${reportResult.error.message}`);else setReports(reportRows);
    if(countResult.error){setCounts(null);if(!isMissingBackend(countResult.error))setNotice(`Dashboardtellingen: ${countResult.error.message}`);}
    else setCounts(countResult.data as DashboardCounts);
    const activeBans = bansResult.error ? [] : (bansResult.data||[]).filter(row=>!row.ends_at||new Date(row.ends_at).getTime()>Date.now());
    if(bansResult.error)setNotice(`Banoverzicht niet geladen: ${bansResult.error.message}`);
    else setBanEntries(activeBans);
    const profileIds = [...reportRows.flatMap(r => [r.reporter_id, r.reported_user_id || '']), ...activeBans.map(b => b.target_user_id || '')];
    const profiles = await fetchProfiles(profileIds);
    setKnownProfiles(profiles);
    if(isStaff){
      const {data,error}=await staffDb().from('audit_logs').select('id,actor_id,action,entity_type,entity_id,created_at,metadata').order('created_at',{ascending:false}).limit(100);
      if(error)setNotice(`Auditlog niet geladen: ${error.message}`);
      else{const rows=data||[];setAudit(rows);const targets=await fetchAuditTargets(rows,profiles);setAuditProfiles(targets.profiles);setAuditBans(targets.bans);}
    }
    void loadStaffMembers();
    setDataNonce(n => n + 1);
  }, [isStaff, loadStaffMembers]);

  // Server-side paginated user search (debounced). Falls back to the old 100-newest list only when the RPC is missing.
  useEffect(() => {
    if (!isStaff || (section !== 'users' && section !== 'dashboard')) return;
    let live = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await staffDb().rpc('sx_staff_search_users', buildUserSearchArgs(query, searchPage));
      if (!live) return;
      if (error && isMissingBackend(error)) {
        const fallback = await staffDb().from('profiles').select('id,username,display_name,created_at,is_verified').order('created_at',{ascending:false}).limit(100);
        if (!live) return;
        const q = query.trim().toLowerCase();
        const rows = (fallback.data || []).filter(p => `${p.username || ''} ${p.display_name || ''} ${p.id}`.toLowerCase().includes(q));
        setSearchFallback(true); setPeople(rows); setSearchTotal(rows.length);
      } else if (error) {
        setNotice(`Zoeken mislukt: ${error.message}`);
      } else {
        const rows = (data || []) as Person[];
        setSearchFallback(false); setPeople(rows); setSearchTotal(totalFromRows(rows));
      }
      setSearching(false);
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [isStaff, section, query, searchPage, dataNonce]);

  useEffect(() => { if (!isStaff) return; const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [isStaff, load]);
  const searchPageInfo = pageInfo(searchTotal, searchFallback ? 0 : searchPage, searchFallback ? Math.max(searchTotal, 1) : SEARCH_PAGE_SIZE, people.length);
  const openReports = counts ? counts.reports_open + counts.reports_reviewing : reports.filter(r => r.status === 'open' || r.status === 'reviewing').length;
  const userLoginEvents=useMemo(()=>shownProfile?loginEvents.filter(e=>e.user_id===shownProfile.id):[],[shownProfile,loginEvents]);
  const shownUserActions=userActions&&shownProfile&&userActions.userId===shownProfile.id?userActions.items:[];
  const profileNames=useMemo(()=>new Map<string,ProfileName>([...knownProfiles,...auditProfiles,...people].map(p=>[p.id,p])),[knownProfiles,auditProfiles,people]);
  const banLookup=useMemo(()=>new Map<string,BanRow>([...auditBans,...banEntries].map(b=>[b.id,b])),[auditBans,banEntries]);
  const filteredChats=useMemo(()=>chats.filter(c=>`${c.title||''} ${c.thread_id}`.toLowerCase().includes(query.toLowerCase())),[chats,query]);
  const filteredMessages=useMemo(()=>chatMessages.filter(m=>`${m.sender_id} ${m.kind} ${m.body||''}`.toLowerCase().includes(messageQuery.toLowerCase())),[chatMessages,messageQuery]);
  useEffect(()=>{if(!selected)return;let live=true;staffDb().from('audit_logs').select('id,actor_id,action,entity_type,entity_id,created_at,metadata').order('created_at',{ascending:false}).limit(250).then(({data,error})=>{if(live){if(error)setNotice('Staffacties niet geladen');else setUserActions({userId:selected.id,items:(data||[]).filter(a=>a.entity_id===selected.id||(a.metadata?.target as Record<string,unknown>|undefined)?.user_id===selected.id)})}});staffDb().from('sx_login_history').select('id,user_id,logged_at,ip_address,device_id,device_label,user_agent').eq('user_id',selected.id).order('logged_at',{ascending:false}).limit(100).then(({data,error})=>{if(!live)return;if(error)setNotice(`Loginhistorie: ${error.message}`);else setLoginEvents(data||[]);});return()=>{live=false}},[selected,dataNonce]);
  const loadModInfo = useCallback(async (id: string) => { const { data, error } = await staffDb().rpc('sx_staff_user_moderation', { p_user_id: id }); if (error) { setModInfo(null); if (!isMissingBackend(error)) setNotice(`Moderatiestatus: ${error.message}`); } else setModInfo({ userId: id, ...(data as object) } as never); }, []);
  useEffect(() => { if (!selected) return; let live = true; staffDb().rpc('sx_staff_user_moderation', { p_user_id: selected.id }).then(({ data, error }) => { if (!live) return; if (error) { setModInfo(null); if (!isMissingBackend(error)) setNotice(`Moderatiestatus: ${error.message}`); } else setModInfo({ userId: selected.id, ...(data as object) } as never); }); return () => { live = false; }; }, [selected, dataNonce]);
  async function runUserAct() {
    if (!userAct) return; const r = userActReason.trim(); if (r.length < 8) { setUserActError('Reden van minimaal 8 tekens is verplicht.'); return; }
    setBusy(true); setUserActError('');
    const { error } = userAct.kind === 'warn' ? await staffDb().rpc('sx_staff_warn_user', { p_user_id: userAct.person.id, p_reason: r })
      : await staffDb().rpc('sx_staff_set_plus', { p_user_id: userAct.person.id, p_grant: userAct.kind === 'plus_grant', p_days: userAct.kind === 'plus_grant' ? userActDays : null, p_reason: r });
    setBusy(false);
    if (error) { setUserActError(isMissingBackend(error) ? 'Actie niet beschikbaar (migratie 20261013200000 nog niet toegepast).' : `Actie mislukt: ${error.message}`); return; }
    const who = `@${userAct.person.username || userAct.person.id.slice(0, 8)}`;
    setNotice(userAct.kind === 'warn' ? `Waarschuwing aan ${who} verstuurd en gelogd.` : userAct.kind === 'plus_grant' ? `X+ toegekend aan ${who} en gelogd.` : `X+ ingetrokken bij ${who} en gelogd.`);
    const id = userAct.person.id; setUserAct(null); setUserActReason(''); await load(); await loadModInfo(id);
  }
  useEffect(()=>{if(section!=='moderation'&&section!=='dashboard')return;let live=true;staffDb().rpc('sx_staff_list_chats').then(({data,error})=>{if(!live)return;if(error)setNotice(`Gesprekken: ${error.message}`);else setChats(data||[])});return()=>{live=false}},[section]);

  async function openChat(){if(!chatPending||chatReason.trim().length<10)return;setBusy(true);const {data,error}=await staffDb().rpc('sx_staff_read_chat',{p_thread_id:chatPending.thread_id,p_reason:chatReason.trim()});if(error)setNotice(`Gesprek openen mislukt: ${error.message}`);else{setActiveChat(chatPending);setChatMessages(data||[]);setMessageQuery('');setChatPending(null);setChatReason('');await load()}setBusy(false)}
  async function removeMessage(){if(!deleteTarget||deleteReason.trim().length<8)return;setBusy(true);const {error}=await staffDb().rpc('sx_staff_delete_message',{p_message_id:deleteTarget.message_id,p_reason:deleteReason.trim()});if(error)setNotice(`Bericht verwijderen mislukt: ${error.message}`);else{setChatMessages(items=>items.map(m=>m.message_id===deleteTarget.message_id?{...m,body:null,is_deleted:true}:m));setDeleteTarget(null);setDeleteReason('');setNotice('Bericht verwijderd en gelogd.');await load();const {data:refreshedChats, error:refreshError}=await staffDb().rpc('sx_staff_list_chats');if(!refreshError)setChats(refreshedChats||[])}setBusy(false)}
  async function createBan(){if(!banTarget||banReason.trim().length<8)return;const ip=targetIp.trim(),device=targetDevice.trim();setBanError('');
    // Client pre-check only; the server (uuid parameter + 180-day sx_login_history check) stays authoritative.
    if(banType==='device'&&!isUuid(device)){setBanError('Ban niet toegepast: ongeldige device-ID. Gebruik een UUID, bijv. 123e4567-e89b-12d3-a456-426614174000.');return}
    const durations:Record<string,number|null>={'1 uur':60,'24 uur':1440,'7 dagen':10080,'30 dagen':43200,'Permanent':null};setBusy(true);const {error}=await staffDb().rpc('sx_staff_create_ban',{p_type:banType,p_user_id:banType==='user'?banTarget.id:null,p_ip:banType==='ip'?ip||null:null,p_device_id:banType==='device'?device||null:null,p_duration_minutes:duration==='Permanent'?null:(durations[duration]??1440),p_reason:banReason.trim()});if(error){const message=`Ban niet toegepast: ${error.message}`;setBanError(message);setNotice(message)}else{setBanTarget(null);setBanReason('');setBanError('');setNotice(`Ban toegepast en geaudit (${banType==='user'?'gebruiker':banType==='ip'?'IP '+ip:'apparaat '+device.slice(0,8)+'…'}, ${duration}).`);await load();if(selected)await loadModInfo(selected.id)}setBusy(false)}
  async function revokeBan(){if(!revokeTarget||revokeReason.trim().length<8)return;setBusy(true);const {error}=await staffDb().rpc('sx_staff_revoke_ban',{p_ban_id:revokeTarget.id,p_reason:revokeReason.trim()});if(error)setNotice(`Unban mislukt: ${error.message}`);else{setRevokeTarget(null);setRevokeReason('');setNotice('Ban ingetrokken en geaudit.');await load();if(selected)await loadModInfo(selected.id)}setBusy(false)}

  async function review(id: string, status: 'reviewing' | 'resolved' | 'dismissed') {
    setBusy(true);
    const { error } = await staffDb().rpc('sx_review_report', { p_report_id: id, p_status: status, p_note: notes[id]?.trim() || null });
    setBusy(false); setNotice(error?.message || 'Beslissing opgeslagen en vastgelegd in de auditlog.');
    if (!error) { setNotes(previous => { const next = { ...previous }; delete next[id]; return next; }); await load(); }
  }

  async function reportAction() {
    if (!actionTarget) return;
    const built = buildReportActionArgs(actionTarget.report, actionTarget.action, actionReason, actionTarget.action === 'ban_user' ? actionDuration : null);
    if (!built.ok) { setActionError(built.error); return; }
    setBusy(true); setActionError('');
    const { error } = await staffDb().rpc('sx_staff_report_action', built.args);
    setBusy(false);
    if (error) { setActionError(isMissingBackend(error) ? `Actie niet beschikbaar (${MIGRATION_HINT}).` : `Actie mislukt: ${error.message}`); return; }
    setActionTarget(null); setActionReason('');
    setNotice('Actie uitgevoerd, melding afgehandeld en gekoppeld in de auditlog.');
    await load();
  }

  const activeOwnerCount = (staffMembers || []).filter(m => m.roles.includes('OWNER') && !m.is_banned).length;
  const myId = session?.user.id || '';

  function changeRole(target: { id: string; username: string | null; roles: string[] }, role: StaffRoleName, grant: boolean) {
    const check = checkRoleChange({ actorId: myId, actorRoles: roles, targetId: target.id, targetRoles: target.roles, role, grant, activeOwnerCount });
    if (!check.ok) { setNotice(check.reason); return; }
    const self = target.id === myId;
    confirmDialog.ask({
      title: grant ? 'Rol toekennen' : self ? 'Ownerrol neerleggen' : 'Rol intrekken',
      message: grant ? `${STAFF_ROLE_LABEL[role]} geven aan @${target.username || target.id.slice(0, 8)}?`
        : self ? 'Je legt je eigen ownerrol neer. Er blijft minstens één andere actieve owner over. Dit wordt gelogd.'
        : `${STAFF_ROLE_LABEL[role]} intrekken bij @${target.username || target.id.slice(0, 8)}? Dit wordt vastgelegd in de auditlog.`,
      confirmLabel: grant ? 'Toekennen' : 'Intrekken', destructive: !grant,
    }, async () => {
      const { error } = await staffDb().rpc('sx_manage_staff_role', { p_user_id: target.id, p_role: role, p_grant: grant });
      if (error) return error.message;
      setNotice('Rolwijziging vastgelegd in de auditlog.');
      await load();
      if (self) await refresh();
      return null;
    });
  }

  async function grantByUsername(role: StaffRoleName) {
    if (!username.trim()) { setNotice('Vul eerst een exacte gebruikersnaam in.'); return; }
    const { data: person, error: lookupError } = await staffDb().from('profiles').select('id,username').eq('username', username.trim()).maybeSingle();
    if (lookupError || !person) { setNotice(lookupError?.message || 'Gebruiker niet gevonden.'); return; }
    const member = staffMembers?.find(m => m.user_id === person.id);
    changeRole({ id: person.id, username: person.username, roles: member?.roles || [] }, role, true);
  }

  if (ready && !session) return <Redirect href="/(auth)/login" />;
  if (loading) return <View style={s.center}><Text style={s.muted}>Staffrechten controleren…</Text></View>;
  if (!isStaff) return <View style={s.center}><Ionicons name="shield-checkmark-outline" size={38} color={s.color.accent} /><Text style={s.title}>Geen toegang</Text><Text style={s.muted}>Alleen aangewezen Snapshot X-staffleden kunnen dit paneel openen.</Text><Action label="Opnieuw controleren" onPress={() => void refresh()} /></View>;

  return <View style={[s.root, { paddingTop: insets.top }]}>
    <View style={[s.topbar, { gap: header.gap, paddingHorizontal: header.padding }]}>
      <View style={s.brand}><View style={s.brandMark}><Ionicons name="shield-checkmark" size={18} color="#fff" /></View><View style={s.brandText}><Text style={s.brandTitle} numberOfLines={1}>Snapshot X</Text><Text style={s.brandSub} numberOfLines={1}>STAFF CONSOLE</Text></View></View>
      {wideLayout && <View style={s.headerSearch}><Ionicons name="search-outline" size={16} color={s.color.muted} /><TextInput value={query} onChangeText={v => { setQuery(v); setSearchPage(0); }} onFocus={() => setSection('users')} placeholder="Zoek gebruiker of ID" placeholderTextColor={s.color.muted} style={s.headerSearchInput} autoCapitalize="none" /></View>}
      <Pressable onPress={() => setSection('reports')} style={s.headerIcon} accessibilityLabel="Meldingen openen"><Ionicons name="notifications-outline" size={19} color={s.color.text} />{openReports > 0 && <View style={s.notificationDot} />}</Pressable>
      <Pressable onPress={() => setSection('settings')} style={[s.staffProfile, header.profile === 'icon' && s.staffProfileIcon]} accessibilityRole="button" accessibilityLabel={`${roles[0] || 'Staff'} · ${session?.user.email || 'Snapshot X staff'} · instellingen`}>{header.profile === 'icon' ? <><Ionicons name="person-circle-outline" size={20} color={s.color.text} /><View style={[s.onlineDot, s.onlineDotIcon]} /></> : <><View style={s.onlineDot} /><View style={s.staffProfileText}><Text style={s.staffRole} numberOfLines={1}>{roles[0] || 'Staff'}</Text>{header.profile === 'full' && <Text style={s.staffEmail} numberOfLines={1}>{session?.user.email || 'Snapshot X staff'}</Text>}</View><Ionicons name="chevron-down" size={13} color={s.color.muted} /></>}</Pressable>
      <Pressable onPress={() => void load()} style={s.refresh} accessibilityLabel="Ververs staffgegevens"><Ionicons name="refresh" size={19} color={s.color.text} /></Pressable>
    </View>
    <View style={wideLayout ? s.wideBody : s.mobileBody}>
    {wideLayout ? <View style={s.sidebar}><Text style={s.sidebarLabel}>WERKRUIMTE</Text>{NAV.map(item => <Pressable key={item.id} onPress={() => setSection(item.id)} style={[s.navItem, s.sidebarItem, section === item.id && s.navActive]}><Ionicons name={item.icon} size={17} color={section === item.id ? s.color.accent : s.color.muted} /><Text style={[s.navText, section === item.id && s.navTextActive]}>{item.label}</Text>{item.id === 'reports' && openReports > 0 && <Text style={s.badge}>{openReports}</Text>}</Pressable>)}</View> : <EdgeScrollRow style={s.navScroll} contentContainerStyle={s.nav} activeKey={section} background={palette.bg} iconColor={s.color.text} items={NAV.map(item => ({ key: item.id, node: <Pressable onPress={() => setSection(item.id)} style={[s.navItem, section === item.id && s.navActive]}>
        <Ionicons name={item.icon} size={17} color={section === item.id ? s.color.accent : s.color.muted} /><Text style={[s.navText, section === item.id && s.navTextActive]}>{item.label}</Text>
        {item.id === 'reports' && openReports > 0 && <Text style={s.badge}>{openReports}</Text>}
      </Pressable> }))} />}
    <View style={wideLayout ? s.wideMain : s.mobileMain}>
    <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 28) + 12 }} keyboardShouldPersistTaps="handled">
      <View style={s.headingRow}><View><Text style={s.eyebrow}>BEVEILIGDE MODERATIE</Text><Text style={s.pageTitle}>{NAV.find(x => x.id === section)?.label}</Text></View><View style={s.datePill}><Ionicons name="lock-closed-outline" size={13} color={s.color.muted} /><Text style={s.dateText}>{isStaffMock()?'MOCK-backend':'Privé & afgeschermd'}</Text></View></View>
      {!!notice && <Pressable onPress={() => setNotice('')} style={s.notice}><Ionicons name="information-circle-outline" size={18} color={s.color.accent} /><Text style={s.noticeText}>{notice}</Text><Ionicons name="close" size={16} color={s.color.muted} /></Pressable>}
      {section === 'dashboard' && <>
        <View style={s.hero}><View style={s.heroCopy}><Text style={s.heroKicker}>SNAPSHOT X OPERATIONS</Text><Text style={s.heroTitle}>Goed dat je er bent.</Text><Text style={s.heroSub}>Moderatie en veiligheid, helder op één plek.</Text></View><View style={s.heroIcon}><Ionicons name="sparkles-outline" size={25} color={s.color.accent} /></View></View>
        <View style={s.statsGrid}><Stat icon="people-outline" label="Gebruikers" value={counts ? String(counts.users_total) : '—'} hint={counts ? `+${counts.users_new_7d} afgelopen 7 dagen` : `Telling niet beschikbaar (${MIGRATION_HINT})`} /><Stat icon="flag-outline" label="Open meldingen" value={String(openReports)} hint={counts ? `${counts.reports_reviewing} in review · ${counts.reports_24h} in 24 uur` : 'Uit geladen meldingen'} /><Stat icon="ban-outline" label="Actieve bans" value={String(counts ? counts.bans_active : banEntries.length)} hint={counts ? `${counts.bans_active_user} accounts · ${counts.warnings_30d} waarschuwingen (30 d)` : 'Uit geladen bans'} /><Stat icon="chatbubbles-outline" label="Gesprekken" value={String(counts ? counts.chats_total : chats.length)} hint="Redenplichtige inzage" /></View>
        <View style={s.card}><View style={s.cardHead}><Text style={s.cardTitle}>Recente meldingen</Text><Pressable onPress={() => setSection('reports')}><Text style={s.link}>Alles bekijken</Text></Pressable></View>{reports.slice(0, 4).map(r => <ReportRow key={r.id} report={r} onPress={() => { setOpenReport(r.id); setSection('reports'); }} />)}{!reports.length && <Empty text="Er staan nog geen meldingen in de wachtrij." />}</View>
        <View style={s.privacyCard}><Ionicons name="eye-off-outline" size={19} color={s.color.accent} /><View style={{ flex: 1 }}><Text style={s.cardTitle}>Privacybewuste toegang</Text><Text style={s.muted}>Elke chatopening is redenplichtig en komt met actor, doel, reden en tijd in de auditlog.</Text></View></View>
      </>}
      {section === 'users' && <>
        <Text style={s.sectionIntro}>Open een profiel voor login-, IP-, apparaat- en moderatiehistorie.</Text>
        <View style={s.search}><Ionicons name="search-outline" size={18} color={s.color.muted} /><TextInput value={query} onChangeText={v => { setQuery(v); setSearchPage(0); }} placeholder="Zoek gebruikersnaam, naam of ID-begin" placeholderTextColor={s.color.muted} style={s.searchInput} autoCapitalize="none" accessibilityLabel="Gebruikers zoeken" />{searching && <Text style={s.muted}>Zoeken…</Text>}</View>
        {searchFallback && <View style={s.infoBox}><Ionicons name="warning-outline" size={17} color={s.color.warning} /><Text style={s.muted}>Server-zoekfunctie niet beschikbaar ({MIGRATION_HINT}); je doorzoekt alleen de 100 nieuwste profielen.</Text></View>}
        <View style={s.tableLabel}><Text style={s.tableLabelText}>PROFIEL</Text><Text style={s.tableLabelText}>{searchPageInfo.total ? `${searchPageInfo.from}–${searchPageInfo.to} VAN ${searchPageInfo.total}` : 'AANGEMAAKT'}</Text></View>
        {people.map(person => <Pressable key={person.id} onPress={() => setSelected(person)} style={s.personRow}><View style={s.avatar}><Text style={s.avatarText}>{(person.display_name || person.username || '?').slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.personName}>{person.display_name || person.username || 'Onbekende gebruiker'} {person.is_verified && <Ionicons name="checkmark-circle" size={13} color={s.color.accent} />}</Text><Text style={s.muted}>@{person.username || 'geen-gebruikersnaam'} · {person.id.slice(0, 8)}…</Text></View>{person.is_banned && <View style={[s.status, s.statusBanned]}><Text style={s.statusText}>Geband</Text></View>}<Text style={s.personDate}>{person.created_at ? new Date(person.created_at).toLocaleDateString('nl-NL') : '—'}</Text><Ionicons name="chevron-forward" size={15} color={s.color.muted} /></Pressable>)}
        {!people.length && !searching && <Empty text="Geen gebruikers gevonden." />}
        {!searchFallback && searchPageInfo.pages > 1 && <View style={s.pager}><Action label="← Vorige" quiet disabled={!searchPageInfo.hasPrev || searching} onPress={() => setSearchPage(p => Math.max(0, p - 1))} /><Text style={s.muted}>Pagina {searchPageInfo.page + 1} van {searchPageInfo.pages}</Text><Action label="Volgende →" quiet disabled={!searchPageInfo.hasNext || searching} onPress={() => setSearchPage(p => p + 1)} /></View>}
        
      </>}
      {section==='moderation'&&(activeChat?<><View style={s.cardHead}><Action label="← Gesprekken" quiet disabled={busy} onPress={()=>{setActiveChat(null);setChatMessages([])}}/><Text style={s.muted}>{activeChat.member_count} deelnemers · geopend met auditlog</Text></View><View style={s.search}><Ionicons name="search-outline" size={18} color={s.color.muted}/><TextInput value={messageQuery} onChangeText={setMessageQuery} placeholder="Zoek berichten, type of afzender" placeholderTextColor={s.color.muted} style={s.searchInput} autoCapitalize="none"/></View>{filteredMessages.map(m=><View key={m.message_id} style={s.reportCard}><Text style={s.muted}>{m.sender_id.slice(0,8)}… · {new Date(m.created_at).toLocaleString('nl-NL')} · {m.kind}</Text><Text style={s.reportReason}>{m.is_deleted?'Verwijderd':m.body||'[media / geen tekst]'}</Text>{!m.is_deleted&&<Action label="Bericht verwijderen" quiet disabled={busy} onPress={()=>{setDeleteTarget(m);setDeleteReason('')}}/>}</View>)}{!filteredMessages.length&&<Empty text={chatMessages.length?'Geen berichten gevonden.':'Geen beschikbare berichten.'}/>}</>:<><Text style={s.sectionIntro}>Openen vraagt een reden; elke gespreksinzage wordt vastgelegd. Verlopen snaps worden niet getoond.</Text><View style={s.search}><Ionicons name="search-outline" size={18} color={s.color.muted}/><TextInput value={query} onChangeText={setQuery} placeholder="Zoek gesprek of ID" placeholderTextColor={s.color.muted} style={s.searchInput} autoCapitalize="none"/></View>{filteredChats.map(c=><Pressable key={c.thread_id} onPress={()=>{setChatPending(c);setChatReason('')}} style={s.personRow}><View style={s.avatar}><Ionicons name="chatbubbles-outline" size={18} color={s.color.accent}/></View><View style={{flex:1}}><Text style={s.personName}>{c.title||'Privégesprek'}</Text><Text style={s.muted}>{c.member_count} deelnemers · {c.thread_id.slice(0,10)}…</Text></View><Text style={s.personDate}>{c.last_message_at?new Date(c.last_message_at).toLocaleDateString('nl-NL'):'—'}</Text></Pressable>)}{!filteredChats.length&&<Empty text="Geen gesprekken gevonden."/>}</>)}
      {section === 'bans' && <><Text style={s.sectionIntro}>Actieve user-, IP- en devicebans. Unban vereist een reden en wordt gelogd.</Text>{banEntries.map(entry=>{const p=entry.target_user_id?profileNames.get(entry.target_user_id):null;const target=entry.ban_type==='user'?(p?`@${p.username||p.display_name}`:`User ${entry.target_user_id?.slice(0,8)}…`):entry.ban_type==='ip'?`IP ${entry.target_ip}`:`Device ${entry.target_device_id?.slice(0,8)}…`;return <View key={entry.id} style={s.reportCard}><View style={s.cardHead}><View><Text style={s.personName}>{target}</Text><Text style={s.muted}>{entry.ban_type.toUpperCase()} · door {(entry.issued_by||'onbekend').slice(0,8)}…</Text></View><Text style={s.statusText}>{entry.ends_at?'Tijdelijk':'Permanent'}</Text></View><Text style={s.reportReason}>{entry.reason}</Text><Text style={s.muted}>{new Date(entry.created_at).toLocaleString('nl-NL')}{entry.ends_at?` · verloopt ${new Date(entry.ends_at).toLocaleString('nl-NL')}`:''}</Text><Action label="Unban" quiet disabled={busy} onPress={()=>{setRevokeTarget(entry);setRevokeReason('')}}/></View>})}{!banEntries.length && <Empty text="Geen actieve bans of schorsingen gevonden." />}</>}
      {section === 'reports' && <><Text style={s.sectionIntro}>Meldingen beoordelen. Elke beslissing wordt server-side gecontroleerd en in het auditlog vastgelegd; acties vanuit een melding worden eraan gekoppeld.</Text>{reportsLegacy && <View style={[s.infoBox, { marginBottom: 12, marginTop: 0 }]}><Ionicons name="warning-outline" size={17} color={s.color.warning} /><Text style={s.muted}>Momentopnames en acties vanuit meldingen zijn nog niet beschikbaar ({MIGRATION_HINT}).</Text></View>}<View style={[s.durationRow,{paddingHorizontal:18,marginBottom:10}]}>{(['all','snap','story','highlight','chat','closed'] as const).map(f=><Pressable key={f} onPress={()=>setReportFilter(f)} style={[s.duration,reportFilter===f&&s.durationActive]}><Text style={[s.durationText,reportFilter===f&&s.durationTextActive]}>{f==='all'?`Open (${reports.filter(isReportOpen).length})`:f==='closed'?'Afgehandeld':`${REPORT_CATEGORY_LABEL[f]} (${reports.filter(r=>isReportOpen(r)&&reportCategory(r)===f).length})`}</Text></Pressable>)}</View>{reports.filter(r=>reportFilter==='closed'?!isReportOpen(r):isReportOpen(r)&&(reportFilter==='all'||reportCategory(r)===reportFilter)).map(report => <ReportCard key={report.id} report={report} expanded={openReport === report.id} onToggle={() => setOpenReport(id => id === report.id ? null : report.id)} profiles={profileNames} audit={audit} busy={busy} legacy={reportsLegacy} note={notes[report.id] || ''} onNote={value => setNotes(previous => ({ ...previous, [report.id]: value }))} onReview={status => void review(report.id, status)} onAction={action => { setActionTarget({ report, action }); setActionReason(''); setActionError(''); setActionDuration(1440); }} onOpenUser={id => { const p = profileNames.get(id); setSelected({ id, username: p?.username ?? null, display_name: p?.display_name ?? null, created_at: null, is_verified: null }); }} />)}{!reports.length && <Empty text="Geen meldingen ontvangen." />}</>}
      {section === 'logs' && <>{audit.map(entry => <View key={entry.id} style={s.logRow}><View style={s.logMark}><Ionicons name="shield-checkmark-outline" size={15} color={s.color.accent} /></View><View style={{ flex: 1 }}><Text style={s.personName}>{entry.action}</Text><Text style={s.muted}>{entry.entity_type || 'Systeem'} · door {entry.actor_id ? '#' + entry.actor_id.slice(0, 8) : 'onbekend'} · target {auditTargetLabel(entry, profileNames, banLookup)}{entry.metadata?.reason ? ` · ${String(entry.metadata.reason)}` : ''}</Text></View><Text style={s.logDate}>{new Date(entry.created_at).toLocaleString('nl-NL')}</Text></View>)}{!audit.length && <Empty text="Nog geen auditacties zichtbaar." />}</>}{section === 'settings' && <><View style={s.card}><Text style={s.cardTitle}>Staffrollen</Text><Text style={s.muted}>Jouw rechten: {roles.join(', ')}. Rolwijzigingen worden server-side gevalideerd.</Text></View>{isAdmin && <View style={s.card}><Text style={s.cardTitle}>Staffleden</Text><Text style={s.muted}>{isOwner ? 'Als owner beheer je admin, senior moderator en moderator. Je eigen ownerrol kun je alleen neerleggen als er nog een andere actieve owner is.' : 'Als admin beheer je de moderatorrol.'}</Text>
        {(staffMembers || []).map(m => <View key={m.user_id} style={s.memberRow}><View style={s.avatar}><Text style={s.avatarText}>{(m.display_name || m.username || '?').slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={s.personName}>{m.display_name || m.username || m.user_id.slice(0, 8)}{m.user_id === myId ? ' (jij)' : ''}{m.is_banned ? ' · geband' : ''}</Text><Text style={s.muted}>@{m.username || m.user_id.slice(0, 8)}</Text><View style={s.roleChips}>{sortRoles(m.roles).map(role => { const can = checkRoleChange({ actorId: myId, actorRoles: roles, targetId: m.user_id, targetRoles: m.roles, role, grant: false, activeOwnerCount }).ok; return <View key={role} style={s.roleChip}><Text style={s.roleChipText}>{STAFF_ROLE_LABEL[role]}</Text>{can && <Pressable disabled={busy} onPress={() => changeRole({ id: m.user_id, username: m.username, roles: m.roles }, role, false)} accessibilityLabel={`${STAFF_ROLE_LABEL[role]} intrekken bij ${m.username || m.user_id}`}><Text style={s.roleRevoke}>{m.user_id === myId ? 'Neerleggen' : 'Intrekken'}</Text></Pressable>}</View>; })}</View></View></View>)}
        {staffMembers && !staffMembers.length && <Text style={s.muted}>Geen staffleden gevonden.</Text>}
        </View>}
        {isAdmin && <View style={s.card}><Text style={s.cardTitle}>Rol toekennen</Text><Text style={s.muted}>Toekennen kan voor: {grantableRoles(roles).map(r => STAFF_ROLE_LABEL[r]).join(', ')}. Owner wordt niet via de console toegekend.</Text><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Exacte gebruikersnaam" placeholderTextColor={s.color.muted} style={s.noteInput} /><View style={s.actions}>{grantableRoles(roles).map(role => <Action key={role} label={`${STAFF_ROLE_LABEL[role]} geven`} quiet={role !== 'MODERATOR'} disabled={busy || confirmDialog.busy} onPress={() => void grantByUsername(role)} />)}</View></View>}<View style={s.infoBox}><Ionicons name="information-circle-outline" size={17} color={s.color.accent} /><Text style={s.muted}>Loginmomenten, IP en een willekeurige app-installatie-ID worden voor moderatiehistorie vastgelegd. Alleen bevoegde staffrollen kunnen deze gegevens inzien.</Text></View></>}
    </ScrollView>
    </View>
    </View>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={()=>setSelected(null)}><Pressable style={s.modalShade} onPress={()=>setSelected(null)}><Pressable style={s.modalCard} onPress={e=>e.stopPropagation()}>{shownProfile&&<><View style={s.modalHead}><Text style={s.cardTitle}>Gebruikersprofiel</Text><Pressable onPress={()=>setSelected(null)} accessibilityLabel="Profiel sluiten"><Ionicons name="close" size={22} color={s.color.muted}/></Pressable></View><View style={s.profileHero}><View style={[s.avatar,s.bigAvatar]}><Text style={s.avatarText}>{(shownProfile.display_name||shownProfile.username||'?').slice(0,1).toUpperCase()}</Text></View><View><Text style={s.personName}>{shownProfile.display_name||shownProfile.username||'Gebruiker'}</Text><Text style={s.muted}>{shownProfile.username?`@${shownProfile.username}`:'Gebruikersnaam niet beschikbaar'}</Text></View></View><Detail label="ID" value={shownProfile.id||'—'}/><Detail label="Status" value={banEntries.some(b=>b.ban_type==='user'&&b.target_user_id===shownProfile.id)?`Geblokkeerd · ${banEntries.find(b=>b.ban_type==='user'&&b.target_user_id===shownProfile.id)?.ends_at?'tijdelijk tot '+new Date(banEntries.find(b=>b.ban_type==='user'&&b.target_user_id===shownProfile.id)!.ends_at!).toLocaleString('nl-NL'):'permanent'}`:shownProfile.is_verified?'Geverifieerd':'Actief'}/>{modInfo&&modInfo.userId===shownProfile.id&&<><Detail label="Waarschuwingen" value={String(modInfo.warnings)}/><Detail label="Snapshot X+" value={modInfo.plus?`Actief (${modInfo.plus_source==='staff'?'door staff toegekend':modInfo.plus_source==='app_store'?'App Store':modInfo.plus_source==='play'?'Google Play':modInfo.plus_source||'—'})`:'Geen abonnement'}/></>}<Detail label="Aangemaakt" value={shownProfile.created_at?new Date(shownProfile.created_at).toLocaleString('nl-NL'):'—'}/><Text style={s.cardTitle}>Loginhistorie</Text><ScrollView style={{maxHeight:190}}>{userLoginEvents.map(e=><View key={e.id} style={s.detail}><Text style={s.personName}>{new Date(e.logged_at).toLocaleString('nl-NL')}</Text><Text style={s.muted}>IP: {e.ip_address||'niet beschikbaar'}</Text><Text style={s.muted}>Device ID: {e.device_id}</Text><Text style={s.muted}>{e.device_label||e.user_agent||'Onbekend apparaat'}</Text></View>)}{!userLoginEvents.length&&<Text style={s.muted}>Nog geen loginregistraties.</Text>}</ScrollView><Text style={s.cardTitle}>IP-historie</Text>{Array.from(new Set(userLoginEvents.map(e=>e.ip_address).filter((ip):ip is string=>!!ip))).map(ip=><Detail key={ip} label="IP-adres" value={ip}/>)}{!userLoginEvents.some(e=>e.ip_address)&&<Text style={s.muted}>Geen IP-adressen geregistreerd.</Text>}<Text style={s.cardTitle}>Apparaathistorie</Text>{Array.from(new Map(userLoginEvents.map(e=>[e.device_id,e])).values()).map(e=><Detail key={e.device_id} label={e.device_label||'Apparaat'} value={`${e.device_id} · laatst gezien ${new Date(e.logged_at).toLocaleString('nl-NL')}`}/>)}{!userLoginEvents.length&&<Text style={s.muted}>Geen apparaten geregistreerd.</Text>}<Text style={s.cardTitle}>Recente staffacties</Text>{shownUserActions.map(a=><View key={a.id} style={s.detail}><Text style={s.personName}>{a.action}</Text><Text style={s.muted}>{formatStaffTime(a.created_at)} · {a.entity_type||"moderatie"} · target {auditTargetLabel(a,profileNames,banLookup)}</Text></View>)}{!shownUserActions.length&&<Text style={s.muted}>Geen bijbehorende acties gevonden.</Text>}<View style={s.actions}><Action label="Waarschuwen" quiet disabled={busy||shownProfile.id===myId} onPress={()=>{setUserAct({kind:'warn',person:shownProfile});setUserActReason('');setUserActError('')}}/>{isAdmin?(modInfo?.userId===shownProfile.id&&modInfo.plus_source==='staff'?<Action label="X+ intrekken" quiet disabled={busy} onPress={()=>{setUserAct({kind:'plus_revoke',person:shownProfile});setUserActReason('');setUserActError('')}}/>:<Action label="X+ toekennen" quiet disabled={busy||!!modInfo?.plus} onPress={()=>{setUserAct({kind:'plus_grant',person:shownProfile});setUserActReason('');setUserActDays(30);setUserActError('')}}/>):<Text style={s.muted}>X+ beheren: alleen admin/owner.</Text>}</View><Action label="Banopties" disabled={busy} onPress={()=>{setBanTarget(shownProfile);setBanType('user');setBanReason('');setTargetIp('');setTargetDevice('');setBanError('')}}/></>}</Pressable></Pressable></Modal>
    <Modal visible={!!banTarget} transparent animationType="fade" onRequestClose={()=>setBanTarget(null)}><View style={s.modalShade}><View style={s.modalCard}><View style={s.modalHead}><Text style={s.cardTitle}>Ban bevestigen</Text><Pressable onPress={()=>setBanTarget(null)} accessibilityLabel="Sluiten"><Ionicons name="close" size={22} color={s.color.muted}/></Pressable></View><Text style={s.muted}>Target: @{banTarget?.username||banTarget?.id.slice(0,8)}</Text><View style={s.durationRow}>{(['user','ip','device'] as const).map(t=><Pressable key={t} onPress={()=>{setBanType(t);setBanError('')}} style={[s.duration,banType===t&&s.durationActive]}><Text style={[s.durationText,banType===t&&s.durationTextActive]}>{t==='user'?'Gebruiker':t==='ip'?'IP':'Apparaat'}</Text></Pressable>)}</View>{banType==='ip'&&<TextInput value={targetIp} onChangeText={setTargetIp} keyboardType="numbers-and-punctuation" autoCapitalize="none" placeholder="IP-adres invoeren of hieronder kiezen" placeholderTextColor={s.color.muted} style={s.noteInput}/>}{banType==='device'&&<TextInput value={targetDevice} onChangeText={setTargetDevice} autoCapitalize="none" placeholder="Device-ID invoeren of hieronder kiezen" placeholderTextColor={s.color.muted} style={s.noteInput}/>}{banType==='ip'&&Array.from(new Set(userLoginEvents.map(e=>e.ip_address).filter((ip):ip is string=>!!ip))).map(ip=><Pressable key={ip} onPress={()=>setTargetIp(ip)} style={[s.duration,targetIp===ip&&s.durationActive]}><Text style={s.durationText}>{ip}</Text></Pressable>)}{banType==='device'&&Array.from(new Map(userLoginEvents.map(e=>[e.device_id,e])).values()).map(e=><Pressable key={e.device_id} onPress={()=>setTargetDevice(e.device_id)} style={[s.duration,targetDevice===e.device_id&&s.durationActive]}><Text style={s.durationText}>{e.device_label||'Apparaat'} · {e.device_id.slice(0,8)}…</Text></Pressable>)}<View style={s.durationRow}>{['1 uur','24 uur','7 dagen','30 dagen','Permanent'].map(v=><Pressable key={v} onPress={()=>setDuration(v)} style={[s.duration,duration===v&&s.durationActive]}><Text style={[s.durationText,duration===v&&s.durationTextActive]}>{v}</Text></Pressable>)}</View><TextInput value={banReason} onChangeText={setBanReason} maxLength={1000} placeholder="Reden (minimaal 8 tekens)" placeholderTextColor={s.color.muted} style={s.noteInput}/>{banType==='device'&&!!targetDevice.trim()&&!isUuid(targetDevice)&&<Text style={s.errorText}>Device-ID moet een UUID zijn (8-4-4-4-12 hex).</Text>}{!!banError&&<Text style={s.errorText} accessibilityRole="alert">{banError}</Text>}<Text style={s.muted}>Actie wordt pas bevestigd na serverantwoord; audit bevat actor, target, type, reden, duur en oude/nieuwe status.</Text><Action label={busy?'Toepassen…':'Ban bevestigen'} disabled={busy||banReason.trim().length<8||(banType==='ip'&&!targetIp)||(banType==='device'&&!targetDevice)} onPress={()=>void createBan()}/></View></View></Modal>
    <Modal visible={!!chatPending} transparent animationType="fade" onRequestClose={()=>setChatPending(null)}><View style={s.modalShade}><View style={s.modalCard}><Text style={s.cardTitle}>Gesprek openen</Text><Text style={s.muted}>{chatPending?.title||'Privégesprek'} · auditplichtig</Text><TextInput value={chatReason} onChangeText={setChatReason} maxLength={1000} placeholder="Reden voor inzage (min. 10 tekens)" placeholderTextColor={s.color.muted} style={s.noteInput}/><View style={s.actions}><Action label="Annuleren" quiet disabled={busy} onPress={()=>setChatPending(null)}/><Action label={busy?'Openen…':'Bevestigen en openen'} disabled={busy||chatReason.trim().length<10} onPress={()=>void openChat()}/></View></View></View></Modal>
    <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={()=>setDeleteTarget(null)}><View style={s.modalShade}><View style={s.modalCard}><Text style={s.cardTitle}>Bericht verwijderen</Text><TextInput value={deleteReason} onChangeText={setDeleteReason} maxLength={1000} placeholder="Reden (min. 8 tekens)" placeholderTextColor={s.color.muted} style={s.noteInput}/><View style={s.actions}><Action label="Annuleren" quiet disabled={busy} onPress={()=>setDeleteTarget(null)}/><Action label={busy?'Verwijderen…':'Verwijderen'} disabled={busy||deleteReason.trim().length<8} onPress={()=>void removeMessage()}/></View></View></View></Modal>
    <Modal visible={!!revokeTarget} transparent animationType="fade" onRequestClose={()=>setRevokeTarget(null)}><View style={s.modalShade}><View style={s.modalCard}><Text style={s.cardTitle}>Unban bevestigen</Text><Text style={s.muted}>{revokeTarget?.ban_type} · {revokeTarget?.target_ip||revokeTarget?.target_user_id||revokeTarget?.target_device_id}</Text><TextInput value={revokeReason} onChangeText={setRevokeReason} maxLength={1000} placeholder="Reden voor unban (min. 8 tekens)" placeholderTextColor={s.color.muted} style={s.noteInput}/><View style={s.actions}><Action label="Annuleren" quiet disabled={busy} onPress={()=>setRevokeTarget(null)}/><Action label={busy?'Unban…':'Unban bevestigen'} disabled={busy||revokeReason.trim().length<8} onPress={()=>void revokeBan()}/></View></View></View></Modal>
    <Modal visible={!!actionTarget} transparent animationType="fade" onRequestClose={()=>setActionTarget(null)}><View style={s.modalShade}><View style={s.modalCard}>{actionTarget&&(()=>{const who=nameOf(profileNames.get(actionTarget.report.reported_user_id||''),actionTarget.report.reported_user_id);const durationLabel=BAN_DURATIONS.find(d=>d.minutes===actionDuration)?.label;const copy=actionConfirmText(actionTarget.action,who,durationLabel);return <><View style={s.modalHead}><Text style={s.cardTitle}>{copy.title}</Text><Pressable onPress={()=>setActionTarget(null)} accessibilityLabel="Sluiten"><Ionicons name="close" size={22} color={s.color.muted}/></Pressable></View><Text style={s.muted}>{copy.message}</Text>{actionTarget.action==='ban_user'&&<View style={s.durationRow}>{BAN_DURATIONS.map(d=><Pressable key={d.label} onPress={()=>setActionDuration(d.minutes)} style={[s.duration,actionDuration===d.minutes&&s.durationActive]}><Text style={[s.durationText,actionDuration===d.minutes&&s.durationTextActive]}>{d.label}</Text></Pressable>)}</View>}<TextInput value={actionReason} onChangeText={v=>{setActionReason(v);setActionError('')}} maxLength={1000} placeholder={`Reden (min. ${MIN_ACTION_REASON} tekens, zichtbaar in de auditlog)`} placeholderTextColor={s.color.muted} style={s.noteInput}/>{!!actionError&&<Text style={s.errorText} accessibilityRole="alert">{actionError}</Text>}<View style={s.actions}><Action label="Annuleren" quiet disabled={busy} onPress={()=>setActionTarget(null)}/><Action label={busy?'Uitvoeren…':'Bevestigen'} danger={copy.destructive} disabled={busy||actionReason.trim().length<MIN_ACTION_REASON} onPress={()=>void reportAction()}/></View></>})()}</View></View></Modal>
    <Modal visible={!!userAct} transparent animationType="fade" onRequestClose={()=>setUserAct(null)}><View style={s.modalShade}><View style={s.modalCard}>{userAct&&<><View style={s.modalHead}><Text style={s.cardTitle}>{userAct.kind==='warn'?'Waarschuwing bevestigen':userAct.kind==='plus_grant'?'X+ toekennen':'X+ intrekken'}</Text><Pressable onPress={()=>setUserAct(null)} accessibilityLabel="Sluiten"><Ionicons name="close" size={22} color={s.color.muted}/></Pressable></View><Text style={s.muted}>Target: @{userAct.person.username||userAct.person.id.slice(0,8)} · {userAct.kind==='warn'?'de gebruiker ziet de waarschuwing bij de volgende start.':userAct.kind==='plus_grant'?'gratis Snapshot X+ (bron: staff), niet automatisch verlengd.':'alleen staff-toekenningen; store-abonnementen blijven ongemoeid.'}</Text>{userAct.kind==='plus_grant'&&<View style={s.durationRow}>{[{l:'7 dagen',d:7},{l:'30 dagen',d:30},{l:'1 jaar',d:365},{l:'Onbeperkt',d:null}].map(o=><Pressable key={o.l} onPress={()=>setUserActDays(o.d)} style={[s.duration,userActDays===o.d&&s.durationActive]}><Text style={[s.durationText,userActDays===o.d&&s.durationTextActive]}>{o.l}</Text></Pressable>)}</View>}<TextInput value={userActReason} onChangeText={v=>{setUserActReason(v);setUserActError('')}} maxLength={1000} placeholder="Reden (min. 8 tekens, zichtbaar in de auditlog)" placeholderTextColor={s.color.muted} style={s.noteInput}/>{!!userActError&&<Text style={s.errorText} accessibilityRole="alert">{userActError}</Text>}<View style={s.actions}><Action label="Annuleren" quiet disabled={busy} onPress={()=>setUserAct(null)}/><Action label={busy?'Uitvoeren…':'Bevestigen'} danger={userAct.kind!=='plus_grant'} disabled={busy||userActReason.trim().length<8} onPress={()=>void runUserAct()}/></View></>}</View></View></Modal>
    {confirmDialog.dialog}
  </View>;
}

function Stat({ icon, label, value, hint }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; hint: string }) {
  return <View style={s.stat}><View style={s.statHead}><View style={s.statIcon}><Ionicons name={icon} size={17} color={s.color.accent} /></View><Text style={s.statLabel}>{label}</Text></View><Text style={s.statValue}>{value}</Text><Text style={s.statHint}>{hint}</Text></View>;
}
function ReportRow({ report, onPress }: { report: Report; onPress?: () => void }) {
  return <Pressable onPress={onPress} style={s.reportRow}><View style={s.reportIcon}><Ionicons name={report.story_id || report.content_snapshot?.type === 'story' ? 'images-outline' : 'chatbubble-ellipses-outline'} size={16} color={s.color.accent} /></View><View style={{ flex: 1 }}><Text style={s.personName}>{REPORT_CATEGORY_LABEL[reportCategory(report)]}melding</Text><Text style={s.muted} numberOfLines={1}>{report.reason} · {new Date(report.created_at).toLocaleDateString('nl-NL')}</Text></View><View style={[s.status, isReportOpen(report) ? s.statusOpen : s.statusDone]}><Text style={s.statusText}>{reportOutcomeLabel(report)}</Text></View></Pressable>;
}
function ReportCard({ report, expanded, onToggle, profiles, audit, busy, legacy, note, onNote, onReview, onAction, onOpenUser }: { report: Report; expanded: boolean; onToggle: () => void; profiles: Map<string, ProfileName>; audit: Audit[]; busy: boolean; legacy: boolean; note: string; onNote: (v: string) => void; onReview: (status: 'reviewing' | 'resolved' | 'dismissed') => void; onAction: (a: ReportAction) => void; onOpenUser: (id: string) => void }) {
  const snap = describeSnapshot(report);
  const open = isReportOpen(report);
  const linked = audit.filter(a => auditLinkedToReport(a, report.id));
  const reported = report.reported_user_id ? profiles.get(report.reported_user_id) : undefined;
  return <View style={s.reportCard}>
    <ReportRow report={report} onPress={onToggle} />
    <Text style={s.reportReason}>{report.reason}</Text>
    <Text style={s.muted}>Melder {nameOf(profiles.get(report.reporter_id), report.reporter_id)} · {new Date(report.created_at).toLocaleString('nl-NL')}</Text>
    {!legacy && <View style={s.reportedUser}><Ionicons name="person-circle-outline" size={18} color={s.color.accent} /><View style={{ flex: 1 }}><Text style={s.muted}>Gemelde gebruiker</Text><Text style={s.personName}>{report.reported_user_id ? `${reported?.display_name || ''} ${nameOf(reported, report.reported_user_id)}`.trim() : 'Onbekend'}</Text></View>{!!report.reported_user_id && <Action label="Profiel" quiet onPress={() => onOpenUser(report.reported_user_id!)} />}</View>}
    {!legacy && <View style={s.snapshot}><Text style={s.snapshotTitle}>{snap.title.toUpperCase()} · MOMENTOPNAME</Text>{snap.text ? <Text style={s.snapshotText}>“{snap.text}”</Text> : !snap.missing && <Text style={s.muted}>Geen tekst</Text>}{!!snap.media && <Text style={s.muted}><Ionicons name="image-outline" size={12} color={s.color.muted} /> {snap.media}</Text>}{snap.meta.map(m => <Text key={m} style={s.muted}>{m}</Text>)}</View>}
    {report.review_note && <Text style={s.noteText}>Notitie: {report.review_note}</Text>}
    {open && <>
      <TextInput value={note} onChangeText={onNote} maxLength={1000} placeholder="Interne notitie (optioneel)" placeholderTextColor={s.color.muted} style={s.noteInput} />
      <View style={s.actions}><Action label="In behandeling nemen" quiet disabled={busy || report.status === 'reviewing'} onPress={() => onReview('reviewing')} /><Action label="Afhandelen zonder actie" quiet disabled={busy} onPress={() => onReview('resolved')} /><Action label="Afwijzen" quiet disabled={busy} onPress={() => onReview('dismissed')} /></View>
      {!legacy && <><Text style={s.actionHead}>ACTIE ONDERNEMEN</Text><View style={s.actions}>{reportActions(report).map(a => <Action key={a.action} label={a.label} danger={a.action !== 'warn'} disabled={busy || !a.enabled} onPress={() => onAction(a.action)} />)}</View>{reportActions(report).filter(a => !a.enabled && a.why).slice(0, 1).map(a => <Text key={a.action} style={s.muted}>{a.why}</Text>)}</>}
    </>}
    {(expanded || !open) && linked.length > 0 && <View style={s.linkedAudit}><Text style={s.actionHead}>AUDITSPOOR</Text>{linked.map(a => <Text key={a.id} style={s.muted}>{formatStaffTime(a.created_at)} · {a.action}{a.metadata?.reason ? ` · ${String(a.metadata.reason)}` : ''}</Text>)}</View>}
  </View>;
}
function Action({ label, onPress, quiet, danger, disabled }: { label: string; onPress: () => void; quiet?: boolean; danger?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" style={[s.action, quiet && s.actionQuiet, danger && s.actionDanger, disabled && s.actionDisabled]}><Text style={[s.actionText, quiet && s.actionQuietText]}>{label}</Text></Pressable>;
}
function Empty({ text }: { text: string }) { return <View style={s.empty}><Ionicons name="file-tray-outline" size={22} color={s.color.muted} /><Text style={s.muted}>{text}</Text></View>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={s.detail}><Text style={s.muted}>{label}</Text><Text style={s.detailValue}>{value}</Text></View>; }

const palette = { bg: '#0B1018', surface: '#111925', elevated: '#182332', border: '#243244', text: '#F1F5F9', muted: '#94A3B8', accent: '#F6C445', accentDim: '#332B16', warning: '#F0A34B' };
const s = StyleSheet.create({
  color: palette as any,
  root: { flex: 1, backgroundColor: palette.bg }, center: { flex: 1, backgroundColor: palette.bg, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 28 },
  topbar: { height: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: palette.border, gap: 12 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }, brandText: { flexShrink: 1, minWidth: 0 }, brandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#D9A91D', alignItems: 'center', justifyContent: 'center' }, brandTitle: { color: palette.text, fontWeight: '900', letterSpacing: 1.2, fontSize: 15 }, brandSub: { color: palette.muted, fontWeight: '800', letterSpacing: 1.3, fontSize: 8, marginTop: 2 }, staffChip: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 20, backgroundColor: palette.surface }, onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#45D483' }, staffRole: { color: palette.muted, fontSize: 10, fontWeight: '700', maxWidth: 100 }, headerSearch: { maxWidth: 250, flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, headerSearchInput: { color: palette.text, flex: 1, padding: 0, fontSize: 11 }, headerIcon: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', position: 'relative' }, notificationDot: { position: 'absolute', right: 7, top: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F06D6D' }, staffProfile: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: palette.surface, maxWidth: 160, flexShrink: 0 }, staffProfileIcon: { width: 36, height: 36, paddingHorizontal: 0, paddingVertical: 0, justifyContent: 'center', position: 'relative' }, staffProfileText: { flexShrink: 1, minWidth: 0 }, onlineDotIcon: { position: 'absolute', right: 6, bottom: 7, borderWidth: 1, borderColor: palette.surface }, staffEmail: { color: palette.muted, fontSize: 8, marginTop: 2, maxWidth: 110 }, refresh: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  wideBody: { flex: 1, flexDirection: 'row' }, mobileBody: { flex: 1 }, sidebar: { width: 184, paddingHorizontal: 12, paddingTop: 20, borderRightWidth: 1, borderColor: palette.border, backgroundColor: '#0D141E' }, sidebarLabel: { color: palette.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginLeft: 10, marginBottom: 12 }, sidebarItem: { marginBottom: 4, minHeight: 43 }, wideMain: { flex: 1, minWidth: 0 }, mobileMain: { flex: 1 }, navScroll: { maxHeight: 55, flexGrow: 0, borderBottomWidth: 1, borderColor: palette.border }, nav: { paddingHorizontal: 12, gap: 7, alignItems: 'center' }, navItem: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, paddingHorizontal: 10 }, navActive: { backgroundColor: palette.accentDim }, navText: { color: palette.muted, fontSize: 11, fontWeight: '700' }, navTextActive: { color: palette.accent }, badge: { color: '#111', backgroundColor: palette.accent, minWidth: 17, textAlign: 'center', borderRadius: 9, overflow: 'hidden', fontWeight: '900', fontSize: 10, paddingHorizontal: 3 },
  content: { flex: 1 }, headingRow: { paddingHorizontal: 20, paddingTop: 23, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, eyebrow: { color: palette.accent, fontWeight: '900', letterSpacing: 1.4, fontSize: 9 }, pageTitle: { color: palette.text, fontSize: 26, fontWeight: '800', marginTop: 4 }, datePill: { flexDirection: 'row', gap: 5, alignItems: 'center', borderColor: palette.border, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 18 }, dateText: { color: palette.muted, fontSize: 9, fontWeight: '600' }, notice: { marginHorizontal: 18, marginBottom: 13, padding: 11, backgroundColor: palette.elevated, borderRadius: 11, borderWidth: 1, borderColor: palette.border, flexDirection: 'row', gap: 9, alignItems: 'center' }, noticeText: { color: palette.text, fontSize: 12, flex: 1 },
  hero: { marginHorizontal: 18, borderRadius: 17, padding: 18, backgroundColor: '#182333', borderWidth: 1, borderColor: '#29394C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroCopy: { flex: 1 }, heroKicker: { color: palette.accent, fontWeight: '900', fontSize: 9, letterSpacing: 1.4 }, heroTitle: { color: palette.text, fontSize: 21, fontWeight: '800', marginTop: 7 }, heroSub: { color: palette.muted, fontSize: 11, marginTop: 5 }, heroIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: palette.accentDim, alignItems: 'center', justifyContent: 'center' }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 13, paddingTop: 10 }, stat: { width: '50%', padding: 6 }, statHead: { borderTopLeftRadius: 13, borderTopRightRadius: 13, padding: 12, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 8 }, statIcon: { width: 29, height: 29, borderRadius: 9, backgroundColor: palette.accentDim, alignItems: 'center', justifyContent: 'center' }, statLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' }, statValue: { color: palette.text, backgroundColor: palette.surface, fontSize: 23, fontWeight: '800', paddingHorizontal: 12 }, statHint: { color: palette.muted, backgroundColor: palette.surface, fontSize: 9, paddingHorizontal: 12, paddingTop: 3, paddingBottom: 12, borderBottomLeftRadius: 13, borderBottomRightRadius: 13 },
  card: { marginHorizontal: 18, marginTop: 12, padding: 14, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }, cardTitle: { color: palette.text, fontSize: 14, fontWeight: '800' }, link: { color: palette.accent, fontSize: 11, fontWeight: '700' }, muted: { color: palette.muted, fontSize: 11, lineHeight: 17 }, title: { color: palette.text, fontSize: 18, fontWeight: '800' }, privacyCard: { marginHorizontal: 18, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: palette.accentDim, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reportRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderColor: palette.border, paddingVertical: 8 }, reportIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: palette.accentDim, alignItems: 'center', justifyContent: 'center' }, personName: { color: palette.text, fontWeight: '700', fontSize: 12 }, status: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 10 }, statusOpen: { backgroundColor: '#422A19' }, statusDone: { backgroundColor: '#1D332D' }, statusText: { color: palette.text, fontSize: 9, fontWeight: '800' },
  sectionIntro: { color: palette.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 20, marginBottom: 12 }, search: { marginHorizontal: 18, paddingHorizontal: 12, height: 43, borderRadius: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, flexDirection: 'row', alignItems: 'center', gap: 8 }, searchInput: { color: palette.text, flex: 1, fontSize: 12 }, tableLabel: { paddingHorizontal: 21, paddingTop: 18, paddingBottom: 7, flexDirection: 'row', justifyContent: 'space-between' }, tableLabelText: { color: palette.muted, fontSize: 8, letterSpacing: 1, fontWeight: '900' }, personRow: { paddingHorizontal: 19, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderColor: palette.border }, avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#29394C', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: palette.accent, fontSize: 14, fontWeight: '800' }, personDate: { color: palette.muted, fontSize: 9, marginRight: 4 }, infoBox: { marginHorizontal: 18, marginTop: 13, padding: 12, borderRadius: 11, backgroundColor: '#2B2417', flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  emptyPanel: { alignItems: 'center', marginHorizontal: 18, marginTop: 30, padding: 23, borderRadius: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: 12 }, lockCircle: { width: 53, height: 53, borderRadius: 18, backgroundColor: palette.accentDim, alignItems: 'center', justifyContent: 'center' }, empty: { alignItems: 'center', justifyContent: 'center', gap: 9, padding: 26 }, reportCard: { marginHorizontal: 18, marginBottom: 10, padding: 13, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border }, reportReason: { color: palette.text, fontSize: 13, fontWeight: '700', marginTop: 9, marginBottom: 5 }, noteText: { color: palette.muted, fontSize: 11, marginTop: 6 }, noteInput: { minHeight: 40, color: palette.text, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border, marginTop: 9, fontSize: 11 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }, action: { minHeight: 34, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: palette.accent }, actionQuiet: { backgroundColor: palette.elevated, borderWidth: 1, borderColor: palette.border }, actionDisabled: { opacity: 0.48 }, actionText: { color: '#17140D', fontWeight: '800', fontSize: 10 }, actionQuietText: { color: palette.text },
  logRow: { marginHorizontal: 19, paddingVertical: 13, borderBottomWidth: 1, borderColor: palette.border, flexDirection: 'row', gap: 10, alignItems: 'center' }, logMark: { width: 31, height: 31, backgroundColor: palette.accentDim, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, logDate: { color: palette.muted, fontSize: 9, maxWidth: 100, textAlign: 'right' },
  errorText: { color: '#F06D6D', fontSize: 11, fontWeight: '700', lineHeight: 16 },
  statusBanned: { backgroundColor: '#4A1E24', marginRight: 6 }, pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12 },
  actionDanger: { backgroundColor: '#F06D6D' }, actionHead: { color: palette.muted, fontSize: 8, letterSpacing: 1, fontWeight: '900', marginTop: 12 },
  reportedUser: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 9, borderRadius: 10, backgroundColor: palette.elevated },
  snapshot: { marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: palette.border, borderLeftWidth: 3, borderLeftColor: palette.accent, gap: 3 },
  snapshotTitle: { color: palette.accent, fontSize: 8, letterSpacing: 1, fontWeight: '900' }, snapshotText: { color: palette.text, fontSize: 13, lineHeight: 19 },
  linkedAudit: { marginTop: 4, gap: 2 }, memberRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: palette.border },
  roleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, roleChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: palette.accentDim },
  roleChipText: { color: palette.accent, fontSize: 10, fontWeight: '800' }, roleRevoke: { color: '#F06D6D', fontSize: 10, fontWeight: '800' },
  modalShade: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#000B' }, modalCard: { backgroundColor: palette.surface, borderRadius: 18, padding: 17, borderWidth: 1, borderColor: palette.border, gap: 10 }, modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, profileHero: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 }, bigAvatar: { width: 50, height: 50, borderRadius: 16 }, detail: { paddingVertical: 7, borderBottomWidth: 1, borderColor: palette.border, gap: 3 }, detailValue: { color: palette.text, fontSize: 11 }, durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, duration: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.elevated }, durationActive: { borderColor: palette.accent, backgroundColor: palette.accentDim }, durationText: { color: palette.muted, fontSize: 10 }, durationTextActive: { color: palette.accent, fontWeight: '800' },
});
