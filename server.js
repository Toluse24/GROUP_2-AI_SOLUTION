require("dotenv").config();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith("replace_this")) {
  console.error("JWT_SECRET is missing. Copy .env.example to .env and set a long random JWT_SECRET (see README).");
  process.exit(1);
}
const express = require("express"),
  path = require("path"),
  helmet = require("helmet"),
  cookieParser = require("cookie-parser"),
  bcrypt = require("bcryptjs"),
  jwt = require("jsonwebtoken"),
  pool = require("./src/db");
const app = express(),
  PORT = Number(process.env.PORT || 3000),
  COOKIE_NAME = "pivot_token";
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());
// Signed-in-only pages: send visitors back to the login screen.
const PROTECTED_PAGES = /^\/(ai-career-coach\.html|learning-path\.html|search\/search\.html|profile-resume\/?(index\.html)?)$/i;
app.use((req, res, next) => {
  if (!PROTECTED_PAGES.test(req.path)) return next();
  try {
    jwt.verify(req.cookies[COOKIE_NAME] || "", process.env.JWT_SECRET);
    return next();
  } catch (_) {
    return res.redirect("/");
  }
});
app.use(express.static(path.join(__dirname, "public")));
function tokenFor(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}
function setCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token)
      return res.status(401).json({ message: "Please sign in to continue." });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.execute(
      "SELECT id, full_name, email FROM users WHERE id=? LIMIT 1",
      [payload.userId],
    );
    if (!rows.length)
      return res
        .status(401)
        .json({ message: "Account not found. Please sign in again." });
    req.user = rows[0];
    next();
  } catch (e) {
    return res
      .status(401)
      .json({ message: "Your session has expired. Please sign in again." });
  }
}
app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim(),
      email = String(req.body.email || "")
        .trim()
        .toLowerCase(),
      password = String(req.body.password || "");
    if (name.length < 2)
      return res.status(400).json({ message: "Please enter your full name." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: "Enter a valid email address." });
    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "Password must contain at least 8 characters." });
    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [email],
    );
    if (existing.length)
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      "INSERT INTO users(full_name,email,password_hash) VALUES(?,?,?)",
      [name, email, hash],
    );
    await pool.execute("INSERT INTO user_profiles(user_id) VALUES(?)", [
      result.insertId,
    ]);
    const user = { id: result.insertId, name, email };
    res.status(201).json({ message: "Account created successfully.", user });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({
        message: "Could not create account. Check your database connection.",
      });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
        .trim()
        .toLowerCase(),
      password = String(req.body.password || "");
    const [rows] = await pool.execute(
      "SELECT id,full_name,email,password_hash FROM users WHERE email=? LIMIT 1",
      [email],
    );
    if (!rows.length)
      return res.status(401).json({ message: "Incorrect email or password." });
    const row = rows[0];
    if (!(await bcrypt.compare(password, row.password_hash)))
      return res.status(401).json({ message: "Incorrect email or password." });
    await pool.execute(
      "UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?",
      [row.id],
    );
    const user = { id: row.id, name: row.full_name, email: row.email };
    setCookie(res, tokenFor(user));
    res.json({ message: "Signed in successfully.", user });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ message: "Could not sign in. Check your database connection." });
  }
});
app.get("/api/auth/me", requireAuth, (req, res) =>
  res.json({
    user: { id: req.user.id, name: req.user.full_name, email: req.user.email },
  }),
);
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.json({ message: "Signed out." });
});
app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT u.full_name,u.email,p.headline,p.target_role,p.location FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=? LIMIT 1",
      [req.user.id],
    );
    res.json({ profile: rows[0] || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Could not load profile." });
  }
});
app.use("/api", require("./src/routes/resume")(requireAuth));
app.use("/api", require("./src/routes/matches")(requireAuth));
app.use("/api", require("./src/routes/tutor")(requireAuth));
app.use("/api", require("./src/routes/dashboard")(requireAuth));
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (e) {
    res.status(503).json({ status: "error", database: "not connected" });
  }
});
app.use("/api", (req, res) =>
  res.status(404).json({ message: "Not found." }),
);
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);
app.listen(PORT, () => {
  console.log(`Pivot is running at http://localhost:${PORT}`);
  console.log(require("./src/ai").enabled()
    ? `AI: Grok enabled (model ${process.env.XAI_MODEL}).`
    : "AI: offline mode (set XAI_API_KEY and XAI_MODEL in .env to enable Grok).");
  require("./src/jobs").seedJobs()
    .then(() => console.log("Demo jobs ready."))
    .catch(e => console.error("Could not seed demo jobs (run `npm run db:init`?):", e.message));
});
