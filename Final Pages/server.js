const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const cors = require("cors");  // Import CORS
const sqlite3 = require("sqlite3").verbose(); // Import SQLite

const app = express();
const PORT = 4000;

app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "secretKey",
    resave: false,
    saveUninitialized: true,
  })
);

const predefinedUsers = {
  "admin@example.com": {
    password: "admin123", // Password for admin
    role: "admin",
    passKey: "adminpasskey", // Pass key for admin
  },
  "platformadmin@example.com": {
    password: "platform123", // Password for platform admin
    role: "admin",
    passKey: "platformpasskey", // Pass key for platform admin
  },
  "test1@example.com": {
    password: "platform123", // Password for platform admin
    role: "customer"
  },
  "test2@example.com": {
    password: "platform123", // Password for platform admin
    role: "company"
  },
  "test3@example.com": {
    password: "platform123", // Password for platform admin
    role: "worker"
  }
};

// Connecting to SQLite database
const db = new sqlite3.Database(":memory:", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err.message);
  } 
  else 
  {
    console.log("Connected to SQLite database");
    db.run(`CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        role TEXT NOT NULL)`
    );
  }
});

app.use(cors());  
app.use(express.json());

// Signup Route
app.post("/signup", (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (predefinedUsers[email] || users[email]) {
    return res.status(400).json({ message: "User already exists" });
  }

  // Store user in memory
  users[email] = { name, password, role };
  res.json({ message: "Signup successful" });
});


// Admin Login Route
app.post("/admin-login", (req, res) => {
  const { email, password, passKey } = req.body;

  if (!email || !password || !passKey) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Check predefined users (admins and platform admins)
  const user = predefinedUsers[email];

  // Validate credentials
  if (!user || user.password !== password || user.passKey !== passKey) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Store user session
  req.session.user = { email, role: user.role };

  // Redirect based on pass key
  let redirectUrl = "/";
  if (passKey === "adminpasskey") {
    redirectUrl = "/FFSD/Final%20Pages/Admin%20Page/adminpage.html"; // Admin dashboard
  } else if (passKey === "platformpasskey") {
    redirectUrl = "/FFSD/Final%20Pages/Platform%20Administrator/dashboard.html"; // Platform admin dashboard
  } else {
    return res.status(401).json({ message: "Invalid pass key" });
  }

  res.json({ message: "Login successful", redirect: redirectUrl });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Check predefined users first
  if (predefinedUsers[email]) {
    const user = predefinedUsers[email];
    if (user.password === password) {
      req.session.user = { email, role: user.role };
      
      let redirectUrl = "/";
      switch (user.role) {
        case "company":
        redirectUrl = "/FFSD/Final%20Pages/Company%20Administrator/dashboard.html";
        break;
      case "customer":
        redirectUrl = "/FFSD/Final%20Pages/Customer/home.html";
        break;
      case "worker":
        redirectUrl = "/FFSD/Final%20Pages/Individual%20Worker/dashboard.html";
        break;
        default:
          redirectUrl = "/FFSD/Final%20Pages/combined_homepage.html";
      }

      return res.json({ message: "Login successful", redirect: redirectUrl });
    } else {
      return res.status(401).json({ message: "Invalid credentials" });
    }
  }

  // Check in SQLite database for registered users
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Store user session
    req.session.user = { email, role: user.role };

    // Redirect based on role
    let redirectUrl = "/";
    switch (user.role) {
      case "company":
        redirectUrl = "/FFSD/Final%20Pages/Company%20Administrator/dashboard.html";
        break;
      case "customer":
        redirectUrl = "/FFSD/Final%20Pages/Customer/home.html";
        break;
      case "worker":
        redirectUrl = "/FFSD/Final%20Pages/Individual%20Worker/dashboard.html";
        break;
      default:
        redirectUrl = "/FFSD/Final%20Pages/combined_homepage.html";
    }

    res.json({ message: "Login successful", redirect: redirectUrl });
  });
});

app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login"); // Redirect to login if not authenticated
  }

  res.render("customer_settings.ejs", { user: req.session.user });
});


// Logout Route
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logout successful" });
  });
});

// Serve static files (HTML pages)
app.use(express.static("Final Pages"));

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/login`);
});
