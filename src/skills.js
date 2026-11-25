// Skill catalog: canonical name -> category + aliases (lower-case) used to spot the skill in free text.
// Used by the offline CV extractor, by job-description tagging, and to normalise AI output.
const CATALOG = {
  // Web / software
  HTML: { category: 'Web', aliases: ['html', 'html5'] },
  CSS: { category: 'Web', aliases: ['css', 'css3', 'sass', 'scss'] },
  JavaScript: { category: 'Web', aliases: ['javascript', 'js', 'es6', 'ecmascript'] },
  TypeScript: { category: 'Web', aliases: ['typescript', 'ts'] },
  React: { category: 'Web', aliases: ['react', 'react.js', 'reactjs'] },
  'Next.js': { category: 'Web', aliases: ['next.js', 'nextjs'] },
  Vue: { category: 'Web', aliases: ['vue', 'vue.js', 'vuejs'] },
  Angular: { category: 'Web', aliases: ['angular'] },
  'Tailwind CSS': { category: 'Web', aliases: ['tailwind', 'tailwindcss', 'tailwind css'] },
  'Node.js': { category: 'Backend', aliases: ['node', 'node.js', 'nodejs'] },
  Express: { category: 'Backend', aliases: ['express', 'express.js', 'expressjs'] },
  'REST APIs': { category: 'Backend', aliases: ['rest', 'rest api', 'rest apis', 'restful', 'api integration', 'apis'] },
  GraphQL: { category: 'Backend', aliases: ['graphql'] },
  Python: { category: 'Programming', aliases: ['python'] },
  Django: { category: 'Backend', aliases: ['django'] },
  Flask: { category: 'Backend', aliases: ['flask'] },
  Java: { category: 'Programming', aliases: ['java'] },
  'Spring Boot': { category: 'Backend', aliases: ['spring', 'spring boot'] },
  'C#': { category: 'Programming', aliases: ['c#', 'csharp', '.net', 'dotnet', 'asp.net'] },
  'C++': { category: 'Programming', aliases: ['c++', 'cpp'] },
  PHP: { category: 'Backend', aliases: ['php', 'laravel'] },
  Go: { category: 'Programming', aliases: ['golang'] },
  Kotlin: { category: 'Mobile', aliases: ['kotlin'] },
  Swift: { category: 'Mobile', aliases: ['swift', 'swiftui'] },
  Flutter: { category: 'Mobile', aliases: ['flutter', 'dart'] },
  'React Native': { category: 'Mobile', aliases: ['react native'] },
  SQL: { category: 'Data', aliases: ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite', 'mariadb', 't-sql'] },
  MongoDB: { category: 'Data', aliases: ['mongodb', 'mongo'] },
  Git: { category: 'Tools', aliases: ['git', 'github', 'gitlab', 'version control'] },
  'Jest Testing': { category: 'Testing', aliases: ['jest', 'unit testing', 'react testing library', 'vitest'] },
  Docker: { category: 'DevOps', aliases: ['docker', 'containers', 'containerization'] },
  Kubernetes: { category: 'DevOps', aliases: ['kubernetes', 'k8s'] },
  AWS: { category: 'Cloud', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda'] },
  Azure: { category: 'Cloud', aliases: ['azure', 'microsoft azure'] },
  'Google Cloud': { category: 'Cloud', aliases: ['gcp', 'google cloud'] },
  'CI/CD': { category: 'DevOps', aliases: ['ci/cd', 'continuous integration', 'github actions', 'jenkins'] },
  Linux: { category: 'Tools', aliases: ['linux', 'bash', 'shell scripting', 'unix'] },
  // Data / AI
  Excel: { category: 'Data', aliases: ['excel', 'spreadsheets', 'microsoft excel', 'vlookup', 'pivot tables'] },
  'Power BI': { category: 'Data', aliases: ['power bi', 'powerbi'] },
  Tableau: { category: 'Data', aliases: ['tableau'] },
  'Data Analysis': { category: 'Data', aliases: ['data analysis', 'data analytics', 'analytics'] },
  'Data Visualization': { category: 'Data', aliases: ['data visualization', 'data visualisation', 'dashboards'] },
  Statistics: { category: 'Data', aliases: ['statistics', 'statistical analysis', 'regression'] },
  Pandas: { category: 'Data', aliases: ['pandas', 'numpy'] },
  'Machine Learning': { category: 'AI', aliases: ['machine learning', 'ml', 'scikit-learn', 'sklearn'] },
  'Deep Learning': { category: 'AI', aliases: ['deep learning', 'tensorflow', 'pytorch', 'neural networks'] },
  NLP: { category: 'AI', aliases: ['nlp', 'natural language processing', 'llm', 'llms'] },
  // Security / IT
  Cybersecurity: { category: 'Security', aliases: ['cybersecurity', 'cyber security', 'information security', 'infosec'] },
  Networking: { category: 'IT', aliases: ['networking', 'tcp/ip', 'ccna', 'routing', 'switching', 'network administration'] },
  'Penetration Testing': { category: 'Security', aliases: ['penetration testing', 'pentesting', 'ethical hacking', 'burp suite', 'metasploit'] },
  SIEM: { category: 'Security', aliases: ['siem', 'splunk', 'security monitoring', 'soc'] },
  'Incident Response': { category: 'Security', aliases: ['incident response', 'threat hunting', 'forensics'] },
  'Technical Support': { category: 'IT', aliases: ['technical support', 'it support', 'help desk', 'helpdesk', 'troubleshooting'] },
  // Design / product
  Figma: { category: 'Design', aliases: ['figma'] },
  'UI Design': { category: 'Design', aliases: ['ui design', 'user interface', 'ui/ux', 'visual design'] },
  'UX Research': { category: 'Design', aliases: ['ux research', 'user research', 'usability testing', 'ux'] },
  Prototyping: { category: 'Design', aliases: ['prototyping', 'wireframing', 'wireframes'] },
  'Adobe Creative Suite': { category: 'Design', aliases: ['photoshop', 'illustrator', 'adobe xd', 'indesign', 'adobe creative'] },
  'Product Management': { category: 'Product', aliases: ['product management', 'product manager', 'roadmap', 'product roadmap'] },
  Agile: { category: 'Product', aliases: ['agile', 'scrum', 'kanban', 'jira', 'sprint'] },
  // Business / marketing
  'Digital Marketing': { category: 'Marketing', aliases: ['digital marketing', 'online marketing'] },
  SEO: { category: 'Marketing', aliases: ['seo', 'search engine optimization', 'search engine optimisation'] },
  'Social Media': { category: 'Marketing', aliases: ['social media', 'social media marketing', 'instagram', 'tiktok marketing'] },
  'Content Writing': { category: 'Marketing', aliases: ['content writing', 'copywriting', 'content creation', 'blogging'] },
  'Google Analytics': { category: 'Marketing', aliases: ['google analytics', 'ga4'] },
  'Project Management': { category: 'Business', aliases: ['project management', 'pmp', 'prince2', 'project coordination'] },
  Communication: { category: 'Soft skills', aliases: ['communication', 'presentation skills', 'public speaking'] },
  Leadership: { category: 'Soft skills', aliases: ['leadership', 'team lead', 'mentoring'] },
  'Customer Service': { category: 'Business', aliases: ['customer service', 'customer support', 'client relations'] },
  Sales: { category: 'Business', aliases: ['sales', 'business development', 'lead generation', 'crm', 'salesforce'] },
  Accounting: { category: 'Finance', aliases: ['accounting', 'bookkeeping', 'quickbooks', 'financial reporting'] },
  'Financial Analysis': { category: 'Finance', aliases: ['financial analysis', 'financial modelling', 'financial modeling', 'budgeting', 'forecasting'] },
};

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Word-boundary-ish match that also works for names like "c++", ".net", "node.js".
const PATTERNS = Object.entries(CATALOG).map(([name, { aliases }]) => ({
  name,
  re: new RegExp(`(^|[^a-z0-9+#.])(${aliases.map(escape).join('|')})(?=$|[^a-z0-9+#])`, 'i'),
}));

/** Find catalog skills mentioned in free text. Returns canonical names. */
function findSkills(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  return PATTERNS.filter(p => p.re.test(t)).map(p => p.name);
}

const LOOKUP = new Map();
for (const [name, { aliases }] of Object.entries(CATALOG)) {
  LOOKUP.set(name.toLowerCase(), name);
  aliases.forEach(a => LOOKUP.set(a, name));
}
/** Map any skill label (e.g. from the AI) to its canonical catalog name, or a tidied version of itself. */
function canonical(label) {
  const raw = String(label || '').trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  return LOOKUP.get(raw.toLowerCase()) || findSkills(raw)[0] || raw.slice(0, 100);
}

const categoryOf = name => (CATALOG[name] && CATALOG[name].category) || 'Other';

module.exports = { CATALOG, findSkills, canonical, categoryOf };
