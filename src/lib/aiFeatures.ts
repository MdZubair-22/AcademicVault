export type AIRecord = {
  id: string;
  title: string;
  document_type?: string | null;
  institution?: string | null;
  document_date?: string | null;
  semester?: string | null;
  academic_year?: string | null;
  skills?: string[];
  tags?: string[];
  description?: string | null;
  ocr_text?: string | null;
  source_type?: string;
};

export type SkillEvidence = {
  skill: string;
  evidence: Array<{ id: string; title: string; type: string; institution?: string | null }>;
};

export type DuplicateCandidate = {
  incomingTitle: string;
  existingId: string;
  existingTitle: string;
  similarity: number;
  reason: string;
};

const STOP = new Set([
  "show","find","my","the","all","related","to","from","me","of","and",
  "documents","document","records","record","certificate","certificates",
  "internship","internships"
]);

export function smartSearch(query: string, records: AIRecord[]) {
  const terms = query.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean).filter(x => !STOP.has(x));
  if (!terms.length) return records;

  return records.map(record => {
    const haystack = [
      record.title, record.document_type, record.institution,
      record.semester, record.academic_year, record.description,
      ...(record.skills || []), ...(record.tags || []), record.ocr_text
    ].filter(Boolean).join(" ").toLowerCase();

    const matches = terms.filter(term => haystack.includes(term));
    return { record, score: matches.length / terms.length };
  })
  .filter(x => x.score > 0)
  .sort((a,b) => b.score - a.score)
  .map(x => x.record);
}

export function buildSkillEvidence(records: AIRecord[]): SkillEvidence[] {
  const map = new Map<string, SkillEvidence>();
  for (const record of records) {
    const skills = [...(record.skills || []), ...(record.tags || [])];
    for (const raw of skills) {
      const skill = raw.trim();
      if (!skill || skill.length < 2) continue;
      const key = skill.toLowerCase();
      if (!map.has(key)) map.set(key, { skill, evidence: [] });
      map.get(key)!.evidence.push({
        id: record.id,
        title: record.title,
        type: record.source_type || record.document_type || "Academic record",
        institution: record.institution,
      });
    }
  }
  return [...map.values()]
    .map(x => ({ ...x, evidence: x.evidence.filter((e,i,a) => a.findIndex(v => v.id === e.id) === i) }))
    .sort((a,b) => b.evidence.length - a.evidence.length);
}

function tokenSet(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(/\s+/).filter(Boolean));
}

function similarity(a: string, b: string) {
  const A=tokenSet(a), B=tokenSet(b);
  if (!A.size || !B.size) return 0;
  const intersection=[...A].filter(x=>B.has(x)).length;
  const union=new Set([...A,...B]).size;
  return intersection/union;
}

export function findDuplicates(incoming: AIRecord, existing: AIRecord[], threshold=0.70): DuplicateCandidate[] {
  const incomingText=[incoming.title,incoming.institution,incoming.document_type,...(incoming.skills||[]),...(incoming.tags||[]),incoming.ocr_text].filter(Boolean).join(" ");
  return existing.map(r => {
    const text=[r.title,r.institution,r.document_type,...(r.skills||[]),...(r.tags||[]),r.ocr_text].filter(Boolean).join(" ");
    const score=similarity(incomingText,text);
    return {
      incomingTitle: incoming.title,
      existingId: r.id,
      existingTitle: r.title,
      similarity: score,
      reason: score >= .85 ? "Very high title/content similarity" : score >= threshold ? "High metadata/content similarity" : "Partial similarity"
    };
  }).filter(x=>x.similarity>=threshold).sort((a,b)=>b.similarity-a.similarity);
}

export function generateAcademicSummary(records: AIRecord[], period: string) {
  const selected = period === "all" ? records : records.filter(r =>
    r.academic_year === period || r.semester === period
  );
  const skills = buildSkillEvidence(selected).slice(0,8).map(x=>x.skill);
  const counts = {
    records: selected.length,
    certificates: selected.filter(r=>/certificate/i.test(r.source_type||r.document_type||"")).length,
    internships: selected.filter(r=>/internship/i.test(r.source_type||r.document_type||"")).length,
    projects: selected.filter(r=>/project/i.test(r.source_type||"")).length,
    courses: selected.filter(r=>/course/i.test(r.source_type||"")).length,
    achievements: selected.filter(r=>/achievement|award/i.test(r.source_type||"")).length,
  };
  const parts:string[]=[];
  if(counts.records) parts.push(`AcademicVault contains ${counts.records} verified academic or achievement records for ${period === "all" ? "the selected collection" : period}.`);
  if(counts.certificates) parts.push(`${counts.certificates} certificate records`);
  if(counts.courses) parts.push(`${counts.courses} course records`);
  if(counts.internships) parts.push(`${counts.internships} internship records`);
  if(counts.projects) parts.push(`${counts.projects} project records`);
  if(counts.achievements) parts.push(`${counts.achievements} achievement records`);
  const body = parts.length > 1 ? parts.slice(1).join(", ") + "." : "";
  return {
    period,
    summary: parts.length ? `${parts[0]} ${body}`.trim() : `No verified AcademicVault records were found for ${period}.`,
    skills
  };
}
