/**
 * AcademicVault Local-First Storage
 * Metadata: localStorage | Files: IndexedDB
 */
const META_KEY = "academicvault.documents.v1";
const DB_NAME = "academicvault-files";
const DB_VERSION = 1;
const STORE = "files";

export type LocalDocument = {
  id:string; title:string; category:string; academicYear?:string; semester?:string;
  issuer?:string; issueDate?:string; description?:string; tags?:string[];
  fileName?:string; mimeType?:string; size?:number; createdAt:string; updatedAt:string;
};

function meta():LocalDocument[]{try{return JSON.parse(localStorage.getItem(META_KEY)||"[]")}catch{return[]}}
function saveMeta(x:LocalDocument[]){localStorage.setItem(META_KEY,JSON.stringify(x))}
function db():Promise<IDBDatabase>{return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function put(id:string,b:Blob){const d=await db();return new Promise<void>((res,rej)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).put(b,id);t.oncomplete=()=>{d.close();res()};t.onerror=()=>rej(t.error)})}
async function get(id:string){const d=await db();return new Promise<Blob|null>((res,rej)=>{const r=d.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>{d.close();res(r.result||null)};r.onerror=()=>rej(r.error)})}
async function del(id:string){const d=await db();return new Promise<void>((res,rej)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).delete(id);t.oncomplete=()=>{d.close();res()};t.onerror=()=>rej(t.error)})}

export async function listLocalDocuments(){return meta().sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
export async function saveLocalDocument(m:Omit<LocalDocument,"id"|"createdAt"|"updatedAt">,file?:File|Blob){
 const id=crypto.randomUUID(), now=new Date().toISOString(); const x={...m,id,createdAt:now,updatedAt:now} as LocalDocument;
 if(file){await put(id,file);x.fileName=m.fileName||(file instanceof File?file.name:"document");x.mimeType=m.mimeType||file.type;x.size=file.size}
 const a=meta();a.push(x);saveMeta(a);return x;
}
export async function updateLocalDocument(id:string,p:Partial<Omit<LocalDocument,"id"|"createdAt">>,file?:File|Blob){
 const a=meta(),i=a.findIndex(x=>x.id===id);if(i<0)return null;
 if(file){await put(id,file);p.fileName=p.fileName||(file instanceof File?file.name:"document");p.mimeType=p.mimeType||file.type;p.size=file.size}
 a[i]={...a[i],...p,updatedAt:new Date().toISOString()};saveMeta(a);return a[i];
}
export async function deleteLocalDocument(id:string){saveMeta(meta().filter(x=>x.id!==id));await del(id)}
export const getLocalDocumentFile=get;
export async function getLocalStorageSummary(){const a=meta();return{documents:a.length,bytes:a.reduce((n,x)=>n+(x.size||0),0)}}
