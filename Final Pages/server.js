const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const cors = require("cors");
const path = require('path');
const mongoose = require("mongoose");
const app = express();
const PORT = 4000;

// Configuration
app.set("view engine", "ejs");
app.use(cors({
  origin: 'http://localhost:4000',
  credentials: true
}));

// MongoDB Connection
const mongoURI = "mongodb+srv://isaimanideepp:Sai62818@cluster0.mng20.mongodb.net/Build&Beyond?retryWrites=true&w=majority";
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("Connected to MongoDB Atlas"))
.catch(err => console.error("MongoDB Connection Error:", err));

// Separate Schemas for Each User Type
const baseUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    match: [/\S+@\S+\.\S+/, 'Invalid email format']
  },
  password: { type: String, required: true },
  phone: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Admin Schema
const adminSchema = new mongoose.Schema({
  ...baseUserSchema.obj,
  passKey: { type: String, required: true }
});
const Admin = mongoose.model("Admin", adminSchema);

// Platform Admin Schema
const platformAdminSchema = new mongoose.Schema({
  ...baseUserSchema.obj,
  passKey: { type: String, required: true }
});
const PlatformAdmin = mongoose.model("Platform_Admin", platformAdminSchema);

// Customer Schema
const customerSchema = new mongoose.Schema({
  ...baseUserSchema.obj,
  dob: { type: Date },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  }
});
const Customer = mongoose.model("Customer", customerSchema);

// Company Schema
const companySchema = new mongoose.Schema({
  ...baseUserSchema.obj,
  companyName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  licenseFiles: [{ type: String }],
  establishmentYear: { type: Number },
  specialization: [String]
});
const Company = mongoose.model("Company", companySchema);

// Worker Schema
const workerSchema = new mongoose.Schema({
  ...baseUserSchema.obj,
  aadharNumber: { type: String },
  specialization: { type: String },
  experience: { type: Number },
  certificateFiles: [{ type: String }],
  hourlyRate: { type: Number },
  availability: { type: String }
});
const Worker = mongoose.model("Worker", workerSchema);

// Session Middleware
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.sqlite", dir: "./" }),
    secret: "secretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }, 
  })
);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static("Final Pages"));

// Predefined Admin Users
const predefinedAdmins = {
  "admin@example.com": {
    name: "Admin",
    password: "admin123",
    passKey: "adminpasskey",
    role: "admin"
  },
  "platformadmin@example.com": {
    name: "Platform Admin",
    password: "platform123",
    passKey: "platformpasskey",
    role: "platform_admin"
  }
};

// Enhanced Signup Route
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, ...profileData } = req.body;

    // Basic validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if email exists in any collection
    const emailExists = await checkEmailAcrossCollections(email);
    if (emailExists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    let newUser;
    switch(role) {
      case 'customer':
        newUser = new Customer({ name, email, password, ...profileData });
        break;
      case 'company':
        newUser = new Company({ name, email, password, ...profileData });
        break;
      case 'worker':
        newUser = new Worker({ name, email, password, ...profileData });
        break;
      default:
        return res.status(400).json({ message: "Invalid user role" });
    }

    await newUser.save();

    // Set session
    req.session.user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: role,
      profileData: newUser.toObject()
    };

    res.status(201).json({ 
      message: "Signup successful",
      redirect: getRedirectUrl(role),
      user: req.session.user
    });

  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// Enhanced Login Route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check predefined admins first
    const predefinedAdmin = predefinedAdmins[email];
    if (predefinedAdmin && predefinedAdmin.password === password) {
      req.session.user = { 
        name: predefinedAdmin.name, 
        email, 
        role: predefinedAdmin.role 
      };
      return res.json({ 
        message: "Login successful", 
        redirect: getRedirectUrl(predefinedAdmin.role) 
      });
    }

    // Check all collections for the user
    const user = await findUserAcrossCollections(email, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Set session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.constructor.modelName.toLowerCase(), // Gets collection name
      profileData: user.toObject()
    };

    res.json({ 
      message: "Login successful",
      redirect: getRedirectUrl(req.session.user.role),
      user: req.session.user
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Helper function to check email across all collections
async function checkEmailAcrossCollections(email) {
  const checks = await Promise.all([
    Admin.findOne({ email }),
    PlatformAdmin.findOne({ email }),
    Customer.findOne({ email }),
    Company.findOne({ email }),
    Worker.findOne({ email })
  ]);
  return checks.some(result => result !== null);
}

// Helper function to find user across all collections
async function findUserAcrossCollections(email, password) {
  const models = [Customer, Company, Worker, Admin, PlatformAdmin];
  
  for (const model of models) {
    const user = await model.findOne({ email });
    if (user && user.password === password) { // In production, use bcrypt.compare()
      return user;
    }
  }
  return null;
}

// Admin Login Route
app.post("/admin-login", (req, res) => {
  const { email, password, passKey } = req.body;
  if (!email || !password || !passKey) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const admin = predefinedAdmins[email];
  if (!admin || admin.password !== password || admin.passKey !== passKey) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  req.session.user = { 
    name: admin.name, 
    email, 
    role: admin.role
  };
  
  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return res.status(500).json({ message: "Session error" });
    }
    res.json({
      message: "Login successful",
      redirect: getRedirectUrl(admin.role)
    });
  });
});

// All your existing view routes remain the same...
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

// Helper Function for Role-Based Redirection
function getRedirectUrl(role) {
  const redirectUrls = {
    customer: "/customerdashboard.html",
    company: "/companydashboard.html",
    worker: "/workerdashboard.html",
    admin: "/admindashboard.html",
    platform_admin: "/platformadmindashboard.html"
  };
  return redirectUrls[role] || "/";
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});