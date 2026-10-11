import { useEffect, useMemo, useState } from "react";
import {
  Award,
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Search as SearchIcon,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Logo from "../components/Logo";
import { normalizeSearch, matchesSearch } from "../lib/search";

type LookupMap = Map<string, string>;

function makeLookup(
  rows: any[] | null | undefined,
  idField = "id",
  valueField = "name",
): LookupMap {
  return new Map<string, string>(
    (rows ?? []).map((row: any) => [
      String(row[idField]),
      String(row[valueField] ?? ""),
    ]),
  );
}

type Result = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  date: string | null;
  year: string | null;
  semester: string | null;
  institution: string | null;
  skills: string[];
  tags: string[];
  path: string;
  icon: any;
};

type Year = { id: string; year_label: string };
type Semester = { id: string; name: string; academic_year_id: string };

function normalize(v: any) {
  return normalizeSearch(v);
}
function includesAny(row: any, fields: string[], q: string) {
  if (!normalizeSearch(q)) return true;
  return fields.some((f) => matchesSearch(row?.[f], q));
}
function resultDate(v: any) {
  return v
    ? new Date(v).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [yearId, setYearId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [institution, setInstitution] = useState("");
  const [skill, setSkill] = useState("");
  const [docType, setDocType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [years, setYears] = useState<Year[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [rows, setRows] = useState<Result[]>([]);
  useEffect(() => {
    load();
  }, []);
  async function load() {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const [y, s, d, c, a, p, i, co, sk] = await Promise.all([
      supabase
        .from("academic_years")
        .select("id,year_label")
        .order("start_year", { ascending: true }),
      supabase
        .from("semesters")
        .select("id,name,academic_year_id")
        .order("semester_number", { ascending: true }),
      supabase
        .from("documents")
        .select(
          "id,title,document_type,document_date,institution,description,tags,academic_year_id,semester_id,created_at",
        ),
      supabase
        .from("certificates")
        .select(
          "id,certificate_title,course_name,issuing_organization,issue_date,skills,tags,category,academic_year_id,semester_id,created_at",
        ),
      supabase
        .from("achievements")
        .select(
          "id,title,organization,achievement_date,description,tags,category,academic_year_id,semester_id,created_at",
        ),
      supabase
        .from("projects")
        .select(
          "id,title,description,technologies,tags,start_date,end_date,academic_year_id,semester_id,created_at",
        ),
      supabase
        .from("internships")
        .select(
          "id,company,role,description,technologies,skills,tags,start_date,end_date,academic_year_id,semester_id,created_at",
        ),
      supabase
        .from("courses")
        .select(
          "id,course_name,platform,organization_instructor,skills_learned,tags,status,start_date,completion_date,academic_year_id,semester_id,created_at",
        ),
      supabase.from("skills").select("id,name,category,notes,created_at"),
    ]);
    const firstErr = [y, s, d, c, a, p, i, co, sk].find((r) => r.error);
    if (firstErr?.error) {
      setError(firstErr.error.message);
      setLoading(false);
      return;
    }
    setYears(y.data ?? []);
    setSemesters(s.data ?? []);
    const ym = makeLookup(y.data as any[], "id", "year_label");
    const sm = new Map((s.data ?? []).map((x) => [x.id, x.name]));
    const out: Result[] = [];
    (d.data ?? []).forEach((r) =>
      out.push({
        id: r.id,
        type: "Academic Records",
        title: r.title,
        subtitle: r.document_type.replaceAll("_", " "),
        date: r.document_date,
        year: ym.get(String(r.academic_year_id ?? "")) ?? null,
        semester:
          (sm.get(String(r.semester_id ?? "")) as string | undefined) ?? null,
        institution: r.institution || null,
        skills: [],
        tags: r.tags || [],
        path: "/records",
        icon: FileText,
      }),
    );
    (c.data ?? []).forEach((r) =>
      out.push({
        id: r.id,
        type: "Certificates",
        title: r.certificate_title,
        subtitle: r.issuing_organization || r.course_name || r.category,
        date: r.issue_date,
        year: ym.get(String(r.academic_year_id ?? "")) ?? null,
        semester:
          (sm.get(String(r.semester_id ?? "")) as string | undefined) ?? null,
        institution: r.issuing_organization || null,
        skills: r.skills || [],
        tags: r.tags || [],
        path: "/certificates",
        icon: Award,
      }),
    );
    (a.data ?? []).forEach((r) =>
      out.push({
        id: r.id,
        type: "Achievements",
        title: r.title,
        subtitle: r.organization || r.category,
        date: r.achievement_date,
        year: ym.get(String(r.academic_year_id ?? "")) ?? null,
        semester:
          (sm.get(String(r.semester_id ?? "")) as string | undefined) ?? null,
        institution: r.organization || null,
        skills: [],
        tags: r.tags || [],
        path: "/achievements",
        icon: Award,
      }),
    );
    (p.data ?? []).forEach((r) =>
      out.push({
        id: r.id,
        type: "Projects",
        title: r.title,
        subtitle: r.description || "Project",
        date: r.start_date || r.created_at,
        year: ym.get(String(r.academic_year_id ?? "")) ?? null,
        semester:
          (sm.get(String(r.semester_id ?? "")) as string | undefined) ?? null,
        institution: null,
        skills: r.technologies || [],
        tags: r.tags || [],
        path: "/projects",
        icon: BriefcaseBusiness,
      }),
    );
    (i.data ?? []).forEach((r) =>
      out.push({
        id: r.id,
        type: "Internships",
        title: r.company,
        subtitle: r.role || r.description || "Internship",
        date: r.start_date || r.created_at,
        year: ym.get(String(r.academic_year_id ?? "")) ?? null,
        semester:
          (sm.get(String(r.semester_id ?? "")) as string | undefined) ?? null,
        institution: r.company,
        skills: [...(r.skills || []), ...(r.technologies || [])],
        tags: r.tags || [],
        path: "/internships",
        icon: BriefcaseBusiness,
      }),
    );
    (co.data ?? []).forEach((r) =>
      out.push({
        id: r.id,
        type: "Courses",
        title: r.course_name,
        subtitle: r.platform || r.organization_instructor || r.status,
        date: r.completion_date || r.start_date || r.created_at,
        year: ym.get(String(r.academic_year_id ?? "")) ?? null,
        semester:
          (sm.get(String(r.semester_id ?? "")) as string | undefined) ?? null,
        institution: r.platform || r.organization_instructor,
        skills: r.skills_learned || [],
        tags: r.tags || [],
        path: "/courses",
        icon: BookOpen,
      }),
    );
    (sk.data ?? []).forEach((r) =>
      out.push({
        id: r.id,
        type: "Skills",
        title: r.name,
        subtitle: r.category || "Skill",
        date: r.created_at,
        year: null,
        semester: null,
        institution: null,
        skills: [r.name],
        tags: [],
        path: "/skills",
        icon: Sparkles,
      }),
    );
    setRows(out);
    setLoading(false);
  }
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (category !== "all" && r.type !== category) return false;
        if (yearId && r.year !== years.find((y) => y.id === yearId)?.year_label)
          return false;
        if (
          semesterId &&
          r.semester !== semesters.find((s) => s.id === semesterId)?.name
        )
          return false;
        if (
          !includesAny(
            r,
            [
              "title",
              "subtitle",
              "institution",
              "type",
              "year",
              "semester",
              "skills",
              "tags",
            ],
            query,
          )
        )
          return false;
        if (institution && !matchesSearch(r.institution, institution))
          return false;
        if (skill && !r.skills.some((s) => matchesSearch(s, skill)))
          return false;
        if (docType && r.subtitle !== docType.replaceAll("_", " "))
          return false;
        if (from && r.date && r.date < from) return false;
        if (to && r.date && r.date > to) return false;
        if ((from || to) && !r.date) return false;
        return true;
      }),
    [
      rows,
      query,
      category,
      yearId,
      semesterId,
      institution,
      skill,
      docType,
      from,
      to,
      years,
      semesters,
    ],
  );
  const groups = useMemo(
    () =>
      filtered.reduce(
        (m, r) => {
          (m[r.type] ??= []).push(r);
          return m;
        },
        {} as Record<string, Result[]>,
      ),
    [filtered],
  );
  const clear = () => {
    setQuery("");
    setCategory("all");
    setYearId("");
    setSemesterId("");
    setFrom("");
    setTo("");
    setInstitution("");
    setSkill("");
    setDocType("");
  };
  const categories = [
    "Academic Records",
    "Certificates",
    "Achievements",
    "Projects",
    "Internships",
    "Courses",
    "Skills",
  ];
  return (
    <div className="app">
      <aside className="sidebar">
        <Logo />
        <nav className="nav">
          {[
            ["Dashboard", "/dashboard"],
            ["My Journey", "/journey"],
            ["Academic Records", "/records"],
            ["Certificates", "/certificates"],
            ["Achievements", "/achievements"],
            ["Projects", "/projects"],
            ["Internships", "/internships"],
            ["Courses", "/courses"],
            ["Skills", "/skills"],
            ["Analytics", "/analytics"],
            ["Search", "/search"],
            ["Feedback", "/feedback"],
            ["Profile", "/profile"],
          ].map(([n, p]) => (
            <Link key={n} className={n === "Search" ? "active" : ""} to={p}>
              {n}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="simple-header">
          <div className="page-header-group">
            <Link className="back-link" to="/dashboard">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
            <strong>Search</strong>
          </div>
          <span className="muted">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </span>
        </header>
        <section className="search-shell">
          <div className="search-hero">
            <div>
              <p className="eyebrow">Global vault search</p>
              <h1>Find anything in your journey</h1>
              <p className="muted">
                Search academic records, certificates, achievements, projects,
                internships, courses and skills using real saved data.
              </p>
            </div>
          </div>
          <div className="card search-panel">
            <div className="global-search">
              <SearchIcon size={19} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try Python, SQL, Semester 6, Hackathon, 2026…"
              />
              <button
                className="icon-btn"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={16} />
              </button>
            </div>
            <div className="filter-grid">
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                className="input"
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
              >
                <option value="">All years</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.year_label}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
              >
                <option value="">All semesters</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Institution / organization"
              />
              <input
                className="input"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                placeholder="Skill / technology"
              />
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="From date"
              />
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To date"
              />
              <select
                className="input"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <option value="">Document type</option>
                {[
                  "marksheet",
                  "grade_card",
                  "transcript",
                  "academic_letter",
                  "degree",
                  "other",
                ].map((x) => (
                  <option key={x} value={x}>
                    {x.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn secondary" onClick={clear}>
              Clear filters
            </button>
          </div>
          {error && <div className="error">{error}</div>}
          {loading ? (
            <div className="search-results">
              <div className="card skeleton-row" />
              <div className="card skeleton-row" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="card search-empty">
              <div className="empty-icon">
                <SearchIcon size={30} />
              </div>
              <h2>No matching records</h2>
              <p className="muted">
                Try a broader keyword or clear one of the filters.
              </p>
              <button className="btn primary" onClick={clear}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="search-results">
              {Object.entries(groups).map(([type, items]) => (
                <section className="result-group" key={type}>
                  <div className="result-group-title">
                    <h2>{type}</h2>
                    <span>{items.length}</span>
                  </div>
                  {items.map((r) => {
                    const Icon = r.icon;
                    return (
                      <article
                        className="card result-card"
                        key={`${r.type}-${r.id}`}
                      >
                        <div className="result-icon">
                          <Icon size={20} />
                        </div>
                        <div className="result-main">
                          <div className="result-top">
                            <div>
                              <h3>{r.title}</h3>
                              <p className="muted">{r.subtitle}</p>
                            </div>
                            <Link
                              className="btn secondary small-btn"
                              to={r.path}
                            >
                              Open
                            </Link>
                          </div>
                          <div className="result-meta">
                            {r.date && (
                              <span>
                                <CalendarDays size={13} />
                                {resultDate(r.date)}
                              </span>
                            )}
                            {r.year && <span>{r.year}</span>}
                            {r.semester && <span>{r.semester}</span>}
                            {r.institution && <span>{r.institution}</span>}
                          </div>
                          {(r.skills.length > 0 || r.tags.length > 0) && (
                            <div className="tag-row">
                              {[...r.skills, ...r.tags]
                                .slice(0, 8)
                                .map((x, i) => (
                                  <span key={`${x}-${i}`}>{x}</span>
                                ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
