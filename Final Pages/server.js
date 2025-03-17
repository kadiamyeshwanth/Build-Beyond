const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require('path');

const app = express();
const PORT = 4000;
let saved_email=null;
let saved_name=null;
app.set("view engine", "ejs");

// SQLite Database Connection
const db = new sqlite3.Database("./database.sqlite", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } else {
    console.log("Connected to SQLite database");
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL)`
    );
  }
});

// Session Middleware with Persistent Storage
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./" }),
    secret: "secretKey",
    resave: false,
    saveUninitialized: false, // Ensures only active sessions are stored
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1-day expiry
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// Debug Middleware to Check Session
app.use((req, res, next) => {
  console.log("Session Data:", req.session);
  next();
});

// Predefined Users
const predefinedUsers = {
  "admin@example.com": {
    name: "Admin",
    password: "admin123",
    role: "admin",
    passKey: "adminpasskey",
  },
  "platformadmin@example.com": {
    name: "Platform Admin",
    password: "platform123",
    role: "admin",
    passKey: "platformpasskey",
  },
  "test1@example.com": { name: "Test Customer", password: "platform123", role: "customer" },
  "test2@example.com": { name: "Test Company", password: "platform123", role: "company" },
  "test3@example.com": { name: "Test Worker", password: "platform123", role: "worker" },
};

// Signup Route
app.post("/signup", (req, res) => {
  const { name, email, password, role } = req.body;
  saved_email=email;
  saved_name=name;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (predefinedUsers[email] || user) {
      return res.status(400).json({ message: "User already exists" });
    }

    db.run("INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)", 
      [email, password, name, role], 
      (err) => {
        if (err) {
          console.error("Error inserting user:", err.message);
          return res.status(500).json({ message: "Internal server error" });
        }

        req.session.user = { name, email, role };
        req.session.save(() => {
          res.json({ message: "Signup successful" });
        });
      }
    );
  });
});

// Admin Login Route
app.post("/admin-login", (req, res) => {
  const { email, password, passKey } = req.body;

  if (!email || !password || !passKey) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const user = predefinedUsers[email];

  if (!user || user.password !== password || user.passKey !== passKey) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  req.session.user = { name: user.name, email, role: user.role };
  req.session.save(() => {
    res.json({
      message: "Login successful",
      redirect: getRedirectUrl(passKey),
    });
  });
});

// General Login Route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (predefinedUsers[email] && predefinedUsers[email].password === password) {
    req.session.user = { name: predefinedUsers[email].name, email, role: predefinedUsers[email].role };
    req.session.save(() => {
      res.json({ message: "Login successful", redirect: getRedirectUrl(predefinedUsers[email].role) });
    });
    return;
  }

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.user = { name: user.name, email: user.email, role: user.role };
    req.session.save(() => {
      res.json({ message: "Login successful", redirect: getRedirectUrl(user.role) });
    });
  });
});
app.get("/",(req,res)=>{
  res.render("landing_page");
});
app.get("/signin_up.html", (req, res) => {
  res.sendFile(path.join(__dirname,"signin_up.html"));
});
// Logout Route
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logged out successfully" });
  });
});

// Serve Static Files
app.use(express.static("Final Pages"));

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Helper Function for Role-Based Redirection
function getRedirectUrl(roleOrPassKey) {
  const redirectUrls = {
    company: "/FFSD/Final%20Pages/Company%20Administrator/dashboard.html",
    customer: "/FFSD/Final%20Pages/Customer/home.html",
    worker: "/FFSD/Final%20Pages/Individual%20Worker/dashboard.html",
    adminpasskey: "/FFSD/Final%20Pages/Admin%20Page/adminpage.html",
    platformpasskey: "/FFSD/Final%20Pages/Platform%20Administrator/dashboard.html",
  };
  return redirectUrls[roleOrPassKey] || "/FFSD/Final%20Pages/combined_homepage.html";
}