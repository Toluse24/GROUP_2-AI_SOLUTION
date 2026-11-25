// AI tutor: teaches a missing skill in the context of the user's CV and a target job.
// Uses Grok when configured; otherwise a scripted offline tutor with real lesson content.
const ai = require('./ai');
const { resourcesFor } = require('./learning');
const { categoryOf } = require('./skills');

// ---------- offline lesson content ----------
const LESSONS = {
  TypeScript: {
    what: 'TypeScript is JavaScript with **types**. You describe the shape of your data once, and the editor catches mistakes (like a typo in a property name or passing a string where a number is expected) *before* the code runs.',
    concepts: ['Basic types: `string`, `number`, `boolean`, arrays like `string[]`', '`type` and `interface` to describe objects', 'Optional (`?`) and union types (`"admin" | "user"`)', 'Typing function parameters and return values', 'Generics, e.g. `useState<User | null>(null)`', 'Typing React props'],
    example: 'type User = { id: number; name: string; email?: string };\n\nfunction greet(user: User): string {\n  return `Hello, ${user.name}!`;\n}\n\ngreet({ id: 1, name: "Amara" });   // ✅\ngreet({ id: 1 });                   // ❌ error: name is missing',
    exercise: 'Take one React component you already wrote and convert it to `.tsx`. Add a `Props` type for its props and fix every red underline the editor shows.',
    project: 'Rebuild a small to-do app in React + TypeScript: a `Todo` type, typed `useState<Todo[]>`, typed event handlers, and a component with typed props.',
    quiz: [['What does the `?` in `email?: string` mean?', 'The property is optional: it can be a string or missing (undefined).'],
      ['What is the difference between `any` and `unknown`?', '`any` turns type checking off; `unknown` forces you to check the type before using the value, so it is safer.'],
      ['How do you type a React component\'s props?', 'Declare `type Props = { ... }` and write `function Card({ title }: Props)`.']],
    interview: ['Why would a team adopt TypeScript?', 'type vs interface: when would you use each?', 'How do you type an API response you fetch?'],
  },
  'REST APIs': {
    what: 'A **REST API** lets a front end talk to a server over HTTP. Each URL is a *resource* (like `/api/jobs`), and the HTTP method says what to do with it: `GET` reads, `POST` creates, `PUT/PATCH` updates, `DELETE` removes. Data usually travels as **JSON**.',
    concepts: ['HTTP methods and what each one means', 'Status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Server Error', 'Request/response bodies in JSON', 'Calling APIs with `fetch` and `async/await`', 'Loading, error and empty states in the UI', 'Headers and authentication tokens'],
    example: 'async function loadJobs() {\n  const res = await fetch("/api/jobs");\n  if (!res.ok) throw new Error(`Request failed: ${res.status}`);\n  const jobs = await res.json();\n  return jobs;\n}\n\n// create\nawait fetch("/api/jobs", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ title: "React Developer" })\n});',
    exercise: 'Open your browser DevTools → Network tab on any website, click a request marked "fetch/XHR", and identify its method, URL, status code and JSON response.',
    project: 'Build a "Job board" page in React that fetches from a free public API (for example `https://remotive.com/api/remote-jobs?limit=10`), shows a loading spinner, handles errors, and lets the user filter results.',
    quiz: [['Which HTTP method should create a new record?', '`POST`.'],
      ['What does status code 404 mean?', 'The resource was not found.'],
      ['Why check `res.ok` after `fetch`?', '`fetch` only rejects on network failure; a 404 or 500 still resolves, so you must check `res.ok` yourself.']],
    interview: ['Explain the difference between PUT and PATCH.', 'How do you handle loading and error states when calling an API?', 'What is CORS and why does it happen?'],
  },
  'Jest Testing': {
    what: '**Jest** is a JavaScript testing framework. You write small automated tests that call your code and check the result, so you know a change didn\'t break anything. With **React Testing Library** you test components the way a user would use them.',
    concepts: ['`test()` / `it()` and `expect()` matchers like `toBe`, `toEqual`', 'Arrange → Act → Assert structure', 'Rendering components with React Testing Library', 'Finding elements by role/text (`getByRole`, `getByText`)', 'Simulating clicks and typing with `user-event`', 'Mocking API calls'],
    example: '// sum.js\nexport const sum = (a, b) => a + b;\n\n// sum.test.js\nimport { sum } from "./sum";\n\ntest("adds two numbers", () => {\n  expect(sum(2, 3)).toBe(5);\n});',
    exercise: 'Install Jest in a small project (`npm i -D jest`), write a `formatSalary()` helper, and write three tests for it, including one edge case.',
    project: 'Add tests to your React to-do app: it renders the empty state, adding a task shows it in the list, and deleting removes it.',
    quiz: [['What is the difference between `toBe` and `toEqual`?', '`toBe` checks identity (same value/reference); `toEqual` compares the contents of objects and arrays.'],
      ['Why prefer `getByRole` over test IDs?', 'It queries the page the way users and screen readers see it, which makes tests more realistic and accessible.'],
      ['Why mock API calls in unit tests?', 'So tests are fast, reliable and don\'t depend on a real server.']],
    interview: ['What would you test in a login form?', 'Unit vs integration vs end-to-end tests?', 'How do you test a component that fetches data?'],
  },
  'Node.js': {
    what: '**Node.js** runs JavaScript on the server. It lets you build back ends, APIs and command-line tools using the language you already know from the browser.',
    concepts: ['Modules with `require`/`import` and npm packages', 'The event loop and why Node is non-blocking', 'Reading files and environment variables', '`async/await` with promises', 'Building an HTTP server', 'Handling errors and logging'],
    example: 'import http from "node:http";\n\nhttp.createServer((req, res) => {\n  res.writeHead(200, { "Content-Type": "application/json" });\n  res.end(JSON.stringify({ message: "Hello from Node" }));\n}).listen(3000);',
    exercise: 'Write a Node script that reads a JSON file of jobs and prints the ones whose title contains "Developer".',
    project: 'Build a small notes API with Node + Express that saves notes to a JSON file, then connect your React app to it.',
    quiz: [['What is npm?', 'Node\'s package manager, used to install and manage libraries.'], ['Why is Node good for I/O-heavy apps?', 'Its non-blocking event loop handles many requests without waiting on each one.'], ['How do you read an environment variable?', '`process.env.NAME`.']],
    interview: ['Explain the Node event loop simply.', 'How do you handle errors in async code?', 'What goes in package.json?'],
  },
  Express: {
    what: '**Express** is the most popular web framework for Node.js. It gives you routing (`app.get("/jobs", ...)`), middleware and helpers to build APIs quickly.',
    concepts: ['Routes and HTTP methods', 'Request params, query strings and JSON bodies', 'Middleware (logging, auth, `express.json()`)', 'Returning status codes and JSON', 'Error-handling middleware', 'Connecting to a database'],
    example: 'import express from "express";\nconst app = express();\napp.use(express.json());\n\nconst jobs = [];\napp.get("/api/jobs", (req, res) => res.json(jobs));\napp.post("/api/jobs", (req, res) => {\n  jobs.push(req.body);\n  res.status(201).json(req.body);\n});\n\napp.listen(3000);',
    exercise: 'Create an Express app with `GET /api/skills` and `POST /api/skills`, then test both with your browser and a tool like Thunder Client or Postman.',
    project: 'Build a CRUD API for a "saved jobs" list with Express + MySQL and call it from a React page.',
    quiz: [['What does `express.json()` do?', 'It parses JSON request bodies into `req.body`.'], ['What is middleware?', 'A function that runs between the request and your route handler, e.g. for logging or auth.'], ['Which status code fits a successful create?', '201 Created.']],
    interview: ['How would you protect a route so only signed-in users can access it?', 'How do you structure a larger Express app?', 'How do you validate request bodies?'],
  },
  Vue: {
    what: '**Vue** is a progressive JavaScript framework for building user interfaces. Like React it is component-based, but it uses HTML-like templates and a very gentle learning curve.',
    concepts: ['Single-file components (`.vue`)', 'Reactive state with `ref` and `reactive`', 'Template directives: `v-if`, `v-for`, `v-model`', 'Props and emitted events', 'Computed properties and watchers', 'Vue Router and Pinia for larger apps'],
    example: '<script setup>\nimport { ref } from "vue";\nconst count = ref(0);\n</script>\n\n<template>\n  <button @click="count++">Clicked {{ count }} times</button>\n</template>',
    exercise: 'Do the first 5 steps of the official interactive Vue tutorial and compare each concept with the React equivalent you already know.',
    project: 'Rebuild one of your React projects in Vue to prove you can transfer your component skills.',
    quiz: [['What does `v-model` do?', 'Two-way binds a form input to a piece of state.'], ['React `useState` vs Vue `ref`?', 'Both hold reactive state; in Vue you read/write `.value` in script and use it directly in templates.'], ['How does a child talk to its parent?', 'By emitting an event with `emit`.']],
    interview: ['Compare Vue and React.', 'What are computed properties for?', 'How do you share state between components?'],
  },
  'Next.js': {
    what: '**Next.js** is a React framework that adds routing, server-side rendering and API routes, so you can build fast, SEO-friendly full-stack apps.',
    concepts: ['File-based routing with the `app/` directory', 'Server vs client components', 'Data fetching on the server', 'Layouts and loading states', 'API route handlers', 'Deploying to Vercel'],
    example: '// app/jobs/page.tsx\nexport default async function JobsPage() {\n  const res = await fetch("https://remotive.com/api/remote-jobs?limit=5");\n  const { jobs } = await res.json();\n  return <ul>{jobs.map(j => <li key={j.id}>{j.title}</li>)}</ul>;\n}',
    exercise: 'Follow the first chapters of the official "Learn Next.js" course and deploy the starter to Vercel.',
    project: 'Convert your portfolio site to Next.js with a `/projects/[slug]` dynamic route.',
    quiz: [['What decides a page\'s URL in Next.js?', 'Its folder/file path inside `app/`.'], ['Why render on the server?', 'Faster first load and better SEO.'], ['How do you make a component interactive?', 'Add `"use client"` at the top.']],
    interview: ['Server components vs client components?', 'How does Next.js help SEO?', 'When would you use an API route?'],
  },
};

function genericLesson(skill) {
  const cat = categoryOf(skill);
  return {
    what: `**${skill}** is a ${cat === 'Other' ? 'professional' : cat.toLowerCase()} skill employers list for this kind of role. The fastest way to learn it is to understand the core ideas, practise on a small realistic task, and then show evidence of it in a project or on your CV.`,
    concepts: [`The core vocabulary and ideas behind ${skill}`, `The tools most teams use for ${skill}`, `Common beginner mistakes and how to avoid them`, `How ${skill} is used day to day in this role`, `How to show ${skill} on your CV and in interviews`],
    example: null,
    exercise: `Spend 45 minutes on the first module of one of the resources below, then write down three things you learned and one question you still have.`,
    project: `Create a small portfolio piece that uses ${skill} to solve a real problem (for example, for a local business or a class project), and write a short case study about it.`,
    quiz: [[`In one sentence, what problem does ${skill} solve?`, 'Compare your answer with the introduction of the first resource.'], [`Name two tools or methods associated with ${skill}.`, 'Check the resources\' table of contents.'], [`How would you prove ${skill} to an employer?`, 'A project, a certificate, or a measurable result on your CV.']],
    interview: [`Tell me about a time you used ${skill}.`, `How are you building your ${skill} skills?`, `What would you do in your first month to get better at ${skill}?`],
  };
}

const lessonFor = skill => LESSONS[skill] || genericLesson(skill);
const bullets = list => list.map(x => `- ${x}`).join('\n');
const linkList = resources => resources.map(r => `- [${r.title}](${r.url}) · ${r.provider} · ${r.type}`).join('\n');

function jobLine(ctx) {
  if (!ctx.job) return '';
  const fitPart = ctx.match ? ` Right now your fit is **${ctx.match.fit}%**${ctx.match.potential > ctx.match.fit ? ` and closing your must-have gaps could take it to about **${ctx.match.potential}%**` : ''}.` : '';
  return `\n\n**Why it matters for you:** *${ctx.job.title}* at ${ctx.job.company} lists ${ctx.skill} as a ${ctx.required ? 'must-have' : 'nice-to-have'} skill.${fitPart}`;
}

function offlineOpening(ctx) {
  const L = lessonFor(ctx.skill);
  const known = ctx.userSkills.slice(0, 4);
  return [
    `Hi ${ctx.firstName}! Let's close your **${ctx.skill}** gap together.${jobLine(ctx)}`,
    `**What it is:** ${L.what}`,
    known.length ? `**Good news:** you already know ${known.join(', ')}, so you're not starting from zero.` : '',
    `**Your 4-step plan:**\n1. **Understand** the core concepts\n2. **Practise** with a short exercise\n3. **Build** a mini project for your portfolio\n4. **Prove it** with a quick quiz, then mark the skill as learned`,
    `**Step 1 · Start here:** ${L.exercise}`,
    `Recommended (free) resources:\n${linkList(ctx.resources)}`,
    'Ask me to **explain** a concept, show an **example**, give you a **project**, or **quiz** you whenever you are ready.',
  ].filter(Boolean).join('\n\n');
}

function offlineReply(ctx, message) {
  const L = lessonFor(ctx.skill);
  const m = message.toLowerCase();
  if (/answer|solution/.test(m)) return `Here are the answers:\n\n${L.quiz.map(([q, a], i) => `${i + 1}. ${q}\n   **Answer:** ${a}`).join('\n')}\n\nGot most of them? Great, that's step 4. Use **Mark as learned** when you're confident.`;
  if (/quiz|test me|question|check/.test(m)) return `Quick ${ctx.skill} quiz. Answer in your head (or here), then ask me for the **answers**:\n\n${L.quiz.map(([q], i) => `${i + 1}. ${q}`).join('\n')}`;
  if (/example|code|show me|sample/.test(m)) return L.example ? `Here's a small ${ctx.skill} example:\n\n\`\`\`\n${L.example}\n\`\`\`\n\nTry changing it and see what happens. Want a **project** to practise on?` : `A good way to see ${ctx.skill} in action is the first hands-on module of [${ctx.resources[0].title}](${ctx.resources[0].url}). Want me to give you a **project** instead?`;
  if (/project|build|portfolio|practi[cs]e|exercise/.test(m)) return `**Mini project (step 3):** ${L.project}\n\n**Done when:**\n- It works end to end and lives on GitHub\n- The README explains what you built and which ${ctx.skill} features you used\n- You can explain one decision you made\n\nThen add it to your CV and Profile; that's the evidence employers look for.`;
  if (/plan|schedule|week|roadmap|how long/.test(m)) return `**Two-week ${ctx.skill} plan** (about 1 hour a day):\n\n**Week 1: Understand & practise**\n${bullets(L.concepts.slice(0, 4).map((c, i) => `Day ${i * 2 + 1}–${i * 2 + 2}: ${c}`))}\n\n**Week 2: Build & prove**\n- Days 9–12: build the mini project\n- Day 13: take the quiz and fix weak spots\n- Day 14: add it to your CV, then mark the skill as learned here`;
  if (/link|resource|course|video|where/.test(m)) return `Here are the best free places to learn ${ctx.skill}:\n\n${linkList(ctx.resources)}\n\nStart with the first one; it's the most hands-on.`;
  if (/interview/.test(m)) return `Interviewers often ask about ${ctx.skill} like this:\n\n${L.interview.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nTip: answer with a real example from your project (situation → what you did → result).`;
  if (/explain|what is|what's|how does|why|concept|understand|learn|start|next/.test(m)) return `**Key ${ctx.skill} concepts to understand (step 1):**\n\n${bullets(L.concepts)}\n\n${L.what}\n\nWhich of these would you like me to go deeper on? Or ask for an **example**.`;
  return `I can help you with ${ctx.skill} in a few ways:\n\n- **Explain** the key concepts\n- Show an **example**\n- Give you a **project** to build\n- Make a **2-week plan**\n- **Quiz** you\n- Share **resources**\n- Practise **interview** questions\n\nWhat would you like to do?`;
}

// ---------- AI tutor ----------
function systemPrompt(ctx) {
  return [
    'You are Pivot\'s AI career tutor. You help a job seeker close one specific skill gap so they qualify for a job.',
    `Learner: ${ctx.fullName}. Target role: ${ctx.targetRole || 'not set'}. Level: ${ctx.level || 'unknown'}.`,
    `Skills from their CV: ${ctx.userSkills.join(', ') || 'none listed'}.`,
    ctx.cvSummary ? `CV summary: ${ctx.cvSummary}` : '',
    ctx.job ? `Target job: ${ctx.job.title} at ${ctx.job.company}. ${ctx.skill} is ${ctx.required ? 'a MUST-HAVE' : 'a nice-to-have'} for it.${ctx.match ? ` Current fit ${ctx.match.fit}%, potential ${ctx.match.potential}%.` : ''}` : '',
    `Skill being taught: ${ctx.skill}.`,
    'Teach step by step like a friendly, practical tutor: build on skills they already have, use short concrete examples (small code blocks when relevant), and give one small exercise or question at a time.',
    'Keep replies under 220 words. Use simple Markdown (bold, bullet lists, numbered lists, fenced code blocks).',
    'When recommending learning resources, use ONLY these links, written as Markdown links with the exact URL:',
    ...ctx.resources.map(r => `- [${r.title}](${r.url}) (${r.provider}, ${r.type})`),
    'Never invent other URLs. Stay on the topic of this skill, the job, and career advice.',
  ].filter(Boolean).join('\n');
}

/** Remove any link whose URL is not in the curated list (keeps the link text). */
function sanitizeLinks(text, resources) {
  const allowed = new Set(resources.map(r => r.url));
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (all, label, url) => (allowed.has(url) ? all : label))
    .replace(/(^|[\s(])(https?:\/\/[^\s)]+)/g, (all, pre, url) => (allowed.has(url) ? all : pre));
}

async function aiReply(ctx, history, message) {
  const messages = [{ role: 'system', content: systemPrompt(ctx) }, ...history.slice(-12).map(h => ({ role: h.role, content: h.content }))];
  messages.push({ role: 'user', content: message || `Start my lesson on ${ctx.skill}: briefly explain what it is and why it matters for this job, give me a short step-by-step plan, my first small exercise, and the best 2-3 resources.` });
  const text = await ai.chat(messages, { maxTokens: 700 });
  return text ? sanitizeLinks(text, ctx.resources) : null;
}

/** Returns { text, source: 'ai' | 'offline' } */
async function tutorTurn(ctx, history, message) {
  const viaAI = await aiReply(ctx, history, message);
  if (viaAI) return { text: viaAI, source: 'ai' };
  return { text: message ? offlineReply(ctx, message) : offlineOpening(ctx), source: 'offline' };
}

module.exports = { tutorTurn, resourcesFor, sanitizeLinks };
