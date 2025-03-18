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

        // Fetch the user data from the database using email as the key
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, newUser) => {
          if (err) {
            console.error("Error fetching new user:", err.message);
          } else {
            // Print user details from database to console
            console.log('===== New User Signup Details (from DB) =====');
            console.log('Name:', newUser.name);
            console.log('Email:', newUser.email);
            console.log('Role:', newUser.role);
            console.log('Time:', new Date().toISOString());
            console.log('============================================');
          }
        });

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
  res.render("signin_up_");
});
app.get("/adminpage.html", (req, res) => {
  res.render("adminlogin");
});
// Worker Routes
app.get("/workerdashboard.html", (req, res) => {
  res.render("worker_dashboard");
});
app.get("/workerjobs.html", (req, res) => {
  res.render("worker_jobs");
});
app.get("/workerjoin_company.html", (req, res) => {
  res.render("workers_join_company");
});
app.get("/workersettings.html", (req, res) => {
  res.render("worker_settings");
});
// Logout Route
app.get("/logout", (req, res) => {
  res.render("signin_up_");
});
// Serve Static Files
app.use(express.static("Final Pages"));
app.get("/companydashboard.html", (req, res) => {
  res.render("company_dashboard");
});

app.get("/customerdashboard.html", (req, res) => {
  res.render("customer_dashboard");
});

app.get("/workerdashboard.html", (req, res) => {
  res.render("worker_dashboard");
});

app.get("/admindashboard.html", (req, res) => {
  res.render("admin_dashboard");
});

app.get("/platformadmindashboard.html", (req, res) => {
  res.render("platform_admin_dashboard");
});

// Customer Routes 
app.get("/home.html", (req, res) => {
  res.render("customer_dashboard");
});
app.get("/construction_comanies_list.html", (req, res) => {
  res.render("construction_companies_list");
});
app.get("/construction_companies_profile.html", (req, res) => {
  res.render("construction_companies_profile");
});
app.get("/architect.html", (req, res) => {
  res.render("architect");
});
app.get("/interior_designer.html", (req, res) => {
  res.render("interior_design");
});
app.get("/ongoing_projects.html", (req, res) => {
  res.render("ongoing_projects");
});
app.get("/bidspace.html", (req, res) => {
  res.render("bid_space");
});
app.get("/design_ideas.html", (req, res) => {
  res.render("design_ideas");
});
app.get("/architecht_form.html", (req, res) => {
  res.render("architect_form");
});
app.get("/customersettings.html", (req, res) => {
  res.render("customer_settings");
});
app.get("/interiordesign_form.html", (req, res) => {
  res.render("interiordesign_form");
});
app.get("/constructionform.html", (req, res) => {
  res.render("construction_form");
});
app.get("/bidform.html", (req, res) => {
  res.render("bid_form");
});
// Company routes
// app.get("", (req, res) => {
//   res.render("");
// });
app.get("/companybids.html", (req, res) => {
  res.render("company_bids");
});
app.get("/companyongoing_projects.html", (req, res) => {
  res.render("company_ongoing_projects");
});
app.get("/companyclients.html", (req, res) => {
  res.render("clients");
});
app.get("/companyrevenue.html", (req, res) => {
  res.render("revenue");
});
app.get("/companyhiring.html", (req, res) => {
  res.render("hiring");
});
app.get("/companysettings.html", (req, res) => {
  res.render("company_settings");
});
app.get("/revenue_form.html", (req, res) => {
  res.render("revenue_form");
});

app.get("/addnewproject_form.html", (req, res) => {
  res.render("addnewproject_form");
});
// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Helper Function for Role-Based Redirection
function getRedirectUrl(roleOrPassKey) {
  const redirectUrls = {
    company: "/companydashboard.html",
    customer: "/customerdashboard.html",
    worker: "/workerdashboard.html",
    adminpasskey: "/admindashboard.html",
    platformpasskey: "platformadmindashboard.html",
  };
  return redirectUrls[roleOrPassKey] || "/FFSD/Final%20Pages/combined_homepage.html";
}