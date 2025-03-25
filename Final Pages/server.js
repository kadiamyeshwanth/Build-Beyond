const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const cors = require("cors");
const path = require('path');
const mongoose = require("mongoose");
const app = express();
const PORT = 4000;
app.set("view engine", "ejs");
// Replace with your MongoDB connection string
const mongoURI = "mongodb+srv://isaimanideepp:Sai62818@cluster0.mng20.mongodb.net/Build&Beyond?retryWrites=true&w=majority";
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch(err => console.error("MongoDB Connection Error:", err));
  const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["customer", "company", "worker"], required: true },
    createdAt: { type: Date, default: Date.now },
    profile: {
      phone: String,
      dob: Date,
      address: String,
      company: {
        companyName: String,
        contactPerson: String,
        license: String,
      },
      worker: {
        specialization: String,
        experience: Number,
        aadhar: String,
        certificates: [String],
      }
    }
  });

const User = mongoose.model("User", userSchema);
module.exports = User;
// Session Middleware with Persistent Storage
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./" }),
    secret: "secretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }, 
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
app.post('/signup', async (req, res) => {
  const { name, email, password, role, profile } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create a new user (password is stored as plaintext)
    const newUser = new User({
      name,
      email,
      password, // Store password as plaintext
      role,
      profile,
    });

    await newUser.save();

    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.error("Error during signup:", err);
    res.status(500).json({ message: "Internal server error" });
  }
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
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare passwords (plaintext comparison)
    if (password !== user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Set session or JWT token
    req.session.user = { id: user._id, email: user.email, role: user.role };
    res.json({ message: "Login successful", redirect: getRedirectUrl(user.role) });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
// Landing Route
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
  res.render("worker/worker_dashboard");
});
app.get("/workerjobs.html", (req, res) => {
  res.render("worker/worker_jobs");
});
app.get("/workerjoin_company.html", (req, res) => {
  res.render("worker/workers_join_company");
});
app.get("/workersettings.html", (req, res) => {
  res.render("worker/worker_settings", { user: req.session.user });
});
// Logout Route
app.get("/logout", (req, res) => {
  res.render("signin_up_");
});
// Serve Static Files
app.use(express.static("Final Pages"));
app.get("/companydashboard.html", (req, res) => {
  res.render("company/company_dashboard");
});

app.get("/customerdashboard.html", (req, res) => {
  res.render("customer/customer_dashboard");
});

app.get("/workerdashboard.html", (req, res) => {
  res.render("worker/worker_dashboard");
});

app.get("/admindashboard.html", (req, res) => {
  res.render("admin/admin_dashboard");
});

app.get("/platformadmindashboard.html", (req, res) => {
  res.render("platform_admin/platform_admin_dashboard");
});

// Customer Routes 
app.get("/home.html", (req, res) => {
  res.render("customer/customer_dashboard");
});
app.get("/construction_comanies_list.html", (req, res) => {
  res.render("customer/construction_companies_list");
});
app.get("/construction_companies_profile.html", (req, res) => {
  res.render("customer/construction_companies_profile");
});
app.get("/architect.html", (req, res) => {
  res.render("customer/architect");
});
app.get("/interior_designer.html", (req, res) => {
  res.render("customer/interior_design");
});
app.get("/ongoing_projects.html", (req, res) => {
  res.render("customer/ongoing_projects");
});
app.get("/bidspace.html", (req, res) => {
  res.render("customer/bid_space");
});
app.get("/design_ideas.html", (req, res) => {
  res.render("customer/design_ideas");
});
app.get("/architecht_form.html", (req, res) => {
  res.render("customer/architect_form");
});
app.get("/customersettings.html", (req, res) => {
  res.render("customer/customer_settings", { user: req.session.user });
});
app.get("/interiordesign_form.html", (req, res) => {
  res.render("customer/interiordesign_form");
});
app.get("/constructionform.html", (req, res) => {
  res.render("customer/construction_form");
});
app.get("/bidform.html", (req, res) => {
  res.render("customer/bid_form");
});
// Company routes
// app.get("", (req, res) => {
//   res.render("");
// });
app.get("/companybids.html", (req, res) => {
  res.render("company/company_bids");
});
app.get("/companyongoing_projects.html", (req, res) => {
  res.render("company/company_ongoing_projects");
});
app.get("/companyclients.html", (req, res) => {
  res.render("company/clients");
});
app.get("/companyrevenue.html", (req, res) => {
  res.render("company/revenue");
});
app.get("/companyhiring.html", (req, res) => {
  res.render("company/hiring");
});
app.get("/companysettings.html", (req, res) => {
  res.render("company/company_settings", { user: req.session.user });
});
app.get("/revenue_form.html", (req, res) => {
  res.render("company/revenue_form");
});

app.get("/addnewproject_form.html", (req, res) => {
  res.render("company/addnewproject_form");
});
// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Helper Function for Role-Based Redirection
function getRedirectUrl(role) {
  const redirectUrls = {
    customer: "/customerdashboard.html",
    company: "/companydashboard.html",
    worker: "/workerdashboard.html",
    admin: "/admindashboard.html",
  };
  return redirectUrls[role] || "/";
}