const {express,app,PORT,bodyParser,session,SQLiteStore,cors,path,mongoose,router,multer,fs} = require("./getServer")

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
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
// const workerSchema = new mongoose.Schema({
//   name: String,
//   email: { type: String, unique: true },
//   password: String,
//   phone: String,
//   aadharNumber: String,
//   specialization: String,
//   experience: Number,
//   certificateFiles: [String],
//   createdAt: { type: Date, default: Date.now },
//   // New fields from architect form
//   professionalTitle: String,
//   about: String,
//   specialties: [String],
//   projects: [{
//       name: String,
//       year: Number,
//       location: String,
//       description: String,
//       image: String
//   }],
//   profileImage: String,
//   rating: Number
// });
// Worker Schema
const workerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  phone: { type: String },
  aadharNumber: { type: String },
  specialization: { type: String },
  experience: { type: Number, default: 0 },
  certificateFiles: [{ type: String }], // Array of file paths
  createdAt: { type: Date, default: Date.now },
  
  // Architect-specific fields
  profileImage: { type: String }, // Path to profile image
  professionalTitle: { type: String },
  about: { type: String },
  specialties: [{ type: String }], // Array of specialties
  projects: [{
    name: { type: String },
    year: { type: Number },
    location: { type: String },
    description: { type: String },
    image: { type: String }, // Path to project image
    createdAt: { type: Date, default: Date.now }
  }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  
  // Additional useful fields
  updatedAt: { type: Date, default: Date.now },
  isArchitect: { type: Boolean, default: false }, // To distinguish architect profiles
  servicesOffered: [{ type: String }], // Could be similar to specialties
  availability: { type: String, enum: ['available', 'busy', 'unavailable'], default: 'available' }
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
// Login Route 
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
// Worker Routes
app.get("/workerjoin_company.html", async (req, res) => {
  const Model = getModelByRole(req.session.user.role);
  const user = await Model.findById(req.session.user.id);
  res.render("worker/workers_join_company", { user });
});

app.get("/workersettings.html", async (req, res) => {
  const Model = getModelByRole(req.session.user.role);
  const user = await Model.findById(req.session.user.id);
  res.render("worker/worker_settings", { user });
});
app.get("/worker_profile_edit", async (req, res) => {
  const Model = getModelByRole(req.session.user.role);
  const user = await Model.findById(req.session.user.id);
  res.render("worker/worker_profile_edit", { user });
});

app.post("/worker_profile_edit_submit", async(req, res) => {
  
});
 
app.get("/customersettings.html", async (req, res) => {
  const Model = getModelByRole(req.session.user.role);
  const user = await Model.findById(req.session.user.id);
  res.render("customer/customer_settings", { user });
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

//Krishna added server code

app.post(
  "/worker_profile_edit_submit",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "projectImages" },
  ]),
  async (req, res) => {
    try {
      const { name, title, experience, about } = req.body;

      // Profile image
      const profileImage = req.files["profileImage"]
        ? req.files["profileImage"][0].path.replace("public", "")
        : "";

      // Specialties (checkboxes, can be array or single value)
      const specialties = Array.isArray(req.body.specialties)
        ? req.body.specialties
        : [req.body.specialties];

      // Handle dynamic projects
      const projects = [];
      const projectImages = req.files["projectImages"] || [];
      const imageMap = {}; // Map to associate images with the right project

      projectImages.forEach((file, index) => {
        const imageKey = `projectImage-${index + 1}`;
        imageMap[imageKey] = file.path.replace("public", "");
      });

      let count = 1;
      while (req.body[`projectName-${count}`]) {
        const project = {
          name: req.body[`projectName-${count}`],
          year: parseInt(req.body[`projectYear-${count}`]),
          location: req.body[`projectLocation-${count}`],
          description: req.body[`projectDescription-${count}`],
          image: projectImages[count - 1]
            ? projectImages[count - 1].path.replace("public", "")
            : "",
        };
        projects.push(project);
        count++;
      }

      // Create or update the worker (assuming the logged-in worker ID is passed in session or param)
      const workerId = req.session.userId || req.body.workerId; // Adjust based on your auth system

      const updatedWorker = await Worker.findByIdAndUpdate(
        workerId,
        {
          name,
          professionalTitle: title,
          experience,
          about,
          profileImage,
          specialties,
          projects,
          isArchitect: true,
          updatedAt: new Date(),
        },
        { new: true, upsert: true }
      );

      res.redirect(`/workersettings.html`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Error saving profile");
    }
  }
);
