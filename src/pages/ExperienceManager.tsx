import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  BookOpen,
  Download,
  Edit3,
  Eye,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Logo from "../components/Logo";
import { matchesSearch } from "../lib/search";
import { downloadFile, openFileLocation, shareFile } from "../lib/fileActions";

type Kind = "internships" | "courses";
type Year = { id: string; year_label: string };
type Semester = { id: string; academic_year_id: string; name: string };
const MAX = 15 * 1024 * 1024;
const list = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
const internshipEmpty = {
  academic_year_id: "",
  semester_id: "",
  company: "",
  role: "",
  start_date: "",
  end_date: "",
  internship_type: "internship",
  location: "",
  description: "",
  technologies: "",
  skills: "",
  company_url: "",
  notes: "",
  tags: "",
};
const courseEmpty = {
  academic_year_id: "",
  semester_id: "",
  course_name: "",
  platform: "",
  organization_instructor: "",
  start_date: "",
  completion_date: "",
  duration: "",
  skills_learned: "",
  course_url: "",
  status: "planned",
  notes: "",
  tags: "",
};
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal card" role="dialog" aria-modal="true">
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function ExperienceManager({ kind }: { kind: Kind }) {
  const internship = kind === "internships";
  const table = kind;
  const title = internship ? "Internships" : "Courses";
  const Icon = internship ? BriefcaseBusiness : BookOpen;
  const [items, setItems] = useState<any[]>([]),
    [years, setYears] = useState<Year[]>([]),
    [semesters, setSemesters] = useState<Semester[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState<any | null>(null),
    [form, setForm] = useState<any>(internship ? internshipEmpty : courseEmpty),
    [file1, setFile1] = useState<File | null>(null),
    [file2, setFile2] = useState<File | null>(null);
  useEffect(() => {
    load();
  }, [kind]);
  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [a, y, s] = await Promise.all([
      supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("academic_years")
        .select("id,year_label")
        .order("sort_order"),
      supabase
        .from("semesters")
        .select("id,academic_year_id,name")
        .order("sort_order"),
    ]);
    setItems(a.data ?? []);
    setYears(y.data ?? []);
    setSemesters(s.data ?? []);
    setError(a.error?.message || y.error?.message || s.error?.message || "");
    setLoading(false);
  }
  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          (!internship ? status === "all" || x.status === status : true) &&
          (!query.trim() || matchesSearch(JSON.stringify(x), query)),
      ),
    [items, query, status, internship],
  );
  const selected = semesters.filter(
    (s) => s.academic_year_id === form.academic_year_id,
  );
  function add() {
    setEditing(null);
    setForm({ ...(internship ? internshipEmpty : courseEmpty) });
    setFile1(null);
    setFile2(null);
    setError("");
    setMessage("");
    setModal(true);
  }
  function edit(x: any) {
    setEditing(x);
    setFile1(null);
    setFile2(null);
    setError("");
    setForm(
      internship
        ? {
            ...internshipEmpty,
            academic_year_id: x.academic_year_id ?? "",
            semester_id: x.semester_id ?? "",
            company: x.company ?? "",
            role: x.role ?? "",
            start_date: x.start_date ?? "",
            end_date: x.end_date ?? "",
            internship_type: x.internship_type ?? "internship",
            location: x.location ?? "",
            description: x.description ?? "",
            technologies: (x.technologies ?? []).join(", "),
            skills: (x.skills ?? []).join(", "),
            company_url: x.company_url ?? "",
            notes: x.notes ?? "",
            tags: (x.tags ?? []).join(", "),
          }
        : {
            ...courseEmpty,
            academic_year_id: x.academic_year_id ?? "",
            semester_id: x.semester_id ?? "",
            course_name: x.course_name ?? "",
            platform: x.platform ?? "",
            organization_instructor: x.organization_instructor ?? "",
            start_date: x.start_date ?? "",
            completion_date: x.completion_date ?? "",
            duration: x.duration ?? "",
            skills_learned: (x.skills_learned ?? []).join(", "),
            course_url: x.course_url ?? "",
            status: x.status ?? "planned",
            notes: x.notes ?? "",
            tags: (x.tags ?? []).join(", "),
          },
    );
    setModal(true);
  }
  async function upload(f: File, folder: string) {
    if (f.size > MAX) throw new Error("Each file must be 15 MB or smaller.");
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowed.includes(f.type))
      throw new Error("Use PDF, JPG, PNG, or WebP.");
    const user = (await supabase!.auth.getUser()).data.user;
    if (!user) throw new Error("Session expired.");
    const safe = f.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    const path = `${user.id}/${kind}/${folder}/${crypto.randomUUID()}-${safe}`;
    const r = await supabase!.storage
      .from("portfolio-files")
      .upload(path, f, { contentType: f.type });
    if (r.error) throw r.error;
    return path;
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Your session has expired.");
      let payload: any = {
        user_id: user.id,
        academic_year_id: form.academic_year_id || null,
        semester_id: form.semester_id || null,
        notes: form.notes?.trim() || null,
        tags: list(form.tags || ""),
      };
      const old: string[] = [];
      if (internship) {
        if (!form.company.trim()) throw new Error("Company is required.");
        payload = {
          ...payload,
          company: form.company.trim(),
          role: form.role.trim() || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          internship_type: form.internship_type,
          location: form.location.trim() || null,
          description: form.description.trim() || null,
          technologies: list(form.technologies),
          skills: list(form.skills),
          company_url: form.company_url.trim() || null,
        };
        if (file1) {
          payload.certificate_path = await upload(file1, "certificates");
          payload.certificate_name = file1.name;
          payload.certificate_type = file1.type;
          payload.certificate_size = file1.size;
          if (editing?.certificate_path) old.push(editing.certificate_path);
        }
        if (file2) {
          payload.experience_letter_path = await upload(
            file2,
            "experience-letters",
          );
          payload.experience_letter_name = file2.name;
          payload.experience_letter_type = file2.type;
          payload.experience_letter_size = file2.size;
          if (editing?.experience_letter_path)
            old.push(editing.experience_letter_path);
        }
      } else {
        if (!form.course_name.trim())
          throw new Error("Course name is required.");
        payload = {
          ...payload,
          course_name: form.course_name.trim(),
          platform: form.platform.trim() || null,
          organization_instructor: form.organization_instructor.trim() || null,
          start_date: form.start_date || null,
          completion_date: form.completion_date || null,
          duration: form.duration.trim() || null,
          skills_learned: list(form.skills_learned),
          course_url: form.course_url.trim() || null,
          status: form.status,
        };
        if (file1) {
          payload.certificate_path = await upload(file1, "certificates");
          payload.certificate_name = file1.name;
          payload.certificate_type = file1.type;
          payload.certificate_size = file1.size;
          if (editing?.certificate_path) old.push(editing.certificate_path);
        }
      }
      let r;
      if (editing) {
        delete payload.user_id;
        r = await supabase.from(table).update(payload).eq("id", editing.id);
      } else r = await supabase.from(table).insert(payload);
      if (r.error) throw r.error;
      if (old.length)
        await supabase.storage.from("portfolio-files").remove(old);
      setMessage(
        `${internship ? "Internship" : "Course"} ${editing ? "updated" : "added"} successfully.`,
      );
      await load();
      setModal(false);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(x: any) {
    if (
      !supabase ||
      !confirm(`Delete “${internship ? x.company : x.course_name}”?`)
    )
      return;
    setBusy(true);
    const r = await supabase.from(table).delete().eq("id", x.id);
    if (r.error) setError(r.error.message);
    else {
      const paths = internship
        ? [x.certificate_path, x.experience_letter_path]
        : [x.certificate_path];
      const p = paths.filter(Boolean);
      if (p.length) await supabase.storage.from("portfolio-files").remove(p);
      setItems((v) => v.filter((i) => i.id !== x.id));
      setMessage("Deleted successfully.");
    }
    setBusy(false);
  }
  async function view(path: string) {
    try {
      await openFileLocation(
        supabase,
        "portfolio-files",
        path,
      );
    } catch (e: any) {
      setError(e?.message || "Could not open the stored file.");
    }
  }
  async function openLocation(path: string, fileName?: string, mimeType?: string) {
    try {
      await openFileLocation(
        supabase,
        "portfolio-files",
        path,
        fileName || path.split("/").pop() || "document",
        mimeType,
      );
    } catch (e: any) {
      setError(e.message || "Could not open the stored file.");
    }
  }
  async function download(path: string, fileName?: string, mimeType?: string) {
    try {
      await downloadFile(
        supabase,
        "portfolio-files",
        path,
        fileName || path.split("/").pop() || "document",
        mimeType,
      );
      setMessage("Document downloaded successfully.");
    } catch (e: any) {
      setError(e.message || "Could not download the stored file.");
    }
  }
  async function share(path: string, fileName?: string, mimeType?: string) {
    try {
      await shareFile(
        supabase,
        "portfolio-files",
        path,
        fileName || path.split("/").pop() || "document",
        mimeType,
      );
      setMessage("Document shared successfully.");
    } catch (e: any) {
      setError(e.message || "Could not share the stored file.");
    }
  }
  const nav = [
    ["Dashboard", "/dashboard"],
    ["My Journey", "/journey"],
    ["Academic Records", "/records"],
    ["Certificates", "/certificates"],
    ["Achievements", "/achievements"],
    ["Projects", "/projects"],
    ["Internships", "/internships"],
    ["Courses", "/courses"],
    ["Skills", "/skills"],
    ["Feedback", "/feedback"],
    ["Profile", "/profile"],
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <Logo />
        <nav className="nav">
          {nav.map(([n, p]) => (
            <Link
              className={
                (internship && p === "/internships") ||
                (!internship && p === "/courses")
                  ? "active"
                  : ""
              }
              key={p}
              to={p}
            >
              {n}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="simple-header">
          <div>
            <Link className="back-link" to="/dashboard">
              ← Dashboard
            </Link>
            <strong>{title}</strong>
          </div>
          <button className="btn primary" onClick={add}>
            <Plus size={17} /> Add {internship ? "internship" : "course"}
          </button>
        </header>
        <section className="portfolio-shell">
          <div className="profile-heading">
            <div>
              <p className="eyebrow">
                {internship ? "Experience" : "Learning"}
              </p>
              <h1>{title}</h1>
              <p className="muted">
                {internship
                  ? "Keep practical experience, technologies and evidence organized."
                  : "Track planned, in-progress and completed learning with certificate evidence."}
              </p>
            </div>
          </div>
          {message && <div className="success">{message}</div>}
          {error && <div className="error">{error}</div>}
          <div className="toolbar">
            <div className="search-box">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
              />
            </div>
            {!internship && (
              <select
                className="input compact"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            )}
            <span className="muted">
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
          {loading ? (
            <div className="portfolio-grid">
              {[1, 2, 3].map((i) => (
                <div className="card skeleton-row" key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card portfolio-empty">
              <div className="empty-icon">
                <Icon size={30} />
              </div>
              <h2>No {title.toLowerCase()} yet</h2>
              <p className="muted">
                Start building this part of your academic journey.
              </p>
              <button className="btn primary" onClick={add}>
                <Plus size={17} /> Add {internship ? "internship" : "course"}
              </button>
            </div>
          ) : (
            <div className="portfolio-grid">
              {filtered.map((x) => (
                <article className="card portfolio-card" key={x.id}>
                  <div className="portfolio-icon">
                    <Icon size={22} />
                  </div>
                  <div className="portfolio-body">
                    <div className="portfolio-top">
                      <div>
                        <h2>{internship ? x.company : x.course_name}</h2>
                        <div className="doc-meta">
                          {internship
                            ? x.role || "Internship"
                            : x.platform || "Independent"}
                          {(x.location || x.organization_instructor) &&
                            ` • ${x.location || x.organization_instructor}`}
                          <span
                            className={`status-badge ${internship ? "in_progress" : x.status}`}
                          >
                            {internship
                              ? x.internship_type.replaceAll("_", " ")
                              : x.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      <button
                        className="icon-btn danger-icon"
                        onClick={() => remove(x)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="portfolio-sub">
                      {internship
                        ? (x.start_date || "—") +
                          (x.end_date ? ` → ${x.end_date}` : "")
                        : x.completion_date
                          ? `Completed ${x.completion_date}`
                          : x.start_date
                            ? `Started ${x.start_date}`
                            : "No date set"}
                      {x.duration ? ` • ${x.duration}` : ""}
                    </p>
                    {(internship ? x.skills : x.skills_learned)?.length > 0 && (
                      <div className="tech-row">
                        {(internship ? x.skills : x.skills_learned)
                          .slice(0, 6)
                          .map((s: string) => (
                            <span key={s}>{s}</span>
                          ))}
                      </div>
                    )}
                    <div className="doc-actions">
                      {x.certificate_path && (
                        <>
                          <button
                            className="btn secondary"
                            onClick={() => view(x.certificate_path)}
                          >
                            <Eye size={15} /> Certificate
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => openLocation(x.certificate_path, x.certificate_name, x.certificate_type)}
                            aria-label="Open certificate file location"
                            title="Open certificate file location"
                          >
                            <FolderOpen size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => download(x.certificate_path, x.certificate_name, x.certificate_type)}
                            aria-label="Download certificate"
                            title="Download certificate"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => share(x.certificate_path, x.certificate_name, x.certificate_type)}
                            aria-label="Share certificate"
                            title="Share certificate"
                          >
                            <Share2 size={16} />
                          </button>
                        </>
                      )}
                      {internship && x.experience_letter_path && (
                        <>
                          <button
                            className="btn secondary"
                            onClick={() => view(x.experience_letter_path)}
                          >
                            <FileText size={15} /> Letter
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => openLocation(x.experience_letter_path, x.experience_letter_name, x.experience_letter_type)}
                            aria-label="Open experience letter file location"
                            title="Open experience letter file location"
                          >
                            <FolderOpen size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => download(x.experience_letter_path, x.experience_letter_name, x.experience_letter_type)}
                            aria-label="Download experience letter"
                            title="Download experience letter"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => share(x.experience_letter_path, x.experience_letter_name, x.experience_letter_type)}
                            aria-label="Share experience letter"
                            title="Share experience letter"
                          >
                            <Share2 size={16} />
                          </button>
                        </>
                      )}
                      {(internship ? x.company_url : x.course_url) && (
                        <a
                          className="btn secondary"
                          href={internship ? x.company_url : x.course_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={15} />{" "}
                          {internship ? "Company" : "Course"}
                        </a>
                      )}
                      <button className="btn secondary" onClick={() => edit(x)}>
                        <Edit3 size={15} /> Edit
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
        <Modal
          title={`${editing ? "Edit" : "Add"} ${internship ? "internship" : "course"}`}
          onClose={() => setModal(false)}
        >
          <form className="modal-form" onSubmit={save}>
            {internship ? (
              <>
                <label className="field">
                  <span>Company *</span>
                  <input
                    className="input"
                    value={form.company}
                    onChange={(e) =>
                      setForm({ ...form, company: e.target.value })
                    }
                    required
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Role</span>
                    <input
                      className="input"
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Internship type</span>
                    <select
                      className="input"
                      value={form.internship_type}
                      onChange={(e) =>
                        setForm({ ...form, internship_type: e.target.value })
                      }
                    >
                      <option value="internship">Internship</option>
                      <option value="summer">Summer</option>
                      <option value="winter">Winter</option>
                      <option value="part_time">Part time</option>
                      <option value="remote">Remote</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Start date</span>
                    <input
                      className="input"
                      type="date"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>End date</span>
                    <input
                      className="input"
                      type="date"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Location</span>
                    <input
                      className="input"
                      value={form.location}
                      onChange={(e) =>
                        setForm({ ...form, location: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Company URL</span>
                    <input
                      className="input"
                      type="url"
                      value={form.company_url}
                      onChange={(e) =>
                        setForm({ ...form, company_url: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Technologies</span>
                    <input
                      className="input"
                      value={form.technologies}
                      onChange={(e) =>
                        setForm({ ...form, technologies: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Skills</span>
                    <input
                      className="input"
                      value={form.skills}
                      onChange={(e) =>
                        setForm({ ...form, skills: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    className="input textarea"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label className="field">
                  <span>Course name *</span>
                  <input
                    className="input"
                    value={form.course_name}
                    onChange={(e) =>
                      setForm({ ...form, course_name: e.target.value })
                    }
                    required
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>Platform</span>
                    <input
                      className="input"
                      value={form.platform}
                      onChange={(e) =>
                        setForm({ ...form, platform: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Organization / instructor</span>
                    <input
                      className="input"
                      value={form.organization_instructor}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          organization_instructor: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Start date</span>
                    <input
                      className="input"
                      type="date"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Completion date</span>
                    <input
                      className="input"
                      type="date"
                      value={form.completion_date}
                      onChange={(e) =>
                        setForm({ ...form, completion_date: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Duration</span>
                    <input
                      className="input"
                      value={form.duration}
                      onChange={(e) =>
                        setForm({ ...form, duration: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select
                      className="input"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      <option value="planned">Planned</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Skills learned</span>
                  <input
                    className="input"
                    value={form.skills_learned}
                    onChange={(e) =>
                      setForm({ ...form, skills_learned: e.target.value })
                    }
                  />
                </label>
              </>
            )}
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
                {selected.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tags</span>
              <input
                className="input"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                className="input textarea"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            {internship ? (
              <>
                <label className="field">
                  <span>Certificate (optional)</span>
                  <input
                    className="input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setFile1(e.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="field">
                  <span>Experience letter (optional)</span>
                  <input
                    className="input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setFile2(e.target.files?.[0] ?? null)}
                  />
                </label>
              </>
            ) : (
              <label className="field">
                <span>Certificate (optional)</span>
                <input
                  className="input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setFile1(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModal(false)}
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
                    <Upload size={16} /> Save
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
