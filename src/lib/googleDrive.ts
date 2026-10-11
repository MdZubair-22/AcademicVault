import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const WEB_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim();

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ROOT_NAME = 'AcademicVault';
const MAP_KEY = 'academicvault.google-drive.map.v1';
const BACKUP_MANIFEST_NAME = 'AcademicVault Backup.json';
const BACKUP_VERSION = 1;

type DriveMap = Record<string, string>;
export type DriveProgress = {
  phase: 'sync' | 'restore';
  status: 'preparing' | 'running' | 'completed' | 'cancelled';
  percent: number;
  total: number;
  current: number;
  currentName: string;
  uploaded: number;
  restored: number;
  skipped: number;
  duplicates: number;
  failed: number;
};
export type BackupSummary = {
  found: boolean;
  createdAt?: string;
  totalFiles: number;
  totalRows: number;
  sizeBytes: number;
  categories: Record<string, number>;
};
export type DriveStorageInfo = { used: number; limit: number };

function readMap(): DriveMap {
  try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch { return {}; }
}
function writeMap(map: DriveMap) { localStorage.setItem(MAP_KEY, JSON.stringify(map)); }
function safeName(name: string, fallback = 'document') {
  const cleaned = (name || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned || fallback;
}
function escapeQ(value: string) { return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

let initialized = false;
let accessToken: string | null = null;
let accountEmail: string | null = null;
let webRedirectHandled = false;
let rootFolderId: string | null = null;
let cancelled = false;

export async function initializeGoogleDrive() {
  if (initialized) return;
  if (!WEB_CLIENT_ID) {
    throw new Error(
      'Google Drive is not configured. Set VITE_GOOGLE_WEB_CLIENT_ID to your Google Cloud Web OAuth client ID.',
    );
  }

  await GoogleSignIn.initialize({
    clientId: WEB_CLIENT_ID,
    scopes: [DRIVE_SCOPE],
    ...(Capacitor.getPlatform() === 'web'
      ? {
          redirectUrl:
            import.meta.env.VITE_GOOGLE_REDIRECT_URL?.trim() ||
            `${window.location.origin}/google-drive`,
        }
      : {}),
  });
  initialized = true;
}

export function getGoogleDriveStatus() { return { connected: !!accessToken, email: accountEmail }; }

export async function handleGoogleDriveRedirect() {
  if (Capacitor.getPlatform() !== 'web' || webRedirectHandled) return null;
  if (!window.location.hash.includes('id_token')) return null;
  webRedirectHandled = true;
  await initializeGoogleDrive();
  const result = await GoogleSignIn.handleRedirectCallback();
  if (!result.accessToken) throw new Error('Google Drive permission was not granted.');
  accessToken = result.accessToken;
  accountEmail = result.email || null;
  await ensureRootFolder();
  return { email: accountEmail };
}

export async function connectGoogleDrive() {
  await initializeGoogleDrive();
  const result = await GoogleSignIn.signIn();
  if (!result.accessToken) throw new Error('Google Drive permission was not granted. Please allow Drive access.');
  accessToken = result.accessToken;
  accountEmail = result.email || null;
  rootFolderId = null;
  await ensureRootFolder();
  return { email: accountEmail };
}

export async function disconnectGoogleDrive() {
  try { await GoogleSignIn.signOut(); } catch {}
  accessToken = null;
  accountEmail = null;
  rootFolderId = null;
}

export function cancelDriveOperation() { cancelled = true; }

async function driveFetch(path: string, init: RequestInit = {}) {
  if (!accessToken) throw new Error('Connect Google Drive first.');
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = `Google Drive request failed (${response.status}).`;
    try { message = JSON.parse(text)?.error?.message || message; } catch {}
    throw new Error(message);
  }
  return response;
}

async function ensureFolder(name: string, parentId?: string) {
  const q = [
    `name = '${escapeQ(name)}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
    parentId ? `'${escapeQ(parentId)}' in parents` : undefined,
  ].filter(Boolean).join(' and ');
  const list = await driveFetch(`/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)`);
  const data = await list.json();
  if (data.files?.[0]?.id) return data.files[0].id as string;
  const response = await driveFetch('/files?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }),
  });
  return (await response.json()).id as string;
}

async function ensureRootFolder() {
  if (!rootFolderId) rootFolderId = await ensureFolder(ROOT_NAME);
  return rootFolderId;
}

const categories: Record<string, string> = {
  documents: 'Academic Records',
  certificates: 'Certificates',
  achievements: 'Achievements',
  projects: 'Projects',
  internships: 'Internships',
  courses: 'Courses',
  skills: 'Skills',
};

function recordFolderName(table: string, row: any, fallback: string) {
  const label = table === 'documents' ? row.title : table === 'certificates' ? row.certificate_title || row.course_name : table === 'internships' ? row.course_name || row.company || row.title : table === 'courses' ? row.course_name || row.title : table === 'skills' ? row.name || row.title : row.title;
  return safeName(label || fallback, 'Untitled record');
}

async function getLocalRows(table: string) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data || [];
}

async function getLocalBlob(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 1800);
  if (error || !data?.signedUrl) throw new Error(`Could not read local file: ${path}`);
  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error(`Could not read local file: ${path}`);
  return response.blob();
}

async function findExistingFile(parentId: string, name: string) {
  const q = `'${escapeQ(parentId)}' in parents and name = '${escapeQ(name)}' and trashed = false`;
  const list = await driveFetch(`/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name,size,modifiedTime)`);
  const data = await list.json();
  return data.files?.[0] || null;
}

async function uploadOrUpdate(name: string, blob: Blob, parentId: string, key: string, appProperties?: Record<string, string>) {
  const map = readMap();
  let fileId = map[key];
  let existed = false;
  if (!fileId) {
    const existing = await findExistingFile(parentId, name);
    fileId = existing?.id || null;
    existed = !!existing;
  } else existed = true;

  if (fileId) {
    const currentFile = await driveFetch(`/files/${encodeURIComponent(fileId)}?fields=id,parents`).then(r => r.json());
    const parents = currentFile.parents || [];
    const oldParents = parents.filter((id: string) => id !== parentId);
    if (!parents.includes(parentId) || oldParents.length > 0) {
      await driveFetch(`/files/${encodeURIComponent(fileId)}?addParents=${encodeURIComponent(parentId)}&removeParents=${encodeURIComponent(oldParents.join(','))}&fields=id,parents`, { method: 'PATCH' });
    }
    // Same logical file: update it in-place instead of creating (1), (2), etc.
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': blob.type || 'application/octet-stream' }, body: blob,
    });
    if (!response.ok) throw new Error(`Could not update ${name} in Google Drive.`);
  } else {
    const metadata = JSON.stringify({ name, parents: [parentId], ...(appProperties ? { appProperties } : {}) });
    const boundary = `academicvault-${crypto.randomUUID()}`;
    const body = new Blob([`--${boundary}\r\n`, 'Content-Type: application/json; charset=UTF-8\r\n\r\n', metadata, `\r\n--${boundary}\r\n`, `Content-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${boundary}--`]);
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    });
    if (!response.ok) throw new Error(`Could not upload ${name} to Google Drive.`);
    fileId = (await response.json()).id;
  }
  map[key] = fileId;
  writeMap(map);
  return { fileId: fileId as string, duplicate: existed };
}

type BackupFile = { fileId: string; bucket: string; path: string; name: string; category: string; key: string; size?: number };
type BackupManifest = { version: number; createdAt: string; tables: Record<string, any[]>; files: BackupFile[] };

async function syncFile(bucket: string, path: string, name: string, category: keyof typeof categories, key: string, recordFolder: string): Promise<BackupFile & { duplicate: boolean }> {
  const root = await ensureRootFolder();
  const categoryFolder = await ensureFolder(categories[category], root);
  const folder = await ensureFolder(recordFolder, categoryFolder);
  const blob = await getLocalBlob(bucket, path);
  const cleanName = safeName(name || path.split('/').pop() || 'document');
  const result = await uploadOrUpdate(cleanName, blob, folder, key, { academicvault: '1', category: categories[category], bucket, path, key });
  return { fileId: result.fileId, bucket, path, name: cleanName, category: categories[category], key, size: blob.size, duplicate: result.duplicate };
}

async function uploadBackupManifest(manifest: BackupManifest) {
  const root = await ensureRootFolder();
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  await uploadOrUpdate(BACKUP_MANIFEST_NAME, blob, root, 'backup:manifest', { academicvault: 'backup', version: String(BACKUP_VERSION) });
}

async function downloadDriveFile(fileId: string): Promise<Blob> { return (await driveFetch(`/files/${encodeURIComponent(fileId)}?alt=media`)).blob(); }

async function findManifest(): Promise<{ id: string; manifest: BackupManifest } | null> {
  const root = await ensureRootFolder();
  const q = [`'${escapeQ(root)}' in parents`, `name = '${escapeQ(BACKUP_MANIFEST_NAME)}'`, 'trashed = false'].join(' and ');
  const list = await driveFetch(`/files?q=${encodeURIComponent(q)}&spaces=drive&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`);
  const data = await list.json();
  const id = data.files?.[0]?.id as string | undefined;
  if (!id) return null;
  let manifest: BackupManifest;
  try { manifest = JSON.parse(await (await downloadDriveFile(id)).text()); } catch { throw new Error('The AcademicVault backup is invalid or corrupted.'); }
  if (manifest.version !== BACKUP_VERSION) throw new Error('This AcademicVault backup version is not supported.');
  return { id, manifest };
}

export async function getBackupSummary(): Promise<BackupSummary> {
  if (!accessToken) throw new Error('Connect Google Drive first.');
  const found = await findManifest();
  if (!found) return { found: false, totalFiles: 0, totalRows: 0, sizeBytes: 0, categories: {} };
  const { manifest } = found;
  const categoriesCount: Record<string, number> = {};
  for (const file of manifest.files || []) categoriesCount[file.category] = (categoriesCount[file.category] || 0) + 1;
  return {
    found: true,
    createdAt: manifest.createdAt,
    totalFiles: manifest.files?.length || 0,
    totalRows: Object.values(manifest.tables || {}).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0),
    sizeBytes: (manifest.files || []).reduce((n, f) => n + (f.size || 0), 0),
    categories: categoriesCount,
  };
}

export async function getDriveStorageInfo(): Promise<DriveStorageInfo> {
  if (!accessToken) throw new Error('Connect Google Drive first.');
  const response = await driveFetch('/about?fields=storageQuota(usage,limit)');
  const quota = (await response.json()).storageQuota || {};
  return { used: Number(quota.usage || 0), limit: Number(quota.limit || 0) };
}

export async function restoreAcademicVault(onProgress?: (p: DriveProgress) => void) {
  if (!accessToken) throw new Error('Connect Google Drive first.');
  cancelled = false;
  const found = await findManifest();
  if (!found) throw new Error('No AcademicVault backup was found in Google Drive.');
  const manifest = found.manifest;
  const files = manifest.files || [];
  const total = files.length;
  const progress: DriveProgress = { phase: 'restore', status: 'preparing', percent: total ? 0 : 100, total, current: 0, currentName: '', uploaded: 0, restored: 0, skipped: 0, duplicates: 0, failed: 0 };
  onProgress?.(progress);

  for (const [table, rows] of Object.entries(manifest.tables || {})) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw new Error(`Could not restore ${table}: ${error.message}`);
  }

  progress.status = 'running';
  for (const file of files) {
    if (cancelled) { progress.status = 'cancelled'; onProgress?.({ ...progress }); throw new Error('Restore cancelled.'); }
    progress.currentName = file.name || file.path;
    try {
      const blob = await downloadDriveFile(file.fileId);
      const { data: existing } = await supabase.storage.from(file.bucket).list(file.path.split('/').slice(0, -1).join('/'), { search: file.path.split('/').pop() || undefined, limit: 10 });
      const sameNameExists = (existing || []).some((x: any) => x.name === file.path.split('/').pop());
      if (sameNameExists) progress.duplicates++;
      const { error } = await supabase.storage.from(file.bucket).upload(file.path, blob, { contentType: blob.type || undefined, upsert: true });
      if (error) throw new Error(error.message);
      progress.restored++;
    } catch (e) {
      progress.failed++;
    }
    progress.current++;
    progress.percent = total ? Math.round((progress.current / total) * 100) : 100;
    onProgress?.({ ...progress });
  }
  progress.status = 'completed'; progress.percent = 100; progress.currentName = '';
  onProgress?.({ ...progress });
  return { restoredRows: Object.values(manifest.tables || {}).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0), restoredFiles: progress.restored, backupCreatedAt: manifest.createdAt, duplicates: progress.duplicates, failed: progress.failed };
}

export async function syncAcademicVault(onProgress?: (p: DriveProgress) => void) {
  if (!accessToken) throw new Error('Connect Google Drive first.');
  cancelled = false;
  const jobs: Array<() => Promise<BackupFile & { duplicate: boolean }>> = [];
  const backupTables: Record<string, any[]> = {};

  const documents = await getLocalRows('documents');
  backupTables.documents = documents;
  for (const row of documents) if (row.file_path) jobs.push(() => syncFile('academic-documents', row.file_path, row.file_name || row.file_path.split('/').pop() || 'document', 'documents', `documents:${row.id}:file`, recordFolderName('documents', row, row.file_name || 'Untitled record')));

  const portfolioTables: Array<[string, keyof typeof categories]> = [['certificates', 'certificates'], ['achievements', 'achievements'], ['projects', 'projects'], ['internships', 'internships'], ['courses', 'courses'], ['skills', 'skills']];
  for (const [table, category] of portfolioTables) {
    let rows: any[] = []; try { rows = await getLocalRows(table); } catch { continue; }
    backupTables[table] = rows;
    for (const row of rows) {
      const primaryPath = row.file_path || row.report_path;
      const primaryName = row.file_name || row.report_name || primaryPath?.split('/').pop();
      if (primaryPath) jobs.push(() => syncFile('portfolio-files', primaryPath, primaryName || 'document', category, `${table}:${row.id}:primary`, recordFolderName(table, row, primaryName || 'Untitled record')));
      if (Array.isArray(row.screenshots)) row.screenshots.forEach((path: string, index: number) => { if (path) jobs.push(() => syncFile('portfolio-files', path, path.split('/').pop() || `screenshot-${index + 1}.png`, category, `${table}:${row.id}:screenshot:${index}`, recordFolderName(table, row, primaryName || `Record ${row.id}`))); });
    }
  }

  const total = jobs.length;
  const progress: DriveProgress = { phase: 'sync', status: 'preparing', percent: total ? 0 : 100, total, current: 0, currentName: '', uploaded: 0, restored: 0, skipped: 0, duplicates: 0, failed: 0 };
  onProgress?.({ ...progress });
  const files: BackupFile[] = [];
  progress.status = 'running';
  for (const job of jobs) {
    if (cancelled) { progress.status = 'cancelled'; onProgress?.({ ...progress }); throw new Error('Sync cancelled.'); }
    try {
      const file = await job();
      files.push(file);
      progress.uploaded++;
      if (file.duplicate) { progress.duplicates++; progress.skipped++; }
      progress.currentName = file.name;
    } catch (e) {
      progress.failed++;
      progress.currentName = e instanceof Error ? e.message : 'Upload failed';
    }
    progress.current++;
    progress.percent = total ? Math.round((progress.current / total) * 100) : 100;
    onProgress?.({ ...progress });
  }

  const manifest: BackupManifest = { version: BACKUP_VERSION, createdAt: new Date().toISOString(), tables: backupTables, files };
  await uploadBackupManifest(manifest);
  progress.status = 'completed'; progress.percent = 100; progress.currentName = '';
  onProgress?.({ ...progress });
  return { count: files.length, backedUpRows: Object.values(backupTables).reduce((n, rows) => n + rows.length, 0), duplicates: progress.duplicates, failed: progress.failed };
}
