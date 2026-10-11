import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileOpener } from "@capawesome-team/capacitor-file-opener";
import { Share } from "@capacitor/share";

function safeFileName(name: string, fallback = "document") {
  const cleaned = (name || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim();
  return cleaned || fallback;
}

function mimeFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
  };
  return map[ext || ""] || "application/octet-stream";
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function getStoredBlob(client: any, bucket: string, path: string) {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 1800);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Could not access the stored file.");

  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error("Could not read the stored file.");

  return {
    blob: await response.blob(),
    url: data.signedUrl,
  };
}

async function saveNativeFile(blob: Blob, fileName: string, directory: Directory) {
  const path = `AcademicVault/${safeFileName(fileName)}`;
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory,
    recursive: true,
  });

  return Filesystem.getUri({ directory, path });
}

function nativeMimeType(blob: Blob, fileName: string, mimeType?: string) {
  return mimeType || blob.type || mimeFromName(fileName);
}

export async function openFileLocation(
  client: any,
  bucket: string,
  path: string,
  fileName = path.split("/").pop() || "document",
  mimeType?: string,
) {
  if (!path) throw new Error("No document file is attached.");

  const { blob, url } = await getStoredBlob(client, bucket, path);

  if (!Capacitor.isNativePlatform()) {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = url;
    return;
  }

  const uri = await saveNativeFile(blob, fileName, Directory.Cache);
  await FileOpener.openFile({
    path: uri.uri,
    mimeType: nativeMimeType(blob, fileName, mimeType),
  });
}

export async function downloadFile(
  client: any,
  bucket: string,
  path: string,
  fileName = path.split("/").pop() || "document",
  mimeType?: string,
) {
  if (!path) throw new Error("No document file is attached.");

  const { blob, url } = await getStoredBlob(client, bucket, path);
  const name = safeFileName(fileName);

  if (!Capacitor.isNativePlatform()) {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  try {
    await Filesystem.requestPermissions();
  } catch {
    // Some Android versions do not require a runtime permission for the
    // app-specific Documents directory. Continue and let the write report
    // a real error if the OS rejects it.
  }

  const uri = await saveNativeFile(blob, name, Directory.Cache);

  // Android WebView does not reliably honor <a download>.
  // Hand the saved file to the native share/save sheet so the user can
  // choose Files/Downloads or another app.
  await Share.share({
    title: name,
    text: `AcademicVault document: ${name}`,
    files: [uri.uri],
    dialogTitle: "Save or share document",
  });
}

export async function shareFile(
  client: any,
  bucket: string,
  path: string,
  fileName = path.split("/").pop() || "document",
  mimeType?: string,
) {
  if (!path) throw new Error("No document file is attached.");

  const { blob, url } = await getStoredBlob(client, bucket, path);
  const name = safeFileName(fileName);

  if (!Capacitor.isNativePlatform()) {
    if (navigator.share) {
      await navigator.share({ title: name, text: `AcademicVault document: ${name}`, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
    return;
  }

  const uri = await saveNativeFile(blob, name, Directory.Cache);
  await Share.share({
    title: name,
    text: `AcademicVault document: ${name}`,
    files: [uri.uri],
    dialogTitle: "Share document",
  });
}
