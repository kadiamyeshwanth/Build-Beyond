const {
  express,
  app,
  PORT,
  bodyParser,
  session,
  SQLiteStore,
  cors,
  path,
  mongoose,
  router,
  multer,
  fs,
  bcrypt,
} = require("./getServer");
const { Customer, Company, Worker, ArchitectHiring } = require("./Models.js");

const MongoDBStore = require("connect-mongodb-session")(session);

app.set("view engine", "ejs");
app.set("views", "views");

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "Uploads")));

// Session Store
const store = new MongoDBStore({
  uri: "mongodb+srv://isaimanideepp:Sai62818@cluster0.mng20.mongodb.net/Build&Beyond?retryWrites=true&w=majority",
  collection: "sessions",
});

// Catch store errors
store.on("error", function (error) {
  console.error("Session store error:", error);
});

// Session Middleware
app.use(
  session({
    secret: "your-secret-key", // Replace with a secure key in production
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// MongoDB Connection
const mongoURI =
  "mongodb+srv://isaimanideepp:Sai62818@cluster0.mng20.mongodb.net/Build&Beyond?retryWrites=true&w=majority";
mongoose
  .connect(mongoURI, {})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "Uploads/");
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
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"));
  },
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized. Please login." });
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

    // Store user_id and role in session
    req.session.user = {
      user_id: user._id.toString(),
      role: user.role,
    };

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

app.post(
  "/architect_submit",
  upload.array("referenceImages", 10),
  async (req, res) => {
    try {

      // Temporary test customer ID (replace with auth logic)
      const customerId = new mongoose.Types.ObjectId(
        "000000000000000000000000"
      );
      const workerId = new mongoose.Types.ObjectId("000000000000000000000000");

      // Extract form data
      const {
        fullName,
        contactNumber,
        email,
        streetAddress,
        city,
        state,
        zipCode,
        plotLocation,
        plotSize,
        plotOrientation,
        designType,
        numFloors,
        floorRequirements,
        specialFeatures,
        architecturalStyle,
        budget,
        completionDate,
      } = req.body;

      // Validate required fields
      const requiredFields = [
        "fullName",
        "contactNumber",
        "email",
        "streetAddress",
        "city",
        "state",
        "zipCode",
        "plotLocation",
        "plotSize",
        "plotOrientation",
        "designType",
        "numFloors",
        "architecturalStyle",
        "budget",
      ];
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({
            message: `Missing required field: ${field}`,
          });
        }
      }

      // Parse floorRequirements with error handling
      let parsedFloorRequirements = [];
      if (floorRequirements) {
        try {
          parsedFloorRequirements = Array.isArray(floorRequirements)
            ? floorRequirements
            : JSON.parse(floorRequirements);
        } catch (parseError) {
          console.error("Error parsing floorRequirements:", parseError);
          return res.status(400).json({
            message: "Invalid floorRequirements format",
          });
        }
      }

      // Handle file uploads safely
      const referenceImages = req.files
        ? req.files.map((file) => ({
            url: `/Uploads/${file.filename}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
          }))
        : [];

      // Create document
      const architectHiring = new ArchitectHiring({
        customer: customerId,
        customerDetails: {
          fullName,
          contactNumber,
          email,
        },
        customerAddress: {
          streetAddress,
          city,
          state,
          zipCode,
        },
        plotInformation: {
          plotLocation,
          plotSize,
          plotOrientation,
        },
        designRequirements: {
          designType,
          numFloors,
          floorRequirements: parsedFloorRequirements.map((floor, index) => ({
            floorNumber: floor.floorNumber || index + 1,
            details: floor.details,
          })),
          specialFeatures,
          architecturalStyle,
        },
        additionalDetails: {
          budget,
          completionDate: completionDate ? new Date(completionDate) : undefined,
          referenceImages,
        },
      });

      // Save to MongoDB
      await architectHiring.save();

      // Return JSON with redirect URL
      res.status(200).json({
        message: "Form submitted successfully",
        redirect: "/architect.html",
      });
    } catch (error) {
      console.error("Error in /architect_submit:", error);
      res.status(400).json({
        message: error.message || "Failed to submit design request",
      });
    }
  }
);
// Logout Endpoint
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Failed to logout" });
    }
    res.status(200).json({ message: "Logout successful" });
  });
});

// Query Workers by Specialization (Protected Route)
app.get("/workers/:specialization", isAuthenticated, async (req, res) => {
  try {
    const specialization = req.params.specialization;
    const workers = await Worker.find({ specialization }).select(
      "name email specialization isArchitect"
    );
    res.status(200).json({
      workers,
      user: {
        user_id: req.session.user.user_id,
        role: req.session.user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check Session Status
app.get("/session", (req, res) => {
  if (req.session.user) {
    res.status(200).json({
      authenticated: true,
      user: {
        user_id: req.session.user.user_id,
        role: req.session.user.role,
      },
    });
  } else {
    res.status(200).json({ authenticated: false });
  }
});
