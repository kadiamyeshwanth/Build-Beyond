const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const cors = require("cors");
const path = require('path');
const mongoose = require("mongoose");
const app = express();
const PORT = 4000;

// Multer 
const multer = require('multer');
const fs = require('fs');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    
    // Create directory based on user role if available
    if (req.body.role) {
      uploadPath += `${req.body.role}/`;
    } else {
      uploadPath += 'misc/';
    }

    // Create directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Create upload instance
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
// Configuration
app.set("view engine", "ejs");
app.use(cors({
  origin: 'http://localhost:4000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// MongoDB Connection
const mongoURI = "mongodb+srv://isaimanideepp:Sai62818@cluster0.mng20.mongodb.net/Build&Beyond?retryWrites=true&w=majority";
mongoose.connect(mongoURI, {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
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
// Map each role to its corresponding Mongoose model
const roleModelMap = {
  customer: Customer,
  company: Company,
  worker: Worker
};
function getModelByRole(role) {
  if (!role) return null;
  return roleModelMap[role.toLowerCase()] || null;
}
module.exports = getModelByRole;
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
app.post('/signup', upload.fields([
  { name: 'licenseFiles', maxCount: 5 },
  { name: 'certificateFiles', maxCount: 5 }
]), async (req, res) => {
  try {
    // Log incoming files for debugging
    console.log('Uploaded files:', req.files);
    
    // Combine body data and file data
    const userData = {
      ...req.body,
      ...(req.files?.licenseFiles && { 
        licenseFiles: req.files.licenseFiles.map(file => file.path) 
      }),
      ...(req.files?.certificateFiles && { 
        certificateFiles: req.files.certificateFiles.map(file => file.path) 
      })
    };

    // Rest of your signup logic...
    const { role, name, email, password, companyName, contactPerson, aadharNumber, specialization, experience } = userData;
    
    let newUser;
    switch(role) {
      case 'customer':
        newUser = new Customer({ name, email, password, ...userData });
        break;
      case 'company':
        newUser = new Company({ 
          name: companyName, 
          email, 
          password, 
          contactPerson,
          licenseFiles: userData.licenseFiles || [],
          ...userData 
        });
        break;
      case 'worker':
        newUser = new Worker({ 
          name, 
          email, 
          password, 
          aadharNumber,
          specialization,
          experience,
          certificateFiles: userData.certificateFiles || [],
          ...userData 
        });
        break;
      default:
        return res.status(400).json({ message: "Invalid user role" });
    }

    await newUser.save();
    
    res.status(201).json({ 
      message: "Signup successful",
      redirect: getRedirectUrl(role),
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: role
      }
    });

  } catch (err) {
    console.error("Signup error:", err);
    
    // Clean up uploaded files if error occurs
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        fs.unlink(file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Error cleaning up file:", unlinkErr);
        });
      });
    }
    
    res.status(500).json({ 
      message: "Server error during registration",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
app.get("/customersettings.html", async(req, res) => {
  const Model = getModelByRole(req.session.user.role);
  const user = await Model.findById(req.session.user.id);
  res.render("customer/customer_settings", {user});
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
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static("Final Pages"));