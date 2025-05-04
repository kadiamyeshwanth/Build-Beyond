const {express,app,PORT,bodyParser,cookieParser,SQLiteStore,cors,path,mongoose,router,multer,fs,bcrypt} = require("./getServer");
const {Customer,Company,Worker,ArchitectHiring,ConstructionProjectSchema}=require("./Models.js")
const jwt = require('jsonwebtoken');
app.set("view engine", "ejs");
app.set('views', path.join(__dirname,'..','views'));

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "Uploads")));

// JWT Secret Key
const JWT_SECRET = "cec1dc25cec256e194e609ba68d0e62b7554e7b664468a99d8ca788e0b657ec7"; // Replace with a secure key in production

// MongoDB Connection
const mongoURI = "mongodb+srv://isaimanideepp:Sai62818@cluster0.mng20.mongodb.net/Build&Beyond?retryWrites=true&w=majority";
mongoose
  .connect(mongoURI, {})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Create uploads directory (absolute path)
const uploadDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);  // Use the absolute path
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"));
  },
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized. Please login." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token. Please login again." });
  }
};

// Signup Endpoint
app.post("/signup", upload.array("documents", 10), async (req, res) => {
  try {
    const { role, password, termsAccepted, ...data } = req.body;

    if (!role) {
      return res.status(400).json({ message: "User type is required" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }
    if (!termsAccepted) {
      return res
        .status(400)
        .json({ message: "You must accept the terms and conditions" });
    }

    // Check if email already exists in any collection
    const email = data.email;
    const existingUser =
      (await Customer.findOne({ email })) ||
      (await Company.findOne({ email })) ||
      (await Worker.findOne({ email }));

    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    let user;
    switch (role) {
      case "customer":
        if (!data.name || !data.email || !data.dob || !data.phone) {
          return res
            .status(400)
            .json({ message: "All customer fields are required" });
        }
        user = new Customer({
          name: data.name,
          email: data.email,
          dob: new Date(data.dob),
          phone: data.phone,
          password,
          role,
        });
        break;

      case "company":
        if (
          !data.companyName ||
          !data.contactPerson ||
          !data.email ||
          !data.phone
        ) {
          return res
            .status(400)
            .json({ message: "All company fields are required" });
        }
        user = new Company({
          companyName: data.companyName,
          contactPerson: data.contactPerson,
          email: data.email,
          phone: data.phone,
          companyDocuments: req.files ? req.files.map((file) => file.path) : [],
          password,
          role,
        });
        break;

      case "worker":
        if (
          !data.name ||
          !data.email ||
          !data.dob ||
          !data.aadharNumber ||
          !data.phone ||
          !data.specialization
        ) {
          return res
            .status(400)
            .json({ message: "All worker fields are required" });
        }
        user = new Worker({
          name: data.name,
          email: data.email,
          dob: new Date(data.dob),
          aadharNumber: data.aadharNumber,
          phone: data.phone,
          specialization: data.specialization,
          experience: data.experience || 0,
          certificateFiles: req.files ? req.files.map((file) => file.path) : [],
          isArchitect: data.specialization.toLowerCase() === "architect",
          password,
          role,
        });
        break;

      default:
        return res.status(400).json({ message: "Invalid user type" });
    }

    await user.save();
    res.status(201).json({ message: "Signup successful" });
  } catch (error) {
    if (error.code === 11000) {
      res
        .status(400)
        .json({ message: "Email or Aadhaar number already exists" });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Login Endpoint
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    let user =
      (await Customer.findOne({ email })) ||
      (await Company.findOne({ email })) ||
      (await Worker.findOne({ email }));

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        user_id: user._id.toString(),
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      sameSite: 'lax'
    });

    let redirect;
    switch (user.role) {
      case "customer":
        redirect = "/customerdashboard.html";
        break;
      case "company":
        redirect = "/companydashboard.html";
        break;
      case "worker":
        redirect = "/workerdashboard.html";
        break;
      default:
        return res.status(500).json({ message: "Server error" });
    }

    res.status(200).json({ message: "Login successful", redirect });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Logout Endpoint
app.post("/logout", (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: "Logout successful" });
});

// Query Workers by Specialization - Now uses cookie auth
app.get("/workers/:specialization", isAuthenticated, async (req, res) => {
  try {
    const specialization = req.params.specialization;
    const workers = await Worker.find({ specialization }).select(
      "name email specialization isArchitect"
    );
    res.status(200).json({
      workers,
      user: {
        user_id: req.user.user_id,
        role: req.user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check Authentication Status
app.get("/session", (req, res) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(200).json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.status(200).json({
      authenticated: true,
      user: {
        user_id: decoded.user_id,
        role: decoded.role,
      },
    });
  } catch (error) {
    res.status(200).json({ authenticated: false });
  }
});

// Handle form submission
app.post('/construction_form', upload.any(), async (req, res) => {
  try {
    // Extract form data from request body
    const {
      customerName,
      customerEmail,
      customerPhone,
      projectAddress,
      projectLocation,
      totalArea,
      buildingType,
      estimatedBudget,
      projectTimeline,
      totalFloors,
      specialRequirements,
      accessibilityNeeds,
      energyEfficiency
    } = req.body;

    // Process floor data
    const floors = [];
    for (let i = 1; i <= parseInt(totalFloors); i++) {
      const floorType = req.body[`floorType-${i}`];
      const floorArea = req.body[`floorArea-${i}`];
      const floorDescription = req.body[`floorDescription-${i}`];
      
      // Find the corresponding floor image file
      let floorImagePath = '';
      if (req.files) {
        const floorImageFile = req.files.find(file => 
          file.fieldname === `floorImage-${i}`
        );
        if (floorImageFile) {
          floorImagePath = floorImageFile.path;
        }
      }

      floors.push({
        floorNumber: i,
        floorType,
        floorArea,
        floorDescription,
        floorImagePath
      });
    }

    // Process site files
    const siteFilepaths = [];
    if (req.files) {
      const siteFiles = req.files.filter(file => 
        file.fieldname === 'siteFiles'
      );
      siteFiles.forEach(file => {
        siteFilepaths.push(file.path);
      });
    }

    // Create new construction project document
    const newProject = new ConstructionProjectSchema({
      customerName,
      customerEmail,
      customerPhone,
      projectAddress,
      projectLocationPincode: projectLocation,
      totalArea,
      buildingType,
      estimatedBudget,
      projectTimeline,
      totalFloors,
      floors,
      specialRequirements,
      accessibilityNeeds,
      energyEfficiency,
      siteFilepaths
    });

    // Save to database
    await newProject.save();

    // Send success response
    res.status(201).json({
      success: true,
      message: 'Project submitted successfully',
      projectId: newProject._id
    });
  } catch (error) {
    console.error('Error submitting project:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting project',
      error: error.message
    });
  }
});