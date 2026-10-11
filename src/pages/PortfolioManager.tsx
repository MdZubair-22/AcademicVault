import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Award,
  CalendarDays,
  Edit3,
  ExternalLink,
  FileImage,
  FileText,
  FolderOpen,
  Github,
  Loader2,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
  Eye,
  BriefcaseBusiness,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

import { Link } from 'react-router-dom';

import { supabase } from '../lib/supabase';
import { matchesSearch } from '../lib/search';
import { downloadFile, openFileLocation, shareFile } from '../lib/fileActions';
import { validateDocumentFile } from '../lib/ocrPipeline';

import Logo from '../components/Logo';

import {
  analyzeDocument,
  AIAnalysis,
} from '../lib/documentAI';

type Kind =
  | 'certificates'
  | 'achievements'
  | 'projects';

type Year = {
  id: string;
  year_label: string;
};

type Semester = {
  id: string;
  academic_year_id: string;
  name: string;
  semester_number: number | null;
};

function normalizeAcademicLabel(value?: string) {
  return (value || '').replace(/[\u2013\u2014]/g, '-').replace(/[^0-9]/g, '');
}

const configs = {
  certificates: {
    title: 'Certificates',
    eyebrow: 'Credentials',
    description:
      'Keep every certificate, course credential and training record organized.',
    table: 'certificates',
    icon: Award,
    categories: [
      'technical',
      'online_course',
      'workshop',
      'training',
      'internship',
      'participation',
      'language',
      'other',
    ],
  },

  achievements: {
    title: 'Achievements',
    eyebrow: 'Milestones',
    description:
      'Preserve hackathons, awards, scholarships, publications and moments worth remembering.',
    table: 'achievements',
    icon: Award,
    categories: [
      'hackathon',
      'competition',
      'award',
      'scholarship',
      'publication',
      'presentation',
      'leadership',
      'sports',
      'academic',
      'other',
    ],
  },

  projects: {
    title: 'Projects',
    eyebrow: 'Builds',
    description:
      'Document the work you have built, the problems you solved and the technology behind it.',
    table: 'projects',
    icon: BriefcaseBusiness,
    categories: [],
  },
} as const;

const emptyBase = {
  academic_year_id: '',
  semester_id: '',
  tags: '',
  description: '',
};

const MAX = 15 * 1024 * 1024;

function parseList(v: string) {
  return v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;

  if (n < 1048576) {
    return `${(n / 1024).toFixed(1)} KB`;
  }

  return `${(n / 1048576).toFixed(1)} MB`;
}

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
      onMouseDown={(e) =>
        e.target === e.currentTarget &&
        onClose()
      }
    >
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-title">
          <h2>{title}</h2>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export default function PortfolioManager({
  kind,
}: {
  kind: Kind;
}) {
  const c = configs[kind];

  const Icon = c.icon;

  const [items, setItems] =
    useState<any[]>([]);

  const [years, setYears] =
    useState<Year[]>([]);

  const [semesters, setSemesters] =
    useState<Semester[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  const [message, setMessage] =
    useState('');

  const [modal, setModal] =
    useState(false);

  const [editing, setEditing] =
    useState<any | null>(null);

  const [query, setQuery] =
    useState('');

  const [category, setCategory] =
    useState('all');

  const [form, setForm] =
    useState<any>({
      ...emptyBase,
    });

  const [file, setFile] =
    useState<File | null>(null);

  const [screenshots, setScreenshots] =
    useState<File[]>([]);

  /*
   * Certificate OCR state
   */
  const [ai, setAi] =
    useState<AIAnalysis | null>(null);

  const [aiBusy, setAiBusy] =
    useState(false);

  const [aiProgress, setAiProgress] =
    useState(0);

  const [previewUrl, setPreviewUrl] =
    useState('');

  const [showOCRText, setShowOCRText] =
    useState(false);

  const inputRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    load();
  }, [kind]);

  async function load() {
    if (!supabase) return;

    setLoading(true);
    setError('');

    const [
      a,
      y,
      s,
    ] = await Promise.all([
      supabase
        .from(c.table)
        .select('*')
        .order('created_at', {
          ascending: false,
        }),

      supabase
        .from('academic_years')
        .select(
          'id,year_label',
        )
        .order('sort_order'),

      supabase
        .from('semesters')
        .select(
          'id,academic_year_id,name,semester_number',
        )
        .order('sort_order'),
    ]);

    if (
      a.error ||
      y.error ||
      s.error
    ) {
      setError(
        (
          a.error ||
          y.error ||
          s.error
        )?.message ||
          'Could not load records.',
      );
    }

    setItems(a.data ?? []);

    setYears(
      (y.data ?? []) as Year[],
    );

    setSemesters(
      (s.data ?? []) as Semester[],
    );

    setLoading(false);
  }

  const filtered = useMemo(
    () =>
      items.filter((x) => {
        const text = JSON.stringify(x);

        return (
          (!query.trim() ||
            matchesSearch(text, query)) &&
          (category === 'all' ||
            x.category === category)
        );
      }),
    [
      items,
      query,
      category,
    ],
  );

  function resetAI() {
    setAi(null);
    setShowOCRText(false);
    setAiBusy(false);
    setAiProgress(0);
  }

  function openAdd() {
    setEditing(null);

    setFile(null);

    setScreenshots([]);

    resetAI();

    setError('');

    setMessage('');

    if (kind === 'certificates') {
      setForm({
        ...emptyBase,

        certificate_title: '',

        recipient_name: '',

        course_name: '',

        category: 'technical',

        issuing_organization: '',

        issue_date: '',

        certificate_id: '',

        skills: '',
      });
    } else if (
      kind === 'achievements'
    ) {
      setForm({
        ...emptyBase,

        title: '',

        category: 'other',

        organization: '',

        achievement_date: '',

        rank_position: '',

        location: '',

        url: '',
      });
    } else {
      setForm({
        ...emptyBase,

        title: '',

        problem_statement: '',

        technologies: '',

        role: '',

        start_date: '',

        end_date: '',

        github_url: '',

        live_demo_url: '',

        team_members: '',
      });
    }

    setModal(true);
  }

  function openEdit(x: any) {
    setEditing(x);

    setFile(null);

    setScreenshots([]);

    resetAI();

    setError('');

    setMessage('');

    if (kind === 'certificates') {
      setForm({
        ...emptyBase,

        academic_year_id:
          x.academic_year_id ?? '',

        semester_id:
          x.semester_id ?? '',

        certificate_title:
          x.certificate_title,

        recipient_name:
          x.recipient_name ?? '',

        course_name:
          x.course_name ?? '',

        category:
          x.category,

        issuing_organization:
          x.issuing_organization ?? '',

        issue_date:
          x.issue_date ?? '',

        certificate_id:
          x.certificate_id ?? '',

        skills:
          (x.skills ?? []).join(', '),

        grades:
          (x.ocr_metadata?.grades ?? []).join(', '),

        description:
          x.description ?? '',

        tags:
          (x.tags ?? []).join(', '),
      });
    } else if (
      kind === 'achievements'
    ) {
      setForm({
        ...emptyBase,

        academic_year_id:
          x.academic_year_id ?? '',

        semester_id:
          x.semester_id ?? '',

        title: x.title,

        category: x.category,

        organization:
          x.organization ?? '',

        achievement_date:
          x.achievement_date ?? '',

        rank_position:
          x.rank_position ?? '',

        location:
          x.location ?? '',

        url:
          x.url ?? '',

        description:
          x.description ?? '',

        tags:
          (x.tags ?? []).join(', '),
      });
    } else {
      setForm({
        ...emptyBase,

        academic_year_id:
          x.academic_year_id ?? '',

        semester_id:
          x.semester_id ?? '',

        title: x.title,

        problem_statement:
          x.problem_statement ?? '',

        technologies:
          (x.technologies ?? []).join(', '),

        role: x.role ?? '',

        start_date:
          x.start_date ?? '',

        end_date:
          x.end_date ?? '',

        github_url:
          x.github_url ?? '',

        live_demo_url:
          x.live_demo_url ?? '',

        team_members:
          (x.team_members ?? []).join(', '),

        description:
          x.description ?? '',

        tags:
          (x.tags ?? []).join(', '),
      });
    }

    setModal(true);
  }

  /*
   * ================================
   * CERTIFICATE OCR
   * ================================
   */

  async function runCertificateOCR(
    selectedFile: File,
  ) {
    if (
      kind !== 'certificates'
    ) {
      setFile(selectedFile);
      return;
    }

    setFile(selectedFile);

    setAi(null);
    setShowOCRText(false);

    setAiBusy(true);

    setAiProgress(0);

    setError('');

    setMessage('');

    try {
      const result =
        await analyzeDocument(
          selectedFile,
          (progress) => {
            setAiProgress(
              Math.round(
                progress * 100,
              ),
            );
          },
        );

      setAi(result);
      setShowOCRText(false);

      const detectedYear = years.find(
        (year) => normalizeAcademicLabel(year.year_label) === normalizeAcademicLabel(result.academicYear),
      );
      const detectedSemesterNumber = result.semester ? Number(result.semester) : null;
      const detectedSemester = semesters.find(
        (semester) =>
          semester.semester_number === detectedSemesterNumber &&
          (!detectedYear || semester.academic_year_id === detectedYear.id),
      );
      const fallbackSemester = detectedSemester || (!detectedYear && detectedSemesterNumber
        ? semesters.filter((semester) => semester.semester_number === detectedSemesterNumber).length === 1
          ? semesters.find((semester) => semester.semester_number === detectedSemesterNumber)
          : undefined
        : undefined);

      setForm(
        (previous: any) => ({
          ...previous,

          /*
           * IMPORTANT:
           * Do not overwrite manually entered
           * information with empty OCR results.
           */

          certificate_title:
            previous.certificate_title ||
            result.title ||
            '',

          recipient_name:
            previous.recipient_name ||
            result.holderName ||
            '',

          course_name:
            previous.course_name ||
            result.courseName ||
            '',

          issuing_organization:
            previous.issuing_organization ||
            result.institution ||
            '',

          issue_date:
            previous.issue_date ||
            result.documentDate ||
            '',

          certificate_id:
            previous.certificate_id ||
            result.certificateId ||
            '',

          skills:
            previous.skills ||
            result.skills.join(', '),

          grades:
            previous.grades ||
            result.grades.join(', '),

          academic_year_id:
            previous.academic_year_id ||
            detectedYear?.id ||
            fallbackSemester?.academic_year_id ||
            '',

          semester_id:
            previous.semester_id ||
            detectedSemester?.id ||
            fallbackSemester?.id ||
            '',
        }),
      );

      if (
        result.title ||
        result.institution ||
        result.documentDate ||
        result.certificateId
      ) {
        setMessage(
          'Certificate OCR completed. Review the detected information before saving.',
        );
      } else {
        setMessage(
          'OCR completed, but the certificate text was difficult to read. Please enter the details manually.',
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          'Certificate OCR failed.',
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function upload(
    path: string,
    f: File,
  ) {
    if (!supabase) {
      throw new Error(
        'Supabase is not connected.',
      );
    }

    if (f.size > MAX) {
      throw new Error(
        'Each file must be 15 MB or smaller.',
      );
    }

    await validateDocumentFile(f);

    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowed.includes(f.type)) {
      throw new Error(
        'Use PDF, JPG, PNG, or WebP files.',
      );
    }

    const safe =
      f.name
        .toLowerCase()
        .replace(
          /[^a-z0-9._-]+/g,
          '-',
        );

    const p = `${path}/${crypto.randomUUID()}-${safe}`;

    const r =
      await supabase.storage
        .from('portfolio-files')
        .upload(
          p,
          f,
          {
            contentType:
              f.type,
            upsert: false,
          },
        );

    if (r.error) {
      throw r.error;
    }

    return p;
  }

  async function save(
    e: FormEvent,
  ) {
    e.preventDefault();

    if (!supabase) return;

    setBusy(true);

    setError('');

    setMessage('');

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          'Your session has expired.',
        );
      }

      let payload: any = {
        user_id: user.id,

        academic_year_id:
          form.academic_year_id ||
          null,

        semester_id:
          form.semester_id ||
          null,

        description:
          form.description?.trim() ||
          null,

        tags: parseList(
          form.tags || '',
        ),
      };

      /*
       * CERTIFICATES
       */

      if (
        kind === 'certificates'
      ) {
        if (
          !form.certificate_title?.trim()
        ) {
          throw new Error(
            'Certificate title is required. OCR could not find a reliable title, so please enter it manually.',
          );
        }

        payload = {
          ...payload,

          certificate_title:
            form.certificate_title.trim(),

          recipient_name:
            form.recipient_name.trim() ||
            null,

          course_name:
            form.course_name.trim() ||
            null,

          category:
            form.category,

          issuing_organization:
            form.issuing_organization.trim() ||
            null,

          issue_date:
            form.issue_date ||
            null,

          certificate_id:
            form.certificate_id.trim() ||
            null,

          skills: parseList(
            form.skills || '',
          ),
          ocr_metadata: ai
            ? {
                categorySuggestion: ai.category,
                fieldEvidence: ai.fieldEvidence,
                warnings: ai.warnings,
                grades: parseList(form.grades || ''),
                extraction: {
                  kind: ai.extraction.kind,
                  pageCount: ai.extraction.pageCount,
                  processedPageCount: ai.extraction.processedPageCount,
                  nativeTextPageCount: ai.extraction.nativeTextPageCount,
                  ocrPageCount: ai.extraction.ocrPageCount,
                  processingTimeMs: ai.extraction.processingTimeMs,
                  imageWidth: ai.extraction.imageWidth ?? null,
                  imageHeight: ai.extraction.imageHeight ?? null,
                  imageQuality: ai.extraction.imageQuality ?? null,
                },
                confirmedFields: {
                  title: form.certificate_title.trim(),
                  holderName: form.recipient_name.trim() || null,
                  courseName: form.course_name.trim() || null,
                  institution: form.issuing_organization.trim() || null,
                  issueDate: form.issue_date || null,
                  certificateId: form.certificate_id.trim() || null,
                  skills: parseList(form.skills || ''),
                  grades: parseList(form.grades || ''),
                },
              }
            : file
              ? {
                  ...(editing?.ocr_metadata ?? {}),
                  warnings: [
                    'OCR did not complete; document fields were entered manually.',
                  ],
                  grades: parseList(form.grades || ''),
                  confirmedFields: {
                    title: form.certificate_title.trim(),
                    holderName: form.recipient_name.trim() || null,
                    courseName: form.course_name.trim() || null,
                    institution: form.issuing_organization.trim() || null,
                    issueDate: form.issue_date || null,
                    certificateId: form.certificate_id.trim() || null,
                    skills: parseList(form.skills || ''),
                    grades: parseList(form.grades || ''),
                  },
                }
              : {
                  ...(editing?.ocr_metadata ?? {}),
                  grades: parseList(form.grades || ''),
                  confirmedFields: {
                    ...(editing?.ocr_metadata?.confirmedFields ?? {}),
                    title: form.certificate_title.trim(),
                    holderName: form.recipient_name.trim() || null,
                    courseName: form.course_name.trim() || null,
                    institution: form.issuing_organization.trim() || null,
                    issueDate: form.issue_date || null,
                    certificateId: form.certificate_id.trim() || null,
                    skills: parseList(form.skills || ''),
                    grades: parseList(form.grades || ''),
                  },
                },
          ...(ai
            ? {
                ocr_text: ai.text,
                ocr_status: ai.extraction.qualityStatus,
                ocr_engine: ai.extraction.engine,
                ocr_engine_confidence:
                  ai.extraction.ocrEngineConfidence === null
                    ? null
                    : ai.extraction.ocrEngineConfidence / 100,
              }
            : file
              ? {
                  ocr_text: null,
                  ocr_status: 'failed',
                  ocr_engine: null,
                  ocr_engine_confidence: null,
                }
              : {}),
        };
      }

      /*
       * ACHIEVEMENTS
       */

      if (
        kind === 'achievements'
      ) {
        if (
          !form.title?.trim()
        ) {
          throw new Error(
            'Achievement title is required.',
          );
        }

        payload = {
          ...payload,

          title:
            form.title.trim(),

          category:
            form.category,

          organization:
            form.organization.trim() ||
            null,

          achievement_date:
            form.achievement_date ||
            null,

          rank_position:
            form.rank_position.trim() ||
            null,

          location:
            form.location.trim() ||
            null,

          url:
            form.url.trim() ||
            null,
        };
      }

      /*
       * PROJECTS
       */

      if (
        kind === 'projects'
      ) {
        if (
          !form.title?.trim()
        ) {
          throw new Error(
            'Project title is required.',
          );
        }

        payload = {
          ...payload,

          title:
            form.title.trim(),

          problem_statement:
            form.problem_statement.trim() ||
            null,

          technologies:
            parseList(
              form.technologies ||
                '',
            ),

          role:
            form.role.trim() ||
            null,

          start_date:
            form.start_date ||
            null,

          end_date:
            form.end_date ||
            null,

          github_url:
            form.github_url.trim() ||
            null,

          live_demo_url:
            form.live_demo_url.trim() ||
            null,

          team_members:
            parseList(
              form.team_members ||
                '',
            ),
        };
      }

      let oldPaths: string[] = [];

      /*
       * PROJECT FILES
       */

      if (
        kind === 'projects'
      ) {
        if (
          screenshots.length > 8
        ) {
          throw new Error(
            'Choose up to 8 files.',
          );
        }

        if (
          screenshots.length
        ) {
          const report =
            screenshots[0];

          const reportPath =
            await upload(
              `${user.id}/projects/reports`,
              report,
            );

          payload = {
            ...payload,

            report_path:
              reportPath,

            report_name:
              report.name,

            report_type:
              report.type,

            report_size:
              report.size,
          };

          if (
            editing?.report_path
          ) {
            oldPaths.push(
              editing.report_path,
            );
          }

          const paths: string[] =
            [];

          for (
            const f of screenshots.slice(
              1,
            )
          ) {
            paths.push(
              await upload(
                `${user.id}/projects/screenshots`,
                f,
              ),
            );
          }

          payload.screenshots = [
            ...(editing?.screenshots ??
              []),
            ...paths,
          ];
        }
      }

      /*
       * CERTIFICATE / ACHIEVEMENT FILE
       */

      else if (file) {
        const p =
          await upload(
            `${user.id}/${kind}`,
            file,
          );

        payload = {
          ...payload,

          file_path: p,

          file_name:
            file.name,

          file_type:
            file.type,

          file_size:
            file.size,
        };

        if (
          editing?.file_path
        ) {
          oldPaths.push(
            editing.file_path,
          );
        }
      }

      /*
       * UPDATE
       */

      if (editing) {
        delete payload.user_id;

        const { error } =
          await supabase
            .from(c.table)
            .update(payload)
            .eq(
              'id',
              editing.id,
            );

        if (error) {
          throw error;
        }

        if (
          oldPaths.length
        ) {
          await supabase.storage
            .from(
              'portfolio-files',
            )
            .remove(
              oldPaths,
            );
        }

        setMessage(
          `${c.title.slice(
            0,
            -1,
          )} updated.`,
        );
      }

      /*
       * INSERT
       */

      else {
        if (
          kind !== 'projects' &&
          !file
        ) {
          throw new Error(
            `Please choose a ${
              kind ===
              'certificates'
                ? 'certificate'
                : 'achievement'
            } file or image.`,
          );
        }

        const { error } =
          await supabase
            .from(c.table)
            .insert(
              payload,
            );

        if (error) {
          const paths = [
            payload.file_path,
            payload.report_path,
            ...(payload.screenshots ??
              []),
          ].filter(Boolean);

          if (
            paths.length
          ) {
            await supabase.storage
              .from(
                'portfolio-files',
              )
              .remove(
                paths,
              );
          }

          throw error;
        }

        setMessage(
          `${c.title.slice(
            0,
            -1,
          )} added.`,
        );
      }

      await load();

      setModal(false);
    } catch (err: any) {
      setError(
        err?.message ||
          'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(
    x: any,
  ) {
    if (
      !supabase ||
      !confirm(
        `Delete “${
          kind === 'certificates'
            ? x.certificate_title
            : x.title
        }”?`,
      )
    ) {
      return;
    }

    setBusy(true);

    setError('');

    try {
      const paths = [
        x.file_path,
        x.report_path,
        ...(x.screenshots ??
          []),
      ].filter(Boolean);

      const { error } =
        await supabase
          .from(c.table)
          .delete()
          .eq(
            'id',
            x.id,
          );

      if (error) {
        throw error;
      }

      if (paths.length) {
        await supabase.storage
          .from(
            'portfolio-files',
          )
          .remove(paths);
      }

      setItems((v) =>
        v.filter(
          (i) =>
            i.id !== x.id,
        ),
      );

      setMessage(
        'Deleted successfully.',
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not delete.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function openFile(
    x: any,
  ) {
    const path =
      x.file_path ||
      x.report_path;

    if (
      !supabase ||
      !path
    ) {
      return;
    }

    try {
      await openFileLocation(
        supabase,
        'portfolio-files',
        path,
        x.file_name || path.split('/').pop() || 'document',
        x.file_type,
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not open the stored file.',
      );
    }
  }

  async function openLocation(
    path: string,
    fileName?: string,
    mimeType?: string,
  ) {
    try {
      await openFileLocation(
        supabase,
        'portfolio-files',
        path,
        fileName || path.split('/').pop() || 'document',
        mimeType,
      );
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not open the stored file.',
      );
    }
  }

  function displayTitle(
    x: any,
  ) {
    return kind ===
      'certificates'
      ? x.certificate_title
      : x.title;
  }

  function meta(
    x: any,
  ) {
    const parts =
      kind ===
      'certificates'
        ? [
            x.issuing_organization,
            x.issue_date,
          ]
        : kind ===
            'achievements'
          ? [
              x.organization,
              x.achievement_date,
              x.rank_position,
            ]
          : [
              x.role,
              x.start_date &&
              x.end_date
                ? `${x.start_date} – ${x.end_date}`
                : x.start_date,
            ];

    return parts
      .filter(Boolean)
      .join(' • ');
  }

  const selectedSemesters =
    semesters.filter(
      (s) =>
        s.academic_year_id ===
        form.academic_year_id,
    );

  if (!supabase) {
    return (
      <div className="auth-shell">
        <div
          className="card"
          style={{
            padding: 28,
          }}
        >
          <Logo />

          <h2>
            Connect Supabase
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <Logo />

        <nav className="nav">
          <Link to="/dashboard">
            Dashboard
          </Link>

          <Link to="/journey">
            My Journey
          </Link>

          <Link to="/records">
            Academic Records
          </Link>

          <Link
            className={
              kind ===
              'certificates'
                ? 'active'
                : ''
            }
            to="/certificates"
          >
            Certificates
          </Link>

          <Link
            className={
              kind ===
              'achievements'
                ? 'active'
                : ''
            }
            to="/achievements"
          >
            Achievements
          </Link>

          <Link
            className={
              kind ===
              'projects'
                ? 'active'
                : ''
            }
            to="/projects"
          >
            Projects
          </Link>

          <Link to="/profile">
            Profile
          </Link>

          <Link to="/feedback">
            Feedback
          </Link>
        </nav>
      </aside>

      <main className="main">
        <header className="header">
          <Link
            to="/dashboard"
            className="back-link"
          >
            ← Dashboard
          </Link>

          <span className="email">
            AcademicVault
          </span>
        </header>

        <section className="content">
          <div className="portfolio-heading">
            <div>
              <p className="eyebrow">
                {c.eyebrow}
              </p>

              <h1>
                {c.title}
              </h1>

              <p className="muted">
                {c.description}
              </p>
            </div>

            <button
              className="btn primary"
              onClick={openAdd}
            >
              <Plus size={17} />

              Add{' '}
              {kind ===
              'certificates'
                ? 'certificate'
                : kind ===
                    'achievements'
                  ? 'achievement'
                  : 'project'}
            </button>
          </div>

          {(error ||
            message) && (
            <div
              className={
                error
                  ? 'error'
                  : 'success'
              }
              style={{
                marginBottom: 16,
              }}
            >
              {error || message}
            </div>
          )}

          <div className="card records-toolbar">
            <div className="search-box">
              <Search size={17} />

              <input
                value={query}
                onChange={(e) =>
                  setQuery(
                    e.target.value,
                  )
                }
                placeholder={`Search ${c.title.toLowerCase()}…`}
              />
            </div>

            {kind !==
            'projects' ? (
              <select
                className="input compact"
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value,
                  )
                }
              >
                <option value="all">
                  All categories
                </option>

                {c.categories.map(
                  (x) => (
                    <option
                      key={x}
                      value={x}
                    >
                      {x.replaceAll(
                        '_',
                        ' ',
                      )}
                    </option>
                  ),
                )}
              </select>
            ) : (
              <div
                className="muted"
                style={{
                  padding:
                    '0 10px',
                }}
              >
                Projects by
                technology
              </div>
            )}

            <span className="muted">
              {filtered.length}{' '}
              result
              {filtered.length ===
              1
                ? ''
                : 's'}
            </span>
          </div>

          {loading ? (
            <div className="records-list">
              {[1, 2, 3].map(
                (i) => (
                  <div
                    className="card skeleton-row"
                    key={i}
                  />
                ),
              )}
            </div>
          ) : filtered.length ===
            0 ? (
            <div className="card portfolio-empty">
              <div className="empty-icon">
                <Icon size={30} />
              </div>

              <h2>
                No{' '}
                {c.title.toLowerCase()}{' '}
                yet
              </h2>

              <p className="muted">
                {query
                  ? 'Try a different search.'
                  : `Start building your academic journey by adding your first ${
                      kind ===
                      'certificates'
                        ? 'certificate'
                        : kind ===
                            'achievements'
                          ? 'achievement'
                          : 'project'
                    }.`}
              </p>

              {!query && (
                <button
                  className="btn primary"
                  onClick={
                    openAdd
                  }
                >
                  <Plus size={17} />

                  Add now
                </button>
              )}
            </div>
          ) : (
            <div className="portfolio-grid">
              {filtered.map(
                (x) => (
                  <article
                    className="card portfolio-card"
                    key={x.id}
                  >
                    <div className="portfolio-icon">
                      <Icon
                        size={22}
                      />
                    </div>

                    <div className="portfolio-body">
                      <div className="portfolio-top">
                        <div>
                          <h2>
                            {displayTitle(
                              x,
                            )}
                          </h2>

                          <div className="doc-meta">
                            {meta(x) ||
                              'No additional details'}

                            {x.category && (
                              <span className="status-badge in_progress">
                                {x.category.replaceAll(
                                  '_',
                                  ' ',
                                )}
                              </span>
                            )}
                            {x.ocr_status && x.ocr_status !== 'not_processed' && (
                              <span className={`ocr-quality ocr-quality-${x.ocr_status === 'failed' ? 'low' : x.ocr_status}`}>
                                OCR {x.ocr_status}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          className="icon-btn danger-icon"
                          onClick={() =>
                            removeItem(
                              x,
                            )
                          }
                          aria-label="Delete"
                        >
                          <Trash2
                            size={16}
                          />
                        </button>
                      </div>

                      {kind ===
                        'certificates' && (
                        <p className="muted portfolio-sub">
                          {x.course_name ||
                            'Certificate'}

                          {x.certificate_id
                            ? ` • ID ${x.certificate_id}`
                            : ''}
                        </p>
                      )}

                      {kind ===
                        'achievements' &&
                        x.rank_position && (
                          <p className="portfolio-highlight">
                            {
                              x.rank_position
                            }
                          </p>
                        )}

                      {kind ===
                        'projects' && (
                        <div className="tech-row">
                          {(
                            x.technologies ??
                            []
                          )
                            .slice(
                              0,
                              6,
                            )
                            .map(
                              (
                                t: string,
                              ) => (
                                <span
                                  key={t}
                                >
                                  {t}
                                </span>
                              ),
                            )}
                        </div>
                      )}

                      {x.description && (
                        <p className="portfolio-desc">
                          {
                            x.description
                          }
                        </p>
                      )}

                      {(x.tags ??
                        []).length >
                        0 && (
                        <div className="tag-row">
                          {x.tags
                            .slice(
                              0,
                              5,
                            )
                            .map(
                              (
                                t: string,
                              ) => (
                                <span
                                  key={t}
                                >
                                  #{t}
                                </span>
                              ),
                            )}
                        </div>
                      )}

                      <div className="doc-actions">
                        {(x.file_path ||
                          x.report_path) && (
                          <button
                            className="btn secondary"
                            onClick={() =>
                              openFile(
                                x,
                              )
                            }
                          >
                            <Eye
                              size={
                                15
                              }
                            />

                            View
                          </button>
                        )}

                        {(x.file_path ||
                          x.report_path) && (
                          <button
                            className="btn secondary"
                            onClick={async () => {
                              try {
                                await downloadFile(
                                  supabase,
                                  'portfolio-files',
                                  x.file_path || x.report_path,
                                  x.file_name || (x.file_path || x.report_path).split('/').pop() || 'document',
                                  x.file_type,
                                );
                                setMessage('Document downloaded successfully.');
                              } catch (err: any) {
                                setError(err?.message || 'Could not download the stored file.');
                              }
                            }}
                          >
                            Download
                          </button>
                        )}

                        {(x.file_path || x.report_path) && (
                          <button
                            className="btn secondary"
                            onClick={async () => {
                              try {
                                await shareFile(
                                  supabase,
                                  'portfolio-files',
                                  x.file_path || x.report_path,
                                  x.file_name || (x.file_path || x.report_path).split('/').pop() || 'document',
                                  x.file_type,
                                );
                                setMessage('Document shared successfully.');
                              } catch (err: any) {
                                setError(err?.message || 'Could not share the stored file.');
                              }
                            }}
                          >
                            <Share2 size={15} /> Share
                          </button>
                        )}

                        {(x.file_path ||
                          x.report_path) && (
                          <button
                            className="icon-btn"
                            onClick={() =>
                              openLocation(
                                x.file_path || x.report_path,
                                x.file_name,
                                x.file_type,
                              )
                            }
                            aria-label="Open file location"
                            title="Open file location"
                          >
                            <FolderOpen
                              size={16}
                            />
                          </button>
                        )}

                        {kind ===
                          'achievements' &&
                          x.url && (
                            <a
                              className="btn secondary"
                              href={
                                x.url
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink
                                size={
                                  15
                                }
                              />

                              Link
                            </a>
                          )}

                        {kind ===
                          'projects' &&
                          x.github_url && (
                            <a
                              className="btn secondary"
                              href={
                                x.github_url
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Github
                                size={
                                  15
                                }
                              />

                              GitHub
                            </a>
                          )}

                        {kind ===
                          'projects' &&
                          x.live_demo_url && (
                            <a
                              className="btn secondary"
                              href={
                                x.live_demo_url
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink
                                size={
                                  15
                                }
                              />

                              Demo
                            </a>
                          )}

                        <button
                          className="btn secondary"
                          onClick={() =>
                            openEdit(
                              x,
                            )
                          }
                        >
                          <Edit3
                            size={
                              15
                            }
                          />

                          Edit
                        </button>
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
          )}
        </section>
      </main>

      {modal && (
        <Modal
          title={
            editing
              ? `Edit ${
                  kind ===
                  'certificates'
                    ? 'certificate'
                    : kind ===
                        'achievements'
                      ? 'achievement'
                      : 'project'
                }`
              : `Add ${
                  kind ===
                  'certificates'
                    ? 'certificate'
                    : kind ===
                        'achievements'
                      ? 'achievement'
                      : 'project'
                }`
          }
          onClose={() =>
            !busy &&
            setModal(false)
          }
        >
          <form
            className="modal-form"
            onSubmit={save}
          >
            {kind ===
            'certificates' ? (
              <>
                {/* =====================
                    CERTIFICATE UPLOAD
                    ===================== */}

                <div
                  className="upload-drop"
                  onClick={() =>
                    !aiBusy &&
                    inputRef.current?.click()
                  }
                >
                  <Upload size={24} />

                  <strong>
                    {file
                      ? file.name
                      : 'Choose certificate PDF, JPG, PNG or WebP'}
                  </strong>

                  <span>
                    {file
                      ? fmtSize(
                          file.size,
                        )
                      : 'Maximum 15 MB • OCR enabled'}
                  </span>

                  <input
                    ref={inputRef}
                    hidden
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const selected =
                        e.target.files?.[0];

                      if (
                        selected
                      ) {
                        runCertificateOCR(
                          selected,
                        );
                      }
                    }}
                  />
                </div>

                {/* =====================
                    OCR PROGRESS
                    ===================== */}

                {aiBusy && (
                  <div className="ai-analysis-card">
                    <div className="ai-analysis-head">
                      <div>
                        <strong>
                          AI is reading your certificate…
                        </strong>

                        <span>
                          High-resolution OCR + image enhancement + certificate field extraction
                        </span>
                      </div>

                      <Loader2
                        size={18}
                        className="spin"
                      />
                    </div>

                    <div className="ai-progress">
                      <i
                        style={{
                          width: `${aiProgress}%`,
                        }}
                      />
                    </div>

                    <small>
                      {aiProgress}% complete
                    </small>
                  </div>
                )}

                {previewUrl && (
                  <section className="ocr-original-preview" aria-label="Original certificate preview">
                    <strong>Original document preview</strong>
                    {file?.type === 'application/pdf' ? (
                      <iframe src={previewUrl} title="Original certificate document" />
                    ) : (
                      <img src={previewUrl} alt="Original uploaded certificate" />
                    )}
                  </section>
                )}

                {/* =====================
                    OCR RESULT
                    ===================== */}

                {ai && (
                  <div className="ai-analysis-card ai-complete">
                    <div className="ai-analysis-head">
                      <div>
                        <strong>
                          <Sparkles
                            size={16}
                          />{' '}
                          Certificate information detected
                        </strong>

                        <span>
                          Review the extracted information before saving.
                        </span>
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
                        <small>
                          Detected type
                        </small>

                        <strong>
                          {ai.category.replaceAll('_', ' ')}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Extracted title
                        </small>

                        <strong>
                          {ai.title ||
                            'Not detected'}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Institution
                        </small>

                        <strong>
                          {ai.institution ||
                            'Not detected'}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Issue date
                        </small>

                        <strong>
                          {ai.documentDate ||
                            'Not detected'}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Academic year
                        </small>

                        <strong>
                          {ai.academicYear ||
                            'Not detected'}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Semester
                        </small>

                        <strong>
                          {ai.semester
                            ? `Semester ${ai.semester}`
                            : 'Not detected'}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Certificate ID
                        </small>

                        <strong>
                          {ai.certificateId ||
                            'Not detected'}
                        </strong>
                      </div>

                      <div>
                        <small>
                          Course
                        </small>

                        <strong>
                          {ai.courseName ||
                            'Not detected'}
                        </strong>
                      </div>
                      <div>
                        <small>
                          Certificate holder
                        </small>

                        <strong>
                          {ai.holderName || 'Not detected'}
                        </strong>
                      </div>
                      {ai.grades.length > 0 && (
                        <div>
                          <small>Grades / marks</small>
                          <strong>{ai.grades.join(' • ')}</strong>
                        </div>
                      )}
                    </div>

                    {ai.skills.length >
                      0 && (
                      <div className="ai-tags">
                        <small>
                          Detected skills
                        </small>

                        <div>
                          {ai.skills.map(
                            (
                              skill,
                            ) => (
                              <span
                                key={
                                  skill
                                }
                              >
                                {
                                  skill
                                }
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                    <div className="ocr-review-actions">
                      <button
                        type="button"
                        className="btn secondary small-btn"
                        disabled={aiBusy || !file}
                        onClick={() => file && runCertificateOCR(file)}
                      >
                        <RotateCcw size={15} /> Retry OCR
                      </button>
                      <button
                        type="button"
                        className="btn secondary small-btn"
                        onClick={() => setShowOCRText((visible) => !visible)}
                      >
                        {showOCRText ? 'Hide extracted text' : 'Review extracted text'}
                      </button>
                    </div>
                    {showOCRText && (
                      <pre className="ocr-extracted-text">
                        {ai.text || 'No text was recognized.'}
                      </pre>
                    )}

                    {ai.warnings.map(
                      (
                        warning,
                        index,
                      ) => (
                        <div
                          className="ai-warning"
                          key={
                            index
                          }
                        >
                          {warning}
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* =====================
                    CERTIFICATE FIELDS
                    ===================== */}

                <label className="field">
                  <span>
                    Certificate title *
                  </span>

                  <input
                    className="input"
                    value={
                      form.certificate_title ??
                      ''
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        certificate_title:
                          e.target.value,
                      })
                    }
                    placeholder="e.g. Python Programming Certificate"
                    required
                  />
                  {ai && !ai.title && (
                    <small className="ocr-field-hint">Not detected reliably. Enter the title from the original document.</small>
                  )}
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>Certificate holder name</span>

                    <input
                      className="input"
                      value={form.recipient_name ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          recipient_name: e.target.value,
                        })
                      }
                      placeholder="Name shown on the certificate"
                    />
                    {ai && !ai.holderName && (
                      <small className="ocr-field-hint">Not detected from an explicit label. Verify against the original.</small>
                    )}
                  </label>

                  <label className="field">
                    <span>
                      Course name
                    </span>

                    <input
                      className="input"
                      value={
                        form.course_name ??
                        ''
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          course_name:
                            e.target.value,
                        })
                      }
                      placeholder="e.g. Python for Data Science"
                    />
                  </label>

                  <label className="field">
                    <span>
                      Category
                    </span>

                    <select
                      className="input"
                      value={
                        form.category
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category:
                            e.target.value,
                        })
                      }
                    >
                      {c.categories.map(
                        (x) => (
                          <option
                            key={x}
                            value={x}
                          >
                            {x.replaceAll(
                              '_',
                              ' ',
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      Issuing organization
                    </span>

                    <input
                      className="input"
                      value={
                        form.issuing_organization ??
                        ''
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          issuing_organization:
                            e.target.value,
                        })
                      }
                      placeholder="e.g. Google, Coursera, VTU"
                    />
                    {ai && !ai.institution && (
                      <small className="ocr-field-hint">Institution was not detected. Verify or enter it manually.</small>
                    )}
                  </label>

                  <label className="field">
                    <span>
                      Issue date
                    </span>

                    <input
                      className="input"
                      type="date"
                      value={
                        form.issue_date ??
                        ''
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          issue_date:
                            e.target.value,
                        })
                      }
                    />
                    {ai && !ai.documentDate && (
                      <small className="ocr-field-hint">Date was not detected reliably. Check the original document.</small>
                    )}
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      Certificate ID
                    </span>

                    <input
                      className="input"
                      value={
                        form.certificate_id ??
                        ''
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          certificate_id:
                            e.target.value,
                        })
                      }
                      placeholder="Certificate / credential number"
                    />
                  </label>

                  <label className="field">
                    <span>
                      Skills
                    </span>

                    <input
                      className="input"
                      value={
                        form.skills ??
                        ''
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          skills:
                            e.target.value,
                        })
                      }
                      placeholder="Python, SQL, Machine Learning"
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Grades / marks</span>

                  <input
                    className="input"
                    value={form.grades ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        grades: e.target.value,
                      })
                    }
                    placeholder="e.g. CGPA: 8.45, Percentage: 82%"
                  />
                  {ai && ai.grades.length === 0 && (
                    <small className="ocr-field-hint">No explicitly labeled grade or mark was detected.</small>
                  )}
                </label>
              </>
            ) : kind ===
              'achievements' ? (
              <>
                <label className="field">
                  <span>
                    Title *
                  </span>

                  <input
                    className="input"
                    value={
                      form.title
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        title:
                          e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      Category
                    </span>

                    <select
                      className="input"
                      value={
                        form.category
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category:
                            e.target.value,
                        })
                      }
                    >
                      {c.categories.map(
                        (x) => (
                          <option
                            key={x}
                            value={x}
                          >
                            {x.replaceAll(
                              '_',
                              ' ',
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="field">
                    <span>
                      Organization
                    </span>

                    <input
                      className="input"
                      value={
                        form.organization
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          organization:
                            e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      Date
                    </span>

                    <input
                      className="input"
                      type="date"
                      value={
                        form.achievement_date
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          achievement_date:
                            e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>
                      Rank / position
                    </span>

                    <input
                      className="input"
                      value={
                        form.rank_position
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          rank_position:
                            e.target.value,
                        })
                      }
                      placeholder="1st place"
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      Location
                    </span>

                    <input
                      className="input"
                      value={
                        form.location
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          location:
                            e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>
                      URL
                    </span>

                    <input
                      className="input"
                      type="url"
                      value={
                        form.url
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          url:
                            e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label className="field">
                  <span>
                    Project title *
                  </span>

                  <input
                    className="input"
                    value={
                      form.title
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        title:
                          e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      Role
                    </span>

                    <input
                      className="input"
                      value={
                        form.role
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          role:
                            e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>
                      Technologies
                    </span>

                    <input
                      className="input"
                      value={
                        form.technologies
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          technologies:
                            e.target.value,
                        })
                      }
                      placeholder="React, Python, Supabase"
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      Start date
                    </span>

                    <input
                      className="input"
                      type="date"
                      value={
                        form.start_date
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          start_date:
                            e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>
                      End date
                    </span>

                    <input
                      className="input"
                      type="date"
                      value={
                        form.end_date
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          end_date:
                            e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>
                      GitHub URL
                    </span>

                    <input
                      className="input"
                      type="url"
                      value={
                        form.github_url
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          github_url:
                            e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field">
                    <span>
                      Live demo URL
                    </span>

                    <input
                      className="input"
                      type="url"
                      value={
                        form.live_demo_url
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          live_demo_url:
                            e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <label className="field">
                  <span>
                    Problem statement
                  </span>

                  <textarea
                    className="input textarea"
                    value={
                      form.problem_statement
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        problem_statement:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label className="field">
                  <span>
                    Team members
                  </span>

                  <input
                    className="input"
                    value={
                      form.team_members
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        team_members:
                          e.target.value,
                      })
                    }
                    placeholder="Name, Name, Name"
                  />
                </label>
              </>
            )}

            {/* =====================
                COMMON FIELDS
                ===================== */}

            <label className="field">
              <span>
                Academic year
              </span>

              <select
                className="input"
                value={
                  form.academic_year_id
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    academic_year_id:
                      e.target.value,
                    semester_id:
                      '',
                  })
                }
              >
                <option value="">
                  Not linked
                </option>

                {years.map(
                  (y) => (
                    <option
                      key={y.id}
                      value={y.id}
                    >
                      {
                        y.year_label
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="field">
              <span>
                Semester
              </span>

              <select
                className="input"
                value={
                  form.semester_id
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    semester_id:
                      e.target.value,
                  })
                }
                disabled={
                  !form.academic_year_id
                }
              >
                <option value="">
                  Not linked
                </option>

                {selectedSemesters.map(
                  (s) => (
                    <option
                      key={s.id}
                      value={s.id}
                    >
                      {s.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="field">
              <span>
                Tags
              </span>

              <input
                className="input"
                value={
                  form.tags
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    tags:
                      e.target.value,
                  })
                }
                placeholder="AI, Python, 2026"
              />
            </label>

            <label className="field">
              <span>
                Description
              </span>

              <textarea
                className="input textarea"
                value={
                  form.description
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    description:
                      e.target.value,
                  })
                }
              />
            </label>

            {/* =====================
                PROJECT FILES
                ===================== */}

            {kind ===
              'projects' && (
              <label className="field">
                <span>
                  Project report /
                  screenshots
                </span>

                <input
                  ref={inputRef}
                  className="input"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const fs =
                      Array.from(
                        e.target
                          .files ??
                          [],
                      );

                    setScreenshots(
                      fs.slice(
                        0,
                        8,
                      ),
                    );

                    setFile(
                      fs[0] ??
                        null,
                    );
                  }}
                />

                <small>
                  First file is
                  saved as the
                  project report /
                  attachment;
                  additional files
                  are saved as
                  screenshots. Up
                  to 8 files, 15
                  MB each.
                </small>
              </label>
            )}

            {/* =====================
                ACHIEVEMENT FILE
                ===================== */}

            {kind !==
              'projects' &&
              kind !==
                'certificates' && (
                <label className="field">
                  <span>
                    {editing
                      ? 'Replace file (optional)'
                      : 'Achievement file *'}
                  </span>

                  <input
                    ref={inputRef}
                    className="input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) =>
                      setFile(
                        e.target
                          .files?.[0] ??
                          null,
                      )
                    }
                  />

                  <small>
                    PDF, JPG, PNG or
                    WebP up to 15 MB.
                  </small>
                </label>
              )}

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  setModal(
                    false,
                  )
                }
                disabled={
                  busy ||
                  aiBusy
                }
              >
                Cancel
              </button>

              <button
                className="btn primary"
                disabled={
                  busy ||
                  aiBusy
                }
              >
                {busy ? (
                  <>
                    <Loader2
                      size={16}
                      className="spin"
                    />

                    Saving…
                  </>
                ) : aiBusy ? (
                  <>
                    <Loader2
                      size={16}
                      className="spin"
                    />

                    Reading certificate…
                  </>
                ) : (
                  <>
                    <Upload
                      size={16}
                    />

                    {editing
                      ? 'Save changes'
                      : 'Save'}
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