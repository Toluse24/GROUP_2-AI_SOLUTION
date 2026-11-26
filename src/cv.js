// CV reading + skill extraction. Grok is used when configured; otherwise a keyword extractor runs.
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const ai = require('./ai');
const { findSkills, canonical } = require('./skills');

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.pdf') {
    const { getDocumentProxy, extractText: pdfText } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(filePath)));
    return (await pdfText(pdf, { mergePages: true })).text;
  }
  if (ext === '.docx') return (await mammoth.extractRawText({ path: filePath })).value;
  if (ext === '.txt') return fs.readFileSync(filePath, 'utf8');
  const err = new Error('Old .doc files cannot be read. Please save your CV as PDF or DOCX and upload again.');
  err.status = 400;
  throw err;
}

const MODIFIERS = 'junior|senior|lead|principal|graduate|entry[- ]level|mid[- ]level|associate|front[- ]?end|back[- ]?end|full[- ]?stack|software|web|mobile|data|product|ux|ui|ux/ui|ui/ux|cyber ?security|security|soc|cloud|devops|network|systems?|it|qa|test|machine learning|ml|ai|marketing|digital|social media|seo|content|business|financial|finance|project|operations|sales|customer success|hr|graphic|visual|brand|support';
const ROLES = 'engineer|developer|analyst|designer|manager|specialist|consultant|scientist|administrator|officer|coordinator|architect|technician|accountant|marketer|writer|intern|researcher|strategist|executive';
const ROLE_RE = new RegExp(String.raw`\b(?:(?:${MODIFIERS})\s+){1,3}(?:${ROLES})\b`, 'i');

function keywordExtract(text) {
  // Title = 1-3 known modifiers + a role word, searched near the top (PDF text often has no line breaks).
  const m = text.slice(0, 500).match(ROLE_RE);
  const roleLine = m ? m[0].replace(/\s+/g, ' ').trim().replace(/(^|[\s/-])(\w)/g, (_, sep, c) => sep + c.toUpperCase()) : null;
  const years = [...text.matchAll(/(\d{1,2})\+?\s*(?:years?|yrs?)/gi)].map(m => Number(m[1])).filter(n => n < 45);
  const maxYears = years.length ? Math.max(...years) : 0;
  const level = maxYears >= 6 ? 'Senior' : maxYears >= 3 ? 'Mid-level' : maxYears >= 1 ? 'Junior' : 'Entry-level';
  const skills = findSkills(text).map(name => ({ name, proficiency: 3 }));
  return {
    source: 'keyword',
    detected_role: roleLine ? roleLine.replace(/[|•·].*$/, '').trim().slice(0, 120) : null,
    experience_level: level,
    summary: skills.length
      ? `${level} profile with ${skills.length} recognised skills including ${skills.slice(0, 4).map(s => s.name).join(', ')}.`
      : 'No recognised skills were found in this CV. Add skills manually below.',
    skills,
  };
}

async function aiExtract(text) {
  const result = await ai.chatJSON([
    {
      role: 'system',
      content:
        'You extract structured data from CVs/resumes. Reply with JSON only, matching exactly: ' +
        '{"detected_role": string (the job title this person is best suited for next), ' +
        '"experience_level": "Entry-level"|"Junior"|"Mid-level"|"Senior", ' +
        '"summary": string (max 2 sentences, second person, e.g. "You are..."), ' +
        '"skills": [{"name": string (short standard name, e.g. "JavaScript", "SQL", "Figma", "Project Management"), "proficiency": 1-5}]}. ' +
        'Include technical tools, languages, frameworks, methods and key professional skills that are evidenced in the CV. ' +
        'Maximum 25 skills. Do not invent skills that are not in the CV.',
    },
    { role: 'user', content: text.slice(0, 12000) },
  ], { maxTokens: 1200 });
  if (!result || !Array.isArray(result.skills)) return null;
  const seen = new Set();
  const skills = result.skills
    .map(s => ({ name: canonical(typeof s === 'string' ? s : s.name), proficiency: Math.min(5, Math.max(1, Number(s.proficiency) || 3)) }))
    .filter(s => s.name && !seen.has(s.name.toLowerCase()) && seen.add(s.name.toLowerCase()))
    .slice(0, 25);
  if (!skills.length) return null;
  return {
    source: 'ai',
    detected_role: String(result.detected_role || '').slice(0, 120) || null,
    experience_level: String(result.experience_level || '').slice(0, 40) || null,
    summary: String(result.summary || '').slice(0, 500) || null,
    skills,
  };
}

/** Returns { text, source, detected_role, experience_level, summary, skills:[{name, proficiency 1-5}] } */
async function analyseCV(filePath, originalName) {
  const text = (await extractText(filePath, originalName) || '').replace(/\u0000/g, '').trim();
  if (text.length < 40) {
    const err = new Error('We could not read any text from this file. If it is a scanned image, please upload a text-based PDF or DOCX.');
    err.status = 400;
    throw err;
  }
  const extracted = (await aiExtract(text)) || keywordExtract(text);
  return { text, ...extracted };
}

module.exports = { analyseCV, keywordExtract };
