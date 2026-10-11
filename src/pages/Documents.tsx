import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ArrowLeft,
  Edit3,
  FileImage,
  FileText,
  Filter,
  FolderOpen,
  Loader2,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
  Eye,
  CalendarDays,
  Building2,
  Tag,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Logo from "../components/Logo";
import { analyzeDocument, AIAnalysis } from "../lib/documentAI";
import { validateDocumentFile } from "../lib/ocrPipeline";
import { normalizeSearch, matchesSearch } from "../lib/search";
import { downloadFile, openFileLocation, shareFile } from "../lib/fileActions";
function PdfPreview({ url, title }: { url: string; title: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        setError("");
        setPages([]);
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const response = await fetch(url);
        if (!response.ok) throw new Error("Could not load the PDF preview.");
        const data = new Uint8Array(await response.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data }).promise;
        const rendered: string[] = [];
        const maxPages = Math.min(pdf.numPages, 12);
        for (let n = 1; n <= maxPages; n++) {
          if (cancelled) break;
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1.55 });
          const scale = Math.min(1.55, 1100 / base.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          rendered.push(canvas.toDataURL("image/jpeg", 0.92));
        }
        if (!cancelled) setPages(rendered);
      } catch (e: any) {
        if (!cancelled)
          setError(e?.message || "Could not render PDF inside the app.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (busy)
    return (
      <div className="viewer-loading">
        <Loader2 className="spin" /> Rendering PDF inside AcademicVault…
      </div>
    );
  if (error) return <div className="error">{error}</div>;
  return (
    <div className="pdf-native-preview" aria-label={`PDF preview for ${title}`}>
      {pages.map((src, i) => (
        <img key={i} src={src} alt={`${title} page ${i + 1}`} />
      ))}
    </div>
  );
}

type Document = {
  id: string;
  user_id: string;
  academic_year_id: string | null;
  semester_id: string | null;
  title: string;
  document_type: string;
  institution: string | null;
  document_date: string | null;
  description: string | null;
  tags: string[];
  notes: string | null;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
};
type Year = { id: string; year_label: string; start_year: number | null; end_year: number | null };
type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  semester_number: number | null;
};
const types = [
  ["marksheet", "Semester marksheet"],
  ["grade_card", "Grade card"],
  ["transcript", "Transcript"],
  ["academic_letter", "Academic letter"],
  ["degree", "Degree document"],
  ["other", "Other academic record"],
];
const empty = {
  title: "",
  document_type: "marksheet",
  academic_year_id: "",
  semester_id: "",
  institution: "",
  document_date: "",
  description: "",
  tags: "",
  notes: "",
};
const MAX = 15 * 1024 * 1024;
function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function labelType(v: string) {
  return types.find((x) => x[0] === v)?.[1] ?? "Academic record";
}
function findOcrYear(text: string, availableYears: Year[]) {
  const normalized = text.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").toLowerCase();
  return availableYears.find((year) => {
    if (year.start_year && year.end_year) {
      const range = `${year.start_year} - ${year.end_year}`;
      return normalized.includes(range) || normalized.includes(`${year.start_year}-${year.end_year}`);
    }
    return normalized.includes(year.year_label.toLowerCase());
  });
}
function findOcrSemester(text: string, availableSemesters: Semester[], yearId?: string) {
  const match = text.match(/(?:semester|sem)\s*[:#\-]?\s*(\d{1,2})/i);
  if (!match) return undefined;
  const number = Number(match[1]);
  return availableSemesters.find((semester) =>
    semester.semester_number === number && (!yearId || semester.academic_year_id === yearId),
  );
}
function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal document-modal">{children}</div>
    </div>
  );
}

export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([]),
    [years, setYears] = useState<Year[]>([]),
    [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [modal, setModal] = useState(false),
    [editing, setEditing] = useState<Document | null>(null),
    [form, setForm] = useState(empty),
    [file, setFile] = useState<File | null>(null);
  const [ai, setAi] = useState<AIAnalysis | null>(null),
    [aiBusy, setAiBusy] = useState(false),
    [aiProgress, setAiProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [showOCRText, setShowOCRText] = useState(false);
  const [query, setQuery] = useState(""),
    [typeFilter, setTypeFilter] = useState("all"),
    [yearFilter, setYearFilter] = useState("all"),
    [viewer, setViewer] = useState<Document | null>(null),
    [viewerUrl, setViewerUrl] = useState(""),
    [viewBusy, setViewBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (searchParams.get("upload") === "1") openAdd();
  }, [searchParams]);
  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const [d, y, s] = await Promise.all([
      supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("academic_years")
        .select("id,year_label,start_year,end_year")
        .order("sort_order"),
      supabase
        .from("semesters")
        .select("id,academic_year_id,name,semester_number")
        .order("sort_order"),
    ]);
    if (d.error || y.error || s.error)
      setError(
        (d.error || y.error || s.error)?.message || "Could not load records.",
      );
    setDocs((d.data ?? []) as Document[]);
    setYears((y.data ?? []) as Year[]);
    setSemesters((s.data ?? []) as Semester[]);
    setLoading(false);
  }
  const filtered = useMemo(
    () =>
      docs.filter((d) => {
        const q = normalizeSearch(query);
        const text = [
          d.title,
          d.institution,
          d.description,
          d.notes,
          ...(d.tags ?? []),
        ].join(" ");
        return (
          (!q || matchesSearch(text, q)) &&
          (typeFilter === "all" || d.document_type === typeFilter) &&
          (yearFilter === "all" || d.academic_year_id === yearFilter)
        );
      }),
    [docs, query, typeFilter, yearFilter],
  );
  const selectedSemesters = semesters.filter(
    (s) => s.academic_year_id === form.academic_year_id,
  );
  function openAdd() {
    setEditing(null);
    setForm(empty);
    setFile(null);
    setAi(null);
    setAiProgress(0);
    setShowOCRText(false);
    setError("");
    setMessage("");
    setModal(true);
  }
  function openEdit(d: Document) {
    setEditing(d);
    setForm({
      title: d.title,
      document_type: d.document_type,
      academic_year_id: d.academic_year_id ?? "",
      semester_id: d.semester_id ?? "",
      institution: d.institution ?? "",
      document_date: d.document_date ?? "",
      description: d.description ?? "",
      tags: (d.tags ?? []).join(", "),
      notes: d.notes ?? "",
    });
    setFile(null);
    setAi(null);
    setAiProgress(0);
    setShowOCRText(false);
    setError("");
    setMessage("");
    setModal(true);
  }
  async function runAI(f: File) {
    setFile(f);
    setAi(null);
    setError("");
    setAiBusy(true);
    setAiProgress(0);
    try {
      const result = await analyzeDocument(f, (p) =>
        setAiProgress(Math.round(p * 100)),
      );
      setAi(result);
      const valid = types.some(([v]) => v === result.category);
      const detectedYear = findOcrYear(result.text, years);
      const detectedSemester = findOcrSemester(result.text, semesters, detectedYear?.id);
      const fallbackSemester = detectedSemester || (!detectedYear ? findOcrSemester(result.text, semesters) : undefined);
      setForm((prev) => ({
        ...prev,
        title: prev.title || result.title || "",
        document_type: valid ? result.category : "other",
        institution: prev.institution || result.institution || "",
        document_date: prev.document_date || result.documentDate || "",
        tags: prev.tags || result.skills.join(", "),
        academic_year_id: prev.academic_year_id || detectedYear?.id || fallbackSemester?.academic_year_id || "",
        semester_id: prev.semester_id || detectedSemester?.id || fallbackSemester?.id || "",
      }));
      setMessage(
        "OCR completed. Review the suggestions against the original before saving.",
      );
    } catch (e: any) {
      setError(e.message || "AI analysis failed.");
    } finally {
      setAiBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setMessage("");
    if (!form.title.trim()) return setError("Title is required.");
    if (!editing && !file)
      return setError("Please choose a PDF, JPG, or PNG file.");
    if (
      file &&
      (file.size > MAX ||
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type))
    )
      return setError("Use PDF, JPG, or PNG up to 15 MB.");
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired.");
      let path = editing?.file_path ?? "";
      if (file) {
        await validateDocumentFile(file);
        const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
        path = `${user.id}/academic-records/${crypto.randomUUID()}-${safe}`;
        const up = await supabase.storage
          .from("academic-documents")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
      }
      const payload = {
        title: form.title.trim(),
        document_type: form.document_type,
        academic_year_id: form.academic_year_id || null,
        semester_id: form.semester_id || null,
        institution: form.institution.trim() || null,
        document_date: form.document_date || null,
        description: form.description.trim() || null,
        tags: form.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 20),
        notes: form.notes.trim() || null,
        ...(file
          ? {
              file_path: path,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
            }
          : {}),
      };
      let savedDocumentId = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from("documents")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        if (file && editing.file_path)
          await supabase.storage
            .from("academic-documents")
            .remove([editing.file_path]);
        setMessage("Academic record updated.");
      } else {
        const { data: inserted, error } = await supabase
          .from("documents")
          .insert({ user_id: user.id, ...payload })
          .select("id")
          .single();
        if (error) {
          if (file)
            await supabase.storage.from("academic-documents").remove([path]);
          throw error;
        }
        savedDocumentId = inserted.id;
        setMessage("Academic record uploaded.");
      }
      let analysisSaveError = "";
      if (ai && savedDocumentId) {
        const { error: aiError } = await supabase
          .from("document_ai_analysis")
          .insert({
            user_id: user.id,
            document_id: savedDocumentId,
            file_name: file?.name || editing?.file_name || "",
            category: ai.category,
            confidence:
              ai.extraction.ocrEngineConfidence === null
                ? null
                : ai.extraction.ocrEngineConfidence / 100,
            extracted_text: ai.text,
            extracted_metadata: {
              title: ai.title ?? null,
              holderName: ai.holderName ?? null,
              institution: ai.institution ?? null,
              documentDate: ai.documentDate ?? null,
              certificateId: ai.certificateId ?? null,
              academicYear: ai.academicYear ?? null,
              semester: ai.semester ?? null,
              courseName: ai.courseName ?? null,
              grades: ai.grades,
              skills: ai.skills,
              fieldEvidence: ai.fieldEvidence,
              extraction: {
                engine: ai.extraction.engine,
                kind: ai.extraction.kind,
                qualityStatus: ai.extraction.qualityStatus,
                pageCount: ai.extraction.pageCount,
                processedPageCount: ai.extraction.processedPageCount,
                nativeTextPageCount: ai.extraction.nativeTextPageCount,
                ocrPageCount: ai.extraction.ocrPageCount,
                ocrEngineConfidence: ai.extraction.ocrEngineConfidence,
                processingTimeMs: ai.extraction.processingTimeMs,
                imageWidth: ai.extraction.imageWidth ?? null,
                imageHeight: ai.extraction.imageHeight ?? null,
                imageQuality: ai.extraction.imageQuality ?? null,
              },
            },
            skills: ai.skills,
            warnings: ai.warnings,
          });
        if (aiError) analysisSaveError = aiError.message;
      }
      await load();
      setModal(false);
      if (analysisSaveError) {
        setMessage(
          `Record saved, but OCR analysis history could not be saved: ${analysisSaveError}`,
        );
      } else if (ai) {
        setMessage("Record saved with OCR results.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  async function removeDoc(d: Document) {
    if (
      !supabase ||
      !confirm(
        `Move “${d.title}” to Trash? This safely removes it from your vault.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", d.id);
      if (error) throw error;
      await supabase.storage.from("academic-documents").remove([d.file_path]);
      setMessage("Academic record deleted.");
      setDocs((x) => x.filter((a) => a.id !== d.id));
    } catch (err: any) {
      setError(err.message || "Could not delete record.");
    } finally {
      setBusy(false);
    }
  }
  async function view(d: Document) {
    if (!supabase) return;
    setViewer(d);
    setViewerUrl("");
    setViewBusy(true);
    const { data, error } = await supabase.storage
      .from("academic-documents")
      .createSignedUrl(d.file_path, 3600);
    if (error) setError(error.message);
    else setViewerUrl(data.signedUrl);
    setViewBusy(false);
  }
  async function download(d: Document) {
    if (!supabase) return;
    try {
      await downloadFile(
        supabase,
        "academic-documents",
        d.file_path,
        d.file_name,
        d.file_type,
      );
      setMessage("Document downloaded successfully.");
    } catch (err: any) {
      setError(err?.message || "Could not download the document.");
    }
  }
  async function openLocation(d: Document) {
    if (!supabase) return;
    try {
      await openFileLocation(
        supabase,
        "academic-documents",
        d.file_path,
        d.file_name,
        d.file_type,
      );
    } catch (err: any) {
      setError(err.message || "Could not open the stored file.");
    }
  }
  async function share(d: Document) {
    if (!supabase) return;
    try {
      await shareFile(
        supabase,
        "academic-documents",
        d.file_path,
        d.file_name,
        d.file_type,
      );
      setMessage("Document shared successfully.");
    } catch (err: any) {
      setError(err?.message || "Could not share the document.");
    }
  }
  if (!supabase)
    return (
      <div className="auth-shell">
        <div className="card" style={{ padding: 28 }}>
          <Logo />
          <h2>Connect Supabase</h2>
          <p className="muted">
            Add your Supabase values to .env and restart Vite.
          </p>
        </div>
      </div>
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <Logo />
        <nav className="nav">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/journey">My Journey</Link>
          <Link className="active" to="/records">
            Academic Records
          </Link>
          <Link to="/feedback">Feedback</Link>
          <Link to="/profile">Profile</Link>
        </nav>
        <div className="sidebar-bottom">
          <Link to="/profile" className="profile-mini">
            Profile
          </Link>
          <button
            className="btn"
            onClick={() =>
              supabase.auth.signOut().then(() => (location.href = "/login"))
            }
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="header">
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Link
              to="/dashboard"
              className="back-link back-logo-link"
              aria-label="Back to Dashboard"
              title="Back to Dashboard"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </Link>

            <div>
              <strong>Academic Records</strong>
              <div className="muted" style={{ fontSize: 12 }}>
                Private document vault
              </div>
            </div>
          </div>

          <button className="btn primary" onClick={openAdd}>
            <Plus size={17} /> Upload document
          </button>
        </header>
        <section className="content">
          <div className="records-heading">
            <div>
              <h1 style={{ margin: "0 0 7px" }}>Academic Records</h1>
              <p className="muted">
                Securely store marksheets, grade cards, transcripts and other
                academic documents.
              </p>
            </div>
          </div>
          {error && (
            <div className="error" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}
          {message && (
            <div className="success" style={{ marginBottom: 14 }}>
              {message}
            </div>
          )}
          <div className="card records-toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records, institutions, tags…"
              />
            </div>
            <select
              className="input compact"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              {types.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className="input compact"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year_label}
                </option>
              ))}
            </select>
            <Filter size={17} className="toolbar-icon" />
          </div>
          {loading ? (
            <div className="records-list">
              <div className="card skeleton-row" />
              <div className="card skeleton-row" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card records-empty">
              <div className="empty-icon">
                <FileText size={28} />
              </div>
              <h2>
                {docs.length
                  ? "No matching records"
                  : "No academic records yet"}
              </h2>
              <p className="muted">
                {docs.length
                  ? "Try another search or filter."
                  : "Start building your vault by uploading your first academic document."}
              </p>
              <button className="btn primary" onClick={openAdd}>
                <Upload size={17} /> Upload document
              </button>
            </div>
          ) : (
            <div className="records-list">
              {filtered.map((d) => (
                <article className="card document-card" key={d.id}>
                  <div className="doc-icon">
                    {d.file_type === "application/pdf" ? (
                      <FileText size={25} />
                    ) : (
                      <FileImage size={25} />
                    )}
                  </div>
                  <div className="doc-main">
                    <div className="doc-top">
                      <div>
                        <h2>{d.title}</h2>
                        <div className="doc-meta">
                          <span>{labelType(d.document_type)}</span>
                          {d.institution && (
                            <>
                              <span>·</span>
                              <span>{d.institution}</span>
                            </>
                          )}
                          {d.document_date && (
                            <>
                              <span>·</span>
                              <span>
                                {new Date(
                                  d.document_date + "T00:00:00",
                                ).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="file-badge">
                        {d.file_type === "application/pdf"
                          ? "PDF"
                          : d.file_type.split("/")[1]?.toUpperCase()}
                      </span>
                    </div>
                    {d.description && (
                      <p className="muted doc-desc">{d.description}</p>
                    )}
                    <div className="tag-row">
                      {(d.tags ?? []).map((t) => (
                        <span key={t}>
                          <Tag size={11} />
                          {t}
                        </span>
                      ))}
                      <small>{fmtSize(d.file_size)}</small>
                    </div>
                    <div className="doc-actions">
                      <button
                        className="btn secondary small-btn"
                        onClick={() => view(d)}
                      >
                        <Eye size={15} /> View
                      </button>
                      <button
                        className="btn secondary small-btn"
                        onClick={() => openLocation(d)}
                      >
                        <FolderOpen size={15} /> Open file location
                      </button>
                      <button
                        className="btn secondary small-btn"
                        onClick={() => openEdit(d)}
                      >
                        <Edit3 size={15} /> Edit
                      </button>
                      <button
                        className="btn secondary small-btn"
                        onClick={() => download(d)}
                      >
                        <Download size={15} /> Download
                      </button>
                      <button
                        className="btn secondary small-btn"
                        onClick={() => share(d)}
                      >
                        <Share2 size={15} /> Share
                      </button>
                      <button
                        className="icon-btn danger-icon"
                        onClick={() => removeDoc(d)}
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      {modal && (
        <Modal onClose={() => !busy && setModal(false)}>
          <div className="modal-title">
            <div>
              <p className="eyebrow">
                {editing ? "Edit record" : "Upload document"}
              </p>
              <h2>
                {editing ? "Update academic record" : "Add an academic record"}
              </h2>
            </div>
            <button
              className="icon-btn"
              onClick={() => setModal(false)}
              disabled={busy}
            >
              <X size={17} />
            </button>
          </div>
          <form className="modal-form" onSubmit={save}>
            {!editing && (
              <div
                className="upload-drop"
                onClick={() => inputRef.current?.click()}
              >
                <Upload size={24} />
                <strong>{file ? file.name : "Choose a PDF, JPG or PNG"}</strong>
                <span>{file ? fmtSize(file.size) : "Maximum 15 MB"}</span>
                <input
                  ref={inputRef}
                  hidden
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) runAI(f);
                  }}
                />
              </div>
            )}
            {editing && (
              <div className="file-current">
                <FileText size={18} />
                <span>{editing.file_name}</span>
                {file && <strong>→ {file.name}</strong>}
                <button
                  type="button"
                  className="btn secondary small-btn"
                  onClick={() => inputRef.current?.click()}
                >
                  Replace
                </button>
                <input
                  ref={inputRef}
                  hidden
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) runAI(f);
                  }}
                />
              </div>
            )}
            {aiBusy && (
              <div className="ai-analysis-card">
                <div className="ai-analysis-head">
                  <div>
                    <strong>OCR is processing your document locally…</strong>
                    <span>
                      PDF text extraction, OCR, and local metadata suggestions
                    </span>
                  </div>
                  <Loader2 size={18} className="spin" />
                </div>
                <div className="ai-progress">
                  <i style={{ width: `${aiProgress}%` }} />
                </div>
                <small>{aiProgress}% complete</small>
              </div>
            )}
            {previewUrl && (
              <section className="ocr-original-preview" aria-label="Original document preview">
                <strong>Original document preview</strong>
                {file?.type === "application/pdf" ? (
                  <iframe src={previewUrl} title="Original academic document" />
                ) : (
                  <img src={previewUrl} alt="Original uploaded academic document" />
                )}
              </section>
            )}
            {ai && (
              <div className="ai-analysis-card ai-complete">
                <div className="ai-analysis-head">
                  <div>
                    <strong>OCR suggestions ready</strong>
                    <span>Check the original, correct any fields, then confirm the save.</span>
                  </div>
                  <span className={`ocr-quality ocr-quality-${ai.extraction.qualityStatus}`}>
                    {ai.extraction.qualityStatus} quality
                  </span>
                </div>
                <div className="ocr-engine-summary">
                  <span>{ai.extraction.engine}</span>
                  <span>{ai.extraction.processedPageCount} of {ai.extraction.pageCount} pages</span>
                  {ai.extraction.ocrEngineConfidence !== null && (
                    <span>
                      OCR-engine confidence: {Math.round(ai.extraction.ocrEngineConfidence)}%
                    </span>
                  )}
                </div>
                <div className="ai-grid">
                  <div>
                    <small>Detected type</small>
                    <strong>
                      {labelType(
                        types.some(([v]) => v === ai.category)
                          ? ai.category
                          : "other",
                      )}
                    </strong>
                  </div>
                  <div>
                    <small>Extracted title</small>
                    <strong>{ai.title || "Not detected — review manually"}</strong>
                  </div>
                  <div>
                    <small>Institution</small>
                    <strong>{ai.institution || "Not detected"}</strong>
                  </div>
                  <div>
                    <small>Date</small>
                    <strong>{ai.documentDate || "Not detected"}</strong>
                  </div>
                  <div>
                    <small>Academic year</small>
                    <strong>{ai.academicYear || "Not detected"}</strong>
                  </div>
                  <div>
                    <small>Certificate ID</small>
                    <strong>{ai.certificateId || "Not detected"}</strong>
                  </div>
                  <div>
                    <small>Semester</small>
                    <strong>
                      {ai.semester ? `Semester ${ai.semester}` : "Not detected"}
                    </strong>
                  </div>
                </div>
                {ai.skills.length > 0 && (
                  <div className="ai-tags">
                    <small>Detected skills</small>
                    <div>
                      {ai.skills.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="ocr-editable-fields">
                  <label className="field">
                    <span>Holder name</span>
                    <input
                      className="input"
                      value={ai.holderName ?? ""}
                      placeholder="Not detected"
                      onChange={(e) => setAi({ ...ai, holderName: e.target.value || undefined })}
                    />
                  </label>
                  <label className="field">
                    <span>Course or certification name</span>
                    <input
                      className="input"
                      value={ai.courseName ?? ""}
                      placeholder="Not detected"
                      onChange={(e) => setAi({ ...ai, courseName: e.target.value || undefined })}
                    />
                  </label>
                  <label className="field">
                    <span>Certificate or registration ID</span>
                    <input
                      className="input"
                      value={ai.certificateId ?? ""}
                      placeholder="Not detected"
                      onChange={(e) => setAi({ ...ai, certificateId: e.target.value || undefined })}
                    />
                  </label>
                  <label className="field">
                    <span>Grades or marks</span>
                    <input
                      className="input"
                      value={ai.grades.join(", ")}
                      placeholder="Not detected"
                      onChange={(e) => setAi({
                        ...ai,
                        grades: e.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                      })}
                    />
                  </label>
                </div>
                <div className="ocr-review-actions">
                  <button
                    type="button"
                    className="btn secondary small-btn"
                    disabled={aiBusy || !file}
                    onClick={() => file && runAI(file)}
                  >
                    <RotateCcw size={15} /> Retry OCR
                  </button>
                  <button
                    type="button"
                    className="btn secondary small-btn"
                    onClick={() => setShowOCRText((visible) => !visible)}
                  >
                    {showOCRText ? "Hide extracted text" : "Review extracted text"}
                  </button>
                </div>
                {showOCRText && (
                  <pre className="ocr-extracted-text">{ai.text || "No text was recognized."}</pre>
                )}
                {ai.warnings.map((w, i) => (
                  <div className="ai-warning" key={i}>
                    {w}
                  </div>
                ))}
              </div>
            )}
            <label className="field">
              <span>Title *</span>
              {ai && !ai.title && (
                <small className="ocr-field-hint">Not detected — verify this against the original.</small>
              )}
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Semester 6 Grade Card"
              />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Document type</span>
                {ai && ai.confidence < 0.65 && (
                  <small className="ocr-field-hint">Category suggestion is uncertain — please verify.</small>
                )}
                <select
                  className="input"
                  value={form.document_type}
                  onChange={(e) =>
                    setForm({ ...form, document_type: e.target.value })
                  }
                >
                  {types.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Institution</span>
                {ai && !ai.institution && (
                  <small className="ocr-field-hint">Not detected — enter it if shown on the document.</small>
                )}
                <input
                  className="input"
                  value={form.institution}
                  onChange={(e) =>
                    setForm({ ...form, institution: e.target.value })
                  }
                  placeholder="College / University"
                />
              </label>
              <label className="field">
                <span>Academic year</span>
                <select
                  className="input"
                  value={form.academic_year_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      academic_year_id: e.target.value,
                      semester_id: "",
                    })
                  }
                >
                  <option value="">Not linked</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.year_label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Semester</span>
                <select
                  className="input"
                  value={form.semester_id}
                  onChange={(e) =>
                    setForm({ ...form, semester_id: e.target.value })
                  }
                  disabled={!form.academic_year_id}
                >
                  <option value="">Not linked</option>
                  {selectedSemesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Document date</span>
                {ai && !ai.documentDate && (
                  <small className="ocr-field-hint">Not detected or ambiguous — check the original before entering a date.</small>
                )}
                <input
                  className="input"
                  type="date"
                  value={form.document_date}
                  onChange={(e) =>
                    setForm({ ...form, document_date: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Tags</span>
              <input
                className="input"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="e.g. semester 6, VTU, grades"
              />
              <small>Separate tags with commas.</small>
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                className="input textarea"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional context for this record."
              />
            </label>
            <label className="field">
              <span>Private notes</span>
              <textarea
                className="input textarea"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Only you can see these notes."
              />
            </label>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 size={16} className="spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Upload size={16} />{" "}
                    {ai ? "Review & save document" : editing ? "Save changes" : "Upload document"}
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {viewer && (
        <Modal onClose={() => setViewer(null)}>
          <div className="modal-title">
            <div>
              <p className="eyebrow">Document viewer</p>
              <h2>{viewer.title}</h2>
              <p className="muted">
                {viewer.file_name} · {fmtSize(viewer.file_size)}
              </p>
            </div>
            <button className="icon-btn" onClick={() => setViewer(null)}>
              <X size={17} />
            </button>
          </div>
          {viewBusy ? (
            <div className="viewer-loading">
              <Loader2 className="spin" /> Preparing secure preview…
            </div>
          ) : viewerUrl ? (
            <div className="viewer-wrap">
              {viewer.file_type === "application/pdf" ? (
                <PdfPreview title={viewer.title} url={viewerUrl} />
              ) : (
                <img
                  src={viewerUrl}
                  alt={viewer.title}
                  className="image-viewer"
                />
              )}
              <div className="viewer-actions">
                <a
                  className="btn secondary"
                  href={viewerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye size={15} /> Open
                </a>
                <button
                  className="btn primary"
                  onClick={() => download(viewer)}
                >
                  <Download size={15} /> Download
                </button>
              </div>
            </div>
          ) : (
            <div className="error">Could not prepare a secure preview.</div>
          )}
        </Modal>
      )}
    </div>
  );
}
