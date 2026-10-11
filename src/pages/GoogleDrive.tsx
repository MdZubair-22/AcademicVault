import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Cloud, CloudOff, Database, Download, HardDrive, Loader2, MessageSquare, Pause, RefreshCw, ShieldCheck, Sparkles, UploadCloud, X, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import {
  cancelDriveOperation,
  connectGoogleDrive,
  disconnectGoogleDrive,
  getBackupSummary,
  getDriveStorageInfo,
  getGoogleDriveStatus,
  initializeGoogleDrive,
  handleGoogleDriveRedirect,
  restoreAcademicVault,
  syncAcademicVault,
  type DriveProgress,
  type BackupSummary,
  type DriveStorageInfo,
} from '../lib/googleDrive';

const emptyProgress: DriveProgress = { phase: 'sync', status: 'preparing', percent: 0, total: 0, current: 0, currentName: '', uploaded: 0, restored: 0, skipped: 0, duplicates: 0, failed: 0 };
const formatBytes = (bytes: number) => { if (!bytes) return '0 B'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** i).toFixed(i ? 2 : 0)} ${units[i]}`; };
const formatDate = (value?: string) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never synced';

export default function GoogleDrive() {
  const [connected, setConnected] = useState(false); const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [progress, setProgress] = useState<DriveProgress>(emptyProgress); const [backup, setBackup] = useState<BackupSummary | null>(null); const [storage, setStorage] = useState<DriveStorageInfo | null>(null);

  const refresh = useCallback(async () => {
    const status = getGoogleDriveStatus(); setConnected(status.connected); setEmail(status.email);
    if (!status.connected) return;
    try { const [b, s] = await Promise.all([getBackupSummary(), getDriveStorageInfo()]); setBackup(b); setStorage(s); } catch {}
  }, []);

  useEffect(() => { (async () => { try { await initializeGoogleDrive(); const redirected = await handleGoogleDriveRedirect(); if (redirected) { setMessage('Google Drive connected successfully.'); } } catch (e: any) { if (e?.message) setError(e.message); } await refresh(); })(); }, [refresh]);

  async function connect() { setBusy(true); setError(''); setMessage(''); try { const result = await connectGoogleDrive(); setConnected(true); setEmail(result.email); setMessage('Google Drive connected successfully.'); await refresh(); } catch (e: any) { setError(e?.message || 'Could not connect Google Drive.'); } finally { setBusy(false); } }
  async function sync() { setBusy(true); setError(''); setMessage(''); setProgress({ ...emptyProgress, phase: 'sync', status: 'preparing' }); try { const result = await syncAcademicVault(setProgress); setMessage(`Backup completed: ${result.count} files. ${result.duplicates} existing files reused, ${result.failed} failed.`); await refresh(); } catch (e: any) { setError(e?.message || 'Google Drive sync failed.'); } finally { setBusy(false); } }
  async function restore() { setBusy(true); setError(''); setMessage(''); setProgress({ ...emptyProgress, phase: 'restore', status: 'preparing' }); try { const result = await restoreAcademicVault(setProgress); setMessage(`Restore completed: ${result.restoredRows} records and ${result.restoredFiles} files. ${result.duplicates} existing files updated.`); await refresh(); } catch (e: any) { setError(e?.message || 'Google Drive restore failed.'); } finally { setBusy(false); } }
  async function disconnect() { setBusy(true); setError(''); try { await disconnectGoogleDrive(); setConnected(false); setEmail(null); setBackup(null); setStorage(null); setMessage('Google Drive disconnected. Your local AcademicVault data was not deleted.'); } catch (e: any) { setError(e?.message || 'Could not disconnect Google Drive.'); } finally { setBusy(false); } }

  const storagePercent = useMemo(() => storage?.limit ? Math.min(100, Math.round(storage.used / storage.limit * 100)) : 0, [storage]);
  const running = busy && progress.status === 'running';

  return <div className="app drive-page">
    <aside className="sidebar"><Logo/><nav className="nav">
      <Link to="/dashboard">Dashboard</Link><Link to="/ai-insights"><Sparkles size={16}/> AI Intelligence</Link><Link className="active" to="/google-drive"><Cloud size={16}/> Google Drive</Link><Link to="/feedback"><MessageSquare size={16}/> Feedback</Link>
    </nav></aside>
    <main className="main">
      <header className="simple-header"><Link to="/dashboard" className="back-link"><ArrowLeft size={18}/> Dashboard</Link><h2 style={{ margin: 0 }}>Google Drive</h2><Cloud size={24}/></header>
      <section className="content drive-content">
      <section className="drive-hero card">
        <div className="drive-title"><div><p className="eyebrow">Secure cloud backup</p><h1>Google Drive</h1><p className="muted">Back up AcademicVault data to your own Google account and restore it whenever you need it.</p></div><div className={`drive-status-dot ${connected ? 'online' : ''}`}><Cloud size={30}/></div></div>
        <div className="drive-account card"><div className="drive-account-icon"><Cloud size={22}/></div><div><strong>{connected ? 'Connected' : 'Not connected'}</strong><p>{email || 'Connect a Google account to start backup.'}</p></div><span className={connected ? 'status-pill success-pill' : 'status-pill'}>{connected ? 'Active' : 'Offline'}</span></div>
        <div className="drive-info"><ShieldCheck size={22}/><div><strong>Per-user storage</strong><p>AcademicVault uses your Google account. It never uses one shared Drive account for everyone.</p></div></div>
        {connected && <>
          <div className="storage-card card"><div className="row-between"><strong>Storage overview</strong><span>{storagePercent}% used</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${storagePercent}%` }}/></div><div className="row-between muted"><span>{formatBytes(storage?.used || 0)} used</span><span>{storage?.limit ? formatBytes(storage.limit) : 'Drive storage'}</span></div></div>
          <div className="quick-actions"><button className="quick primary" onClick={sync} disabled={busy}><UploadCloud size={22}/><strong>Sync now</strong><small>Backup local data</small></button><button className="quick restore" onClick={restore} disabled={busy || backup?.found === false}><Download size={22}/><strong>Restore backup</strong><small>{backup?.found ? 'Restore from Drive' : 'No backup found'}</small></button><button className="quick" onClick={disconnect} disabled={busy}><CloudOff size={22}/><strong>Disconnect</strong><small>Keep local data</small></button></div>
          <div className={`backup-state ${backup?.found ? 'found' : 'missing'}`}>{backup?.found ? <><CheckCircle2 size={24}/><div><strong>Backup available</strong><p>Last backup: {formatDate(backup.createdAt)} · {backup.totalFiles} files · {formatBytes(backup.sizeBytes)}</p></div></> : <><AlertTriangle size={24}/><div><strong>No backup found</strong><p>Sync your AcademicVault data to create your first backup.</p></div></>}</div>
          {backup?.found && <div className="restore-summary card"><div className="row-between"><strong>What will be restored</strong><span>{backup.totalRows} records</span></div><div className="summary-grid"><div><Database size={18}/><b>{backup.totalRows}</b><span>Records</span></div><div><HardDrive size={18}/><b>{backup.totalFiles}</b><span>Files</span></div><div><Download size={18}/><b>{formatBytes(backup.sizeBytes)}</b><span>Backup size</span></div></div></div>}
        </>}
        {message && <div className="success drive-alert"><CheckCircle2 size={18}/>{message}</div>}{error && <div className="error drive-alert"><AlertTriangle size={18}/>{error}</div>}
        {!connected && <><button className="btn primary drive-connect" onClick={connect} disabled={busy}>{busy ? <><Loader2 size={18} className="spin"/> Connecting…</> : <><Cloud size={18}/> Connect Google Drive</>}</button><p className="muted drive-note">Your local data remains the primary copy. Connecting Drive does not delete or move your local documents.</p></>}
      </section>

      {busy && <section className="card operation-card">
        <div className="operation-heading"><div><p className="eyebrow">{progress.phase === 'sync' ? 'Cloud backup' : 'Data recovery'}</p><h2>{progress.phase === 'sync' ? 'Sync Progress' : 'Restore Progress'}</h2></div><div className="operation-icon">{progress.phase === 'sync' ? <UploadCloud size={26}/> : <Download size={26}/>}</div></div>
        <p className="operation-label">{progress.phase === 'sync' ? 'Syncing to Google Drive…' : 'Restoring from Google Drive…'}</p><div className="big-percent">{progress.percent}%</div><div className="progress-track large"><div className="progress-fill" style={{ width: `${progress.percent}%` }}/></div><div className="row-between muted"><span>{progress.current} of {progress.total} files</span><span>{progress.phase === 'sync' ? 'Uploading' : 'Restoring'}</span></div>
        <div className="stats-grid"><Stat label="Total files" value={progress.total}/><Stat label={progress.phase === 'sync' ? 'Uploaded' : 'Restored'} value={progress.phase === 'sync' ? progress.uploaded : progress.restored}/><Stat label="Duplicates" value={progress.duplicates}/><Stat label="Failed" value={progress.failed}/></div>
        <div className="current-file"><span>{progress.currentName || 'Preparing files…'}</span></div>
        <div className="operation-actions"><button className="btn secondary" onClick={cancelDriveOperation}><Pause size={17}/> Stop</button><button className="btn danger" onClick={cancelDriveOperation}><X size={17}/> Cancel</button></div>
      </section>}
      </section>
    </main>
  </div>;
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="op-stat"><span>{label}</span><strong>{value}</strong></div>; }
