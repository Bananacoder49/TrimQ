/* ==========================================================
   server.js – TrimQ API (Express + MySQL)
   Start with:  npm install  then  npm start
   ========================================================== */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { pool, testConnection } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- Middleware ---------- */
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" })); // lets your website call this server
app.use(express.json());                                   // reads JSON sent by the website

/* Small helper: sends a 400 error with a message */
function bad(res, message) {
  return res.status(400).json({ error: message });
}

/* ---------- Health check: is the server and database working? ---------- */
app.get("/api/health", async (req, res) => {
  try {
    await testConnection();
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, database: "unreachable" });
  }
});

/* ---------- QUEUE ---------- */

/* GET /api/queue – who is being served and who is waiting */
app.get("/api/queue", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, service, status FROM queue WHERE status IN ('waiting','serving') ORDER BY id"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the queue." });
  }
});

/* POST /api/queue – join the queue. Body: { "name": "...", "service": "..." } */
app.post("/api/queue", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const service = String(req.body.service || "").trim();

  if (!name || !service) return bad(res, "Name and service are required.");

  try {
    const [result] = await pool.execute(
      "INSERT INTO queue (name, service) VALUES (?, ?)",
      [name, service]
    );
    /* How many people are ahead of the new ticket? */
    const [[ahead]] = await pool.execute(
      "SELECT COUNT(*) AS n FROM queue WHERE status = 'waiting' AND id < ?",
      [result.insertId]
    );
    res.status(201).json({ id: result.insertId, name, service, ahead: ahead.n });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not join the queue." });
  }
});

/* PATCH /api/queue/:id – change a ticket's status (for the barber).
   Body: { "status": "serving" | "done" | "waiting" } */
app.patch("/api/queue/:id", async (req, res) => {
  const status = req.body.status;
  if (!["waiting", "serving", "done"].includes(status)) return bad(res, "Invalid status.");

  try {
    const [result] = await pool.execute("UPDATE queue SET status = ? WHERE id = ?", [status, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Ticket not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update the ticket." });
  }
});

/* ---------- APPOINTMENTS ---------- */

/* GET /api/appointments?date=2026-11-03 – times already taken on that day */
app.get("/api/appointments", async (req, res) => {
  const date = String(req.query.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, "Use a date like 2026-11-03.");

  try {
    const [rows] = await pool.execute(
      "SELECT appt_time AS time FROM appointments WHERE appt_date = ?",
      [date]
    );
    res.json(rows.map((r) => r.time));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load appointments." });
  }
});

/* POST /api/appointments – book a slot.
   Body: { "date": "2026-11-03", "time": 570, "name": "...", "service": "..." } */
app.post("/api/appointments", async (req, res) => {
  const { date, time } = req.body;
  const name = String(req.body.name || "").trim();
  const service = String(req.body.service || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return bad(res, "Invalid date.");
  if (!Number.isInteger(time) || time < 0 || time >= 1440) return bad(res, "Invalid time.");
  if (!name || !service) return bad(res, "Name and service are required.");

  try {
    const [result] = await pool.execute(
      "INSERT INTO appointments (name, service, appt_date, appt_time) VALUES (?, ?, ?, ?)",
      [name, service, date, time]
    );
    res.status(201).json({ id: result.insertId, date, time, name, service });
  } catch (err) {
    /* The UNIQUE key in schema.sql rejects a slot that is already booked */
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "That time is already booked." });
    }
    console.error(err);
    res.status(500).json({ error: "Could not book the appointment." });
  }
});

/* ---------- ACCOUNTS (uses the "account" table) ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* POST /api/register – create an account.
   Body: { "username": "...", "email": "...", "password": "..." } */
app.post("/api/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (username.length < 3 || username.length > 50) return bad(res, "Username must be 3 to 50 characters.");
  if (!EMAIL_RE.test(email) || email.length > 100) return bad(res, "Please enter a valid email address.");
  if (password.length < 8 || password.length > 72) return bad(res, "Password must be 8 to 72 characters.");

  try {
    /* Only a hash of the password is stored, never the password itself */
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      "INSERT INTO account (User_Name, Password, Email, Role) VALUES (?, ?, ?, 'customer')",
      [username, hash, email]
    );
    res.status(201).json({ id: result.insertId, username, role: "customer" });
  } catch (err) {
    /* The UNIQUE keys on User_Name and Email reject duplicates */
    if (err.code === "ER_DUP_ENTRY") {
      const field = /Email/i.test(err.sqlMessage || "") ? "email" : "username";
      return res.status(409).json({ error: "That " + field + " is already taken." });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create the account." });
  }
});

/* POST /api/login – check email and password.
   Body: { "email": "...", "password": "..." } */
app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) return bad(res, "Email and password are required.");

  try {
    const [rows] = await pool.execute(
      "SELECT Account_ID, User_Name, Password, Role FROM account WHERE Email = ?",
      [email]
    );
    /* Same message for "no such email" and "wrong password" so it doesn't reveal which emails exist */
    const user = rows[0];
    const match = user ? await bcrypt.compare(password, user.Password) : false;
    if (!match) return res.status(401).json({ error: "Incorrect email or password." });

    res.json({ id: user.Account_ID, username: user.User_Name, role: user.Role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in." });
  }
});

/* ---------- Start the server (after checking the database) ---------- */
testConnection()
  .then(() => console.log("Database connected."))
  .catch((err) => console.error("Database connection failed:", err.message))
  .finally(() => {
    app.listen(PORT, () => console.log("TrimQ API running on port " + PORT));
  });
