# Pivot: your career, powered by clarity

Pivot reads your CV, finds jobs you can apply for, shows **how well you fit each company as a percentage**, and gives you an **AI tutor** that teaches the skills you are missing, with free learning links.

**Demo flow:** sign up → upload CV → skills are extracted → matched jobs with fit % → open a skill gap → the AI tutor teaches it → mark it as learned → your fit % goes up. Every match run is saved in your history.

Built with Node.js, Express, and MySQL (XAMPP). Live jobs come from [Remotive](https://remotive.com). The AI is Grok (xAI), and the app has a built-in **offline mode**, so the demo works without an API key or internet.

---

## Quick start

**Requirements:** [XAMPP](https://www.apachefriends.org/) (MySQL) and [Node.js LTS](https://nodejs.org/).

1. Start **MySQL** in the XAMPP Control Panel.
2. In this folder, create your config:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set `JWT_SECRET` to any long random string. XAMPP defaults (user `root`, empty password, port 3306) work as they are.
3. Install, create the database, and start:
   ```bash
   npm install
   npm run db:init
   npm run dev
   ```
4. Open **http://localhost:3000**. Always use this URL. Do not open the HTML files directly.

`npm run db:init` is safe to run again. It creates `pivot_db` and adds any missing tables or columns. The demo jobs are loaded automatically when the server starts.

## Turning on Grok (optional)

Add your key and the Grok model name to `.env`, then restart the server:

```
XAI_API_KEY=your-key-here
XAI_MODEL=grok-model-name
```

The server log says `AI: Grok enabled` when it is set. The AI Career Coach page then shows **Powered by Grok AI**, CV skill extraction uses Grok, and tutor replies are fully personalised. If the key is missing or a call fails, Pivot falls back to offline mode automatically.

## Presenting the demo

Two sample CVs are in `demo/`:

| File | Profile | What it shows |
|---|---|---|
| `sample-cv-amara-okafor.pdf` | Junior Frontend Developer | Strong frontend matches; gaps in TypeScript, REST APIs, Vue, Jest |
| `sample-cv-tunde-bello.docx` | Mid-level Data Analyst | Data roles; shows matching works beyond tech |

Suggested script (about 5 minutes):

1. **Sign up** with a new account and sign in.
2. **Profile & Resume**: upload `sample-cv-amara-okafor.pdf`. Skills, role and level are extracted in about 2 seconds.
3. **Search**: jobs ranked by fit %. Open *Junior Frontend Engineer at NovaTech* to see matched skills, gaps, and the potential fit.
4. Click **Learn with AI tutor →** on *TypeScript*. Try **Example** and **Quiz me**, and open a learning link.
5. Click **Mark skill as learned**. The fit for NovaTech rises (for example 65% → 75%).
6. **Search → History**: both match runs are saved.
7. **Dashboard** and **Learning Path**: best match, skills covered, and the path with progress.

To repeat the sign-up with the same email:

```bash
npm run demo:reset -- you@example.com
```

## How the fit % is calculated

For each job, Pivot compares the job's skills with the skills found in the CV:

- **80%: weighted skill coverage.** Must-have skills count double; nice-to-have skills count once.
- **20%: title similarity** between the job and your target role.
- **−12 points** when an entry-level or junior profile meets a senior or lead post.

The score is deterministic: the same CV always gives the same result. Pivot also shows the **potential fit**, which is your score if you learned every missing must-have skill.

## Project structure

```
server.js                 Express app: auth, page guards, routes
src/
  ai.js                   Grok client (OpenAI-compatible API); returns null when offline
  cv.js                   PDF/DOCX text extraction + skill extraction (Grok or keyword scan)
  skills.js               Skill catalogue (~75 skills, aliases, categories)
  jobs.js                 Seed + Remotive jobs, fit-% engine, match runs (history)
  seed-jobs.js            24 curated demo jobs (fictional companies)
  tutor.js                AI tutor: Grok prompt + offline lessons
  learning.js             Curated free learning links per skill
  routes/                 resume, matches, tutor, dashboard APIs
public/                   Pages: dashboard (index.html), search, learning path, AI coach, profile
database/pivot_db.sql     Schema (idempotent)
scripts/                  db:init, demo:reset
demo/                     Sample CVs
uploads/                  Uploaded CVs (git-ignored)
```

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Accounts |
| GET | `/api/auth/me` | Current user |
| GET / POST | `/api/resume` | Current CV + skills / upload a CV (multipart field `resume`) |
| POST / DELETE | `/api/skills`, `/api/skills/:name` | Add or remove a skill |
| PUT | `/api/profile` | Update target role and location |
| GET | `/api/matches` | Latest match run (runs one if none exists) |
| POST | `/api/matches/run` | New match run (refreshes live jobs, cached 6 h) |
| GET | `/api/matches/history`, `/api/matches/run/:id` | Match history |
| POST | `/api/matches/:jobId/save` | Bookmark a job |
| GET | `/api/jobs/:id` | Job detail + your fit |
| GET | `/api/tutor/gaps` | Skill gaps across your matches |
| GET | `/api/tutor/session?skill=&job=` | Open or resume a tutor session |
| POST | `/api/tutor/message`, `/api/tutor/progress`, `/api/tutor/learned` | Chat, progress, mark as learned |
| GET | `/api/dashboard` | Dashboard and learning-path data |
| PUT | `/api/path` | Choose the learning-path target job |
| GET | `/api/health` | Database health check |

## Troubleshooting

- **"JWT_SECRET is missing"**: create `.env` from `.env.example` and set `JWT_SECRET`.
- **Connection refused / ECONNREFUSED**: MySQL is not running. Start it in XAMPP.
- **Access denied**: set `DB_PASSWORD` in `.env`.
- **Unknown database / table doesn't exist**: run `npm run db:init`.
- **Port 3000 busy**: change `PORT` in `.env`.
- **"We could not read any text"**: the PDF is a scanned image. Use a text-based PDF or DOCX.
- **No live (Remotive) jobs**: there is no internet, or the 6-hour cache is active. The 24 demo jobs are always available.

## Known limits (next steps)

This is a demo build, not a production system. Before going public it would need HTTPS, rate limiting, CSRF protection, email verification, password reset, virus scanning of uploads, and more job sources. Remotive's terms require linking back to the original posting (done) and limiting requests (cached 6 h).
