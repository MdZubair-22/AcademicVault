/* Local-only Supabase-compatible adapter.
 * Metadata is stored in localStorage and binary files in IndexedDB.
 * No network request is made by this adapter.
 */

type Row = Record<string, any>;
type Listener = (event: string, session: any) => void;

const META_KEY = 'academicvault.local.tables.v2';
const AUTH_KEY = 'academicvault.local.auth.v1';
const DB_NAME = 'academicvault-local-files-v2';
const DB_VERSION = 1;
const FILE_STORE = 'files';

function readTables(): Record<string, Row[]> {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}'); }
  catch { return {}; }
}
function writeTables(tables: Record<string, Row[]>) {
  localStorage.setItem(META_KEY, JSON.stringify(tables));
}
function tableRows(name: string): Row[] {
  return readTables()[name] || [];
}
function writeRows(name: string, rows: Row[]) {
  const tables = readTables();
  tables[name] = rows;
  writeTables(tables);
}
function now() { return new Date().toISOString(); }
function newId() { return crypto.randomUUID(); }
function currentAuth(): { user: any | null } {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || '{"user":null}'); }
  catch { return { user: null }; }
}

// In the production/testing architecture, authentication is handled only by
// Supabase Auth. The local adapter receives the authenticated user id so it
// can namespace all local records without storing credentials locally.
export function setLocalAuthUser(user: any | null) {
  if (!user) localStorage.removeItem(AUTH_KEY);
  else localStorage.setItem(AUTH_KEY, JSON.stringify({
    user: { id: user.id, email: user.email, user_metadata: user.user_metadata || {} }
  }));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(FILE_STORE)) {
        request.result.createObjectStore(FILE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putFile(path: string, file: Blob) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    tx.objectStore(FILE_STORE).put(file, path);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getFile(path: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(FILE_STORE).objectStore(FILE_STORE).get(path);
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function removeFiles(paths: string[]) {
  if (!paths.length) return;
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, 'readwrite');
    for (const path of paths) tx.objectStore(FILE_STORE).delete(path);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function ownRows(name: string) {
  const user = currentAuth().user;
  if (!user) return [];
  const rows = tableRows(name);
  if (name === 'student_profiles') return rows.filter(row => row.id === user.id);
  return rows.filter(row => row.user_id === user.id);
}

function project(row: Row, selection: string | undefined) {
  if (!selection || selection === '*') return { ...row };
  const fields = selection.split(',').map(s => s.trim()).filter(Boolean);
  const output: Row = {};
  for (const field of fields) output[field] = row[field];
  return output;
}

class Query {
  private table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selection = '*';
  private filters: Array<[string, any]> = [];
  private orders: Array<[string, boolean]> = [];
  private payload: Row | Row[] = {};
  private countMode = false;
  private headMode = false;
  private maybeSingleMode = false;
  private singleMode = false;

  constructor(table: string) { this.table = table; }

  select(selection = '*', options?: any) {
    this.selection = selection;
    this.countMode = options?.count === 'exact';
    this.headMode = options?.head === true;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push([column, options?.ascending !== false]);
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push([column, value]);
    return this;
  }

  maybeSingle() { this.maybeSingleMode = true; return this; }
  single() { this.singleMode = true; return this; }
  insert(payload: Row | Row[]) { this.action = 'insert'; this.payload = payload; return this; }
  update(payload: Row) { this.action = 'update'; this.payload = payload; return this; }
  delete() { this.action = 'delete'; return this; }
  then(resolve: (value: any) => any, reject?: (error: any) => any) { return this.execute().then(resolve, reject); }
  catch(reject: (error: any) => any) { return this.execute().catch(reject); }

  private async execute(): Promise<any> {
    try {
      const user = currentAuth().user;
      if (!user) {
        return {
          data: this.action === 'select' ? [] : null,
          error: { message: 'Not authenticated.' },
          count: 0,
        };
      }

      if (this.action === 'insert') {
        const input = Array.isArray(this.payload) ? this.payload : [this.payload];
        const created = input.map(payload => ({
          ...payload,
          id: payload.id || newId(),
          user_id: user.id,
          created_at: payload.created_at || now(),
          updated_at: now(),
        }));
        const rows = tableRows(this.table);
        rows.push(...created);
        writeRows(this.table, rows);
        return {
          data: created.length === 1 ? created[0] : created,
          error: null,
          count: created.length,
        };
      }

      const matches = (row: Row) =>
        this.filters.every(([key, value]) => row[key] === value) &&
        (this.table === 'student_profiles' ? row.id === user.id : row.user_id === user.id);

      if (this.action === 'update') {
        const rows = tableRows(this.table);
        const output: Row[] = [];
        let count = 0;
        const updated = rows.map(row => {
          if (!matches(row)) return row;
          count++;
          const next = { ...row, ...(this.payload as Row), updated_at: now() };
          output.push(next);
          return next;
        });

        // Profile setup uses update() for the first save. If a local profile
        // does not exist yet, create it from the authenticated Supabase user.
        if (this.table === 'student_profiles' && count === 0) {
          const base = {
            id: user.id,
            user_id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '',
            created_at: now(),
            updated_at: now(),
            ...(this.payload as Row),
          };
          updated.push(base);
          output.push(base);
          count = 1;
        }

        writeRows(this.table, updated);
        return { data: output.length === 1 ? output[0] : output, error: null, count };
      }

      if (this.action === 'delete') {
        const rows = tableRows(this.table);
        const removed = rows.filter(matches);
        writeRows(this.table, rows.filter(row => !removed.includes(row)));
        return { data: removed, error: null, count: removed.length };
      }

      let rows = ownRows(this.table).filter(row => this.filters.every(([key, value]) => row[key] === value));
      for (let i = this.orders.length - 1; i >= 0; i--) {
        const [key, ascending] = this.orders[i];
        rows.sort((a, b) => {
          const av = a[key] ?? '';
          const bv = b[key] ?? '';
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
        });
      }

      const count = rows.length;
      if (this.headMode) return { data: null, error: null, count };
      const projected = rows.map(row => project(row, this.selection));
      if (this.singleMode) {
        return {
          data: projected[0] || null,
          error: projected[0] ? null : { message: 'No rows found.' },
          count,
        };
      }
      if (this.maybeSingleMode) return { data: projected[0] || null, error: null, count };
      return { data: projected, error: null, count: this.countMode ? count : undefined };
    } catch (error: any) {
      return { data: null, error: { message: error?.message || 'Local storage error.' } };
    }
  }
}

const auth = {
  async getUser() { return { data: { user: currentAuth().user }, error: null }; },
  async getSession() { const user=currentAuth().user; return { data:{ session:user?{user}:null }, error:null }; },
};

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: Blob, _options?: any) {
        try {
          await putFile(`${bucket}/${path}`, file);
          return { data: { path }, error: null };
        } catch (error: any) {
          return { data: null, error: { message: error?.message || 'Could not save file locally.' } };
        }
      },

      async createSignedUrl(path: string, _expires?: number) {
        try {
          const blob = await getFile(`${bucket}/${path}`);
          if (!blob) return { data: null, error: { message: 'File not found on this device.' } };
          return { data: { signedUrl: URL.createObjectURL(blob) }, error: null };
        } catch (error: any) {
          return { data: null, error: { message: error?.message || 'Could not open local file.' } };
        }
      },

      async remove(paths: string[]) {
        try {
          await removeFiles(paths.map(path => `${bucket}/${path}`));
          return { data: null, error: null };
        } catch (error: any) {
          return { data: null, error: { message: error?.message || 'Could not remove local file.' } };
        }
      },
    };
  },
};

const rpc = async (name: string, args: any) => {
  if (name !== 'get_public_share') {
    return { data: null, error: { message: `Local RPC ${name} is not available.` } };
  }
  const token = args?.share_token;
  const link = tableRows('share_links').find(row =>
    row.token === token &&
    !row.revoked_at &&
    new Date(row.expires_at).getTime() > Date.now()
  );
  if (!link) return { data: null, error: { message: 'This share link is unavailable, expired, or revoked.' } };
  return { data: link.snapshot, error: null };
};

export const localSupabase = {
  from: (table: string) => new Query(table),
  auth,
  storage,
  rpc,
};
