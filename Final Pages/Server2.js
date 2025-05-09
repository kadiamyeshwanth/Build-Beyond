const { request } = require("express");
const {express,app,PORT,bodyParser,cookieParser,SQLiteStore,cors,path,mongoose,router,multer,fs,bcrypt} = require("./getServer");
const {Customer,Company,Worker,ArchitectHiring,ConstructionProjectSchema,DesignRequest,Bid,WorkerToCompany,CompanytoWorker}=require("./Models.js")
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

// Update your existing construction_form route in server.js
app.post('/construction_form', isAuthenticated, upload.any(), async (req, res) => {
  try {
    // Extract form data from request body
    const {
      projectName,
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
      energyEfficiency,
      companyId, // This will come from the hidden field
    } = req.body;

    // Get customer ID from authenticated user
    const customerId = req.user.user_id;

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
      projectName,
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
      siteFilepaths,
      companyId,
      customerId, // Add the customer ID from authenticated user
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

//Architect 
app.post(
  "/architect_submit",isAuthenticated,
  upload.array("referenceImages", 10),
  async (req, res) => {
    try {
      // Get customer ID from authenticated user
      const customer = req.user.user_id;

      // Get worker ID from form data (if provided)
      const worker =
        req.body.workerId && req.body.workerId !== ""
          ? new mongoose.Types.ObjectId(req.body.workerId)
          : null;

      // Extract form data
      const {
        projectName,
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
        companyId,
      } = req.body;

      // Validate required fields
      const requiredFields = [
        "projectName",
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
      ];

      const missingFields = [];
      for (const field of requiredFields) {
        if (!req.body[field]) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        console.error("Missing required fields:", missingFields);
        return res.status(400).json({
          message: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      // Parse floorRequirements with error handling
      let parsedFloorRequirements = [];
      if (floorRequirements) {
        try {
          // Check if floorRequirements is already an object/array
          if (
            typeof floorRequirements === "object" &&
            !Array.isArray(floorRequirements)
          ) {
            // Convert object format to array format if needed
            parsedFloorRequirements = Object.keys(floorRequirements).map(
              (key) => {
                const item = floorRequirements[key];
                return {
                  floorNumber: parseInt(item.floorNumber || key) + 1,
                  details: item.details || "",
                };
              }
            );
          } else if (Array.isArray(floorRequirements)) {
            parsedFloorRequirements = floorRequirements;
          } else {
            // Try to parse as JSON if it's a string
            parsedFloorRequirements = JSON.parse(floorRequirements);
          }
        } catch (parseError) {
          console.error(
            "Error parsing floorRequirements:",
            parseError,
            floorRequirements
          );
          return res.status(400).json({
            message: "Invalid floorRequirements format",
          });
        }
      }

      // Handle file uploads safely
      const referenceImages =
        req.files && req.files.length > 0
          ? req.files.map((file) => ({
              url: `/Uploads/${file.filename}`,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
            }))
          : [];


      // Create document with all required fields
      const architectHiring = new ArchitectHiring({
        projectName,
        status: "Pending",
        customer,
        worker,
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
          floorRequirements: parsedFloorRequirements.map((floor, index) => {
            return {
              floorNumber:
                typeof floor.floorNumber === "number"
                  ? floor.floorNumber
                  : index + 1,
              details: floor.details || "",
            };
          }),
          specialFeatures,
          architecturalStyle,
        },
        additionalDetails: {
          budget,
          completionDate: completionDate ? new Date(completionDate) : undefined,
          referenceImages,
        },
        // createdAt and updatedAt will be set automatically by default values
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
//Interiror design
app.post('/design_request',isAuthenticated, upload.any(), async (req, res) => {
  try {
    const {
      projectName,
      fullName,
      email,
      phone,
      address,
      roomType,
      roomLength,
      roomWidth,
      dimensionUnit,
      ceilingHeight,
      heightUnit,
      designPreference,
      projectDescription,
      workerId, // Extract workerId from form body
    } = req.body;

    // Validate required fields
    if (!projectName || !fullName || !email || !phone || !address || !roomType || !roomLength || !roomWidth || !dimensionUnit) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Extract image files by fieldname
    const currentRoomImages = req.files
      .filter(file => file.fieldname === 'currentRoomImages')
      .map(file => `/uploads/${file.filename}`);

    const inspirationImages = req.files
      .filter(file => file.fieldname === 'inspirationImages')
      .map(file => `/uploads/${file.filename}`);

    // Create new design request
    const designRequest = new DesignRequest({
      projectName,
      fullName,
      email,
      phone,
      address,
      roomType,
      roomSize: {
        length: parseFloat(roomLength),
        width: parseFloat(roomWidth),
        unit: dimensionUnit,
      },
      ceilingHeight: ceilingHeight ? {
        height: parseFloat(ceilingHeight),
        unit: heightUnit,
      } : undefined,
      designPreference,
      projectDescription,
      currentRoomImages,
      inspirationImages,
      workerId, // Store workerId from form submission
      customerId: req.user.user_id // Store customerId from authenticated session
    });

    // Save to MongoDB
    await designRequest.save();

    // Return JSON with redirect URL
    res.status(200).json({
      message: 'Form submitted successfully',
      redirect: '/interior_design.html',
    });
  } catch (error) {
    console.error('Error saving design request:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
//Bid-form Submit
app.post('/bidForm_Submit',isAuthenticated, upload.fields([
    { name: 'siteFiles', maxCount: 10 },
    { name: 'floorImages', maxCount: 100 }
]), async (req, res) => {
    try {
        // Placeholder customerId (replace with actual auth system)
        const customerId = req.user.user_id;

        // Process site files (store filenames only)
        const siteFiles = req.files.siteFiles ? 
            req.files.siteFiles.map(file => path.basename(file.path)) : [];

        // Process floor data
        const floors = [];
        if (req.body.floors && Array.isArray(req.body.floors)) {
            req.body.floors.forEach((floor, index) => {
                const floorImage = req.files.floorImages && req.files.floorImages[index] ?
                    path.basename(req.files.floorImages[index].path) : '';
                
                floors.push({
                    floorNumber: parseInt(floor.floorNumber),
                    floorType: floor.floorType,
                    floorArea: parseFloat(floor.floorArea),
                    floorDescription: floor.floorDescription || '',
                    floorImage: floorImage
                });
            });
        } else {
            console.log('No floors provided or invalid format');
            throw new Error('No floor data provided');
        }

        const bidData = {
            customerId,
            customerName: req.body.customerName,
            customerEmail: req.body.customerEmail,
            customerPhone: req.body.customerPhone,
            projectAddress: req.body.projectAddress,
            projectLocation: req.body.projectLocation,
            totalArea: parseFloat(req.body.totalArea),
            buildingType: req.body.buildingType,
            estimatedBudget: req.body.estimatedBudget ? parseFloat(req.body.estimatedBudget) : undefined,
            projectTimeline: req.body.projectTimeline ? parseFloat(req.body.projectTimeline) : undefined,
            totalFloors: parseInt(req.body.totalFloors),
            floors,
            specialRequirements: req.body.specialRequirements || '',
            accessibilityNeeds: req.body.accessibilityNeeds || '',
            energyEfficiency: req.body.energyEfficiency || '',
            siteFiles,
        };


        const bid = new Bid(bidData);
        await bid.save();
        
        // Redirect to bidspace.html
        res.redirect('/bidspace.html');
    } catch (error) {
        console.error('Error saving bid:', error);
        res.status(500).json({ 
            error: error.message || 'Error saving bid',
            details: error.name === 'ValidationError' ? error.errors : undefined
        });
    }
});

app.post(
  '/worker_profile_edit_submit',
  isAuthenticated,
  upload.any(), // Handle all file uploads
  async (req, res) => {
    try {
      // Extract user ID from JWT
      const workerId = req.user.user_id;

      // Log the incoming files for debugging
      console.log('Uploaded files:', req.files);
      console.log('Field names in req.files:', req.files.map(file => file.fieldname));

      // Fetch the existing worker to get old project images
      const existingWorker = await Worker.findById(workerId);
      if (!existingWorker) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      // Collect old project image paths for cleanup
      const oldProjectImages = existingWorker.projects
        .filter(project => project.image) // Only include projects with images
        .map(project => project.image); // Get the image paths
      console.log('Old project images to delete:', oldProjectImages);

      // Extract form data
      const {
        name,
        title: professionalTitle,
        experience,
        about,
        specialties
      } = req.body;

      // Validate required fields
      const requiredFields = ['name', 'title', 'experience', 'about'];
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return res.status(400).json({ message: `Missing required field: ${field}` });
        }
      }

      // Process specialties (checkboxes may send multiple values)
      let parsedSpecialties = [];
      if (specialties) {
        parsedSpecialties = Array.isArray(specialties) ? specialties : [specialties];
      }

      // Process profile image
      let profileImagePath = '';
      const profileImage = req.files.find(file => file.fieldname === 'profileImage');
      if (profileImage) {
        profileImagePath = `/Uploads/${profileImage.filename}`;
        console.log('Profile image path:', profileImagePath);
      } else {
        console.log('No profile image uploaded');
      }

      // Process projects
      const projects = [];
      const projectItems = Object.keys(req.body).filter(key => key.startsWith('projectName-'));
      const projectIds = projectItems.map(key => key.split('-')[1]);
      console.log('Project IDs:', projectIds);

      for (const id of projectIds) {
        const project = {
          name: req.body[`projectName-${id}`],
          year: parseInt(req.body[`projectYear-${id}`]),
          location: req.body[`projectLocation-${id}`],
          description: req.body[`projectDescription-${id}`]
        };

        // Find corresponding project image
        const projectImage = req.files.find(file => file.fieldname === `projectImage-${id}`);
        if (projectImage) {
          project.image = `/Uploads/${projectImage.filename}`;
          console.log(`Project ${id} image path:`, project.image);
        } else {
          console.log(`No image found for project ${id}`);
          project.image = ''; // Clear the image field if no new image is provided
        }

        projects.push(project);
      }

      // Update worker document, completely overwriting the projects array
      const updateData = {
        name,
        professionalTitle,
        experience: parseInt(experience),
        about,
        specialties: parsedSpecialties,
        projects // Overwrite the entire projects array
      };

      // Only update profileImage if a new one was uploaded
      if (profileImagePath) {
        updateData.profileImage = profileImagePath;
      }

      const updatedWorker = await Worker.findByIdAndUpdate(
        workerId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedWorker) {
        return res.status(404).json({ message: 'Worker not found' });
      }

      // Clean up old project images
      if (oldProjectImages.length > 0) {
        const uploadDir = path.join(__dirname, 'Uploads');
        oldProjectImages.forEach(imagePath => {
          const filePath = path.join(uploadDir, path.basename(imagePath));
          fs.unlink(filePath, err => {
            if (err) {
              console.error(`Failed to delete old project image ${filePath}:`, err);
            } else {
              console.log(`Deleted old project image: ${filePath}`);
            }
          });
        });
      }

      res.status(200).json({
        message: 'Profile updated successfully',
        redirect: '/workerdashboard.html'
      });
    } catch (error) {
      console.error('Error updating worker profile:', error);
      res.status(500).json({
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }
);
// Update company profile
app.post(
  '/update-company-profile',
  isAuthenticated,
  upload.fields([
    { name: 'memberImages', maxCount: 10 },
    { name: 'projectImages', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const {
        profileType,
        companyName,
        companyLocation,
        companySize,
        specializations,
        currentOpenings,
        aboutCompany,
        whyJoinUs,
        projectsCompleted,
        yearsInBusiness,
        customerAboutCompany,
        didYouKnow,
        teamMembers,
        completedProjects,
      } = req.body;

      const companyId = req.user.user_id;
      const company = await Company.findById(companyId);

      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      const normalizeArray = (input) => {
        if (Array.isArray(input)) return input.map(s => s.trim()).filter(Boolean);
        if (typeof input === 'string' && input) return input.split(',').map(s => s.trim()).filter(Boolean);
        return [];
      };

      // Helper to get relative path from \Uploads\
      const getRelativePath = (filePath) => {
        const uploadsIndex = filePath.lastIndexOf('Uploads');
        if (uploadsIndex !== -1) {
          return '\\' + filePath.substring(uploadsIndex).replace(/\//g, '\\');
        }
        return '\\' + filePath.replace(/^.*[\\/]/, '').replace(/\//g, '\\');
      };

      // Basic fields update
      company.companyName = companyName || company.companyName;
      company.location = { city: companyLocation || company.location.city };
      company.size = companySize || company.size;
      company.specialization = normalizeArray(specializations);

      if (profileType === 'worker') {
        // Worker profile
        company.aboutCompany = aboutCompany || company.aboutCompany;
        company.whyJoinUs = whyJoinUs || company.whyJoinUs;
        company.currentOpenings = normalizeArray(currentOpenings);
        company.profileType = 'worker';
      } else {
        // Customer profile
        company.projectsCompleted = projectsCompleted || company.projectsCompleted;
        company.yearsInBusiness = yearsInBusiness || company.yearsInBusiness;
        company.description = customerAboutCompany || company.description;
        company.didYouKnow = didYouKnow || company.didYouKnow;
        company.profileType = 'customer';

        const memberImages = req.files['memberImages'] || [];
        const projectImages = req.files['projectImages'] || [];

        // Team members
        if (teamMembers) {
          const parsedTeamMembers = JSON.parse(teamMembers);
          company.teamMembers = parsedTeamMembers.map((member, index) => ({
            name: member.name,
            position: member.position,
            image: memberImages[index]
              ? getRelativePath(memberImages[index].path)
              : member.image || '',
          }));
        }

        // Completed projects
        if (completedProjects) {
          const parsedProjects = JSON.parse(completedProjects);
          company.completedProjects = parsedProjects.map((project, index) => ({
            title: project.title,
            description: project.description,
            image: projectImages[index]
              ? getRelativePath(projectImages[index].path)
              : project.image || '',
          }));
        }
      }

      await company.save();

      res.status(200).json({
        message: 'Profile updated successfully',
        company,
      });
    } catch (error) {
      console.error('Error updating company profile:', error);
      res.status(500).json({
        message: 'Error updating profile',
        error: error.message,
      });
    }
  }
);
// Company to Worker 
app.post('/companytoworker', isAuthenticated , async (req, res) => {
  try {
      const { position, location, salary,workerId } = req.body;

      // Replace these with actual values (from session, auth, or hidden form inputs)
      const dummyCompanyId = req.user.user_id;

      const newEntry = new CompanytoWorker({
          position,
          location,
          salary,
          company: dummyCompanyId,
          worker: workerId
      });

      await newEntry.save();
      res.status(201).json({ message: 'Offer successfully saved.' });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Worker to company request
// POST route for job application
app.post(
  "/worker_request/:companyId",
  isAuthenticated,
  upload.single("resume"),
  async (req, res) => {
    try {
      const {
        fullName,
        email,
        location,
        linkedin,
        experience,
        expectedSalary,
        positionApplying,
        primarySkills,
        workExperience,
        termsAgree,
        companyId,
      } = req.body;

      const workerId = req.user.user_id;

      // Validate required fields
      if (
        !fullName ||
        !email ||
        !location ||
        !experience ||
        !expectedSalary ||
        !positionApplying ||
        !primarySkills ||
        !workExperience ||
        !termsAgree ||
        !workerId ||
        !companyId ||
        !req.file
      ) {
        return res.status(400).json({
          error: "Missing required fields",
          missing: {
            fullName: !fullName,
            email: !email,
            location: !location,
            experience: !experience,
            expectedSalary: !expectedSalary,
            positionApplying: !positionApplying,
            primarySkills: !primarySkills,
            workExperience: !workExperience,
            termsAgree: !termsAgree,
            workerId: !workerId,
            companyId: !companyId,
            resume: !req.file,
          },
        });
      }

      // Validate companyId format
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        return res.status(400).json({ error: "Invalid companyId format" });
      }

      // Find the company to get its name
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Get the company name
      const compName = company.name || company.companyName;

      // Split primarySkills into an array
      const skillsArray = primarySkills.split(",").map((skill) => skill.trim());

      // Create new job application
      const jobApplication = new WorkerToCompany({
        fullName,
        email,
        location,
        linkedin: linkedin || null,
        experience: parseInt(experience),
        expectedSalary: parseInt(expectedSalary),
        positionApplying,
        primarySkills: skillsArray,
        workExperience,
        resume: req.file.filename,
        termsAgree: termsAgree === "true" || termsAgree === true,
        workerId,
        companyId,
        compName, 
      });

      // Save to MongoDB
      await jobApplication.save();

    res.redirect("/workerjoin_company.html");
    } catch (error) {
      console.error("Error in /worker_request_Company:", {
        message: error.message,
        stack: error.stack,
        body: req.body,
        file: req.file,
      });
      if (error instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ error: `Multer error: ${error.message}` });
      }
      if (error.name === "ValidationError") {
        return res
          .status(400)
          .json({ error: `Validation error: ${error.message}` });
      }
      res.status(500).json({
        error: "Server error while processing application",
        details: error.message,
      });
    }
  }
);
app.post('/company/worker-request/accept', isAuthenticated, async (req, res) => {
  try {
      console.log('Accepting request:', req.body); // Add logging
      const { requestId } = req.body;
      const request = await WorkerToCompany.findOne({ _id: requestId, company: req.user.user_id });
      if (!request) {
          console.log('Request not found:', requestId); // Add logging
          return res.status(404).json({ error: 'Request not found or not authorized' });
      }
      request.status = 'accepted';
      await request.save();
      console.log('Request accepted:', requestId); // Add logging
      res.status(200).json({ message: 'Request accepted successfully' });
  } catch (err) {
      console.error('Error accepting request:', err);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/company/worker-request/accept', isAuthenticated, async (req, res) => {
  try {
      const { requestId } = req.body;
      console.log('Accept Request - requestId:', requestId);
      console.log('Accept Request - companyId:', req.user.user_id);

      const request = await WorkertoCompany.findOne({
          _id: new mongoose.Types.ObjectId(requestId),
          companyId: new mongoose.Types.ObjectId(req.user.user_id)
      });

      console.log('Accept Request - Found Document:', request);

      if (!request) {
          return res.status(404).json({ error: 'Request not found or not authorized' });
      }

      request.status = 'accepted';
      await request.save();
      console.log('Accept Request - Updated Document:', request);
      res.status(200).json({ message: 'Request accepted successfully' });
  } catch (err) {
      console.error('Error accepting request:', err);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/company/worker-request/reject', isAuthenticated, async (req, res) => {
  try {
      const { requestId } = req.body;
      console.log('Reject Request - requestId:', requestId);
      console.log('Reject Request - companyId:', req.user.user_id);

      const request = await WorkertoCompany.findOne({
          _id: new mongoose.Types.ObjectId(requestId),
          companyId: new mongoose.Types.ObjectId(req.user.user_id)
      });

      console.log('Reject Request - Found Document:', request);

      if (!request) {
          return res.status(404).json({ error: 'Request not found or not authorized' });
      }

      request.status = 'rejected';
      await request.save();
      console.log('Reject Request - Updated Document:', request);
      res.status(200).json({ message: 'Request rejected successfully' });
  } catch (err) {
      console.error('Error rejecting request:', err);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});
// Get worker details by ID
app.get('/api/workers/:id', isAuthenticated, async (req, res) => {
  try {
      const worker = await Worker.findById(req.params.id)
          .select('name email title rating about specialties projects contact location linkedin previousWork profileImage')
          .lean();
      
      if (!worker) {
          return res.status(404).json({ error: 'Worker not found' });
      }

      // Ensure profile image exists
      worker.profileImage = worker.profileImage || 
          `https://api.dicebear.com/9.x/male/svg?seed=${encodeURIComponent(worker.name.replace(/\s+/g, ''))}&mouth=smile`;
      
      res.json(worker);
  } catch (err) {
      console.error('Error fetching worker:', err);
      res.status(500).json({ error: 'Server error' });
  }
});

// Cancel worker request
app.delete('/api/worker-requests/:id', isAuthenticated, async (req, res) => {
  try {
      const request = await WorkertoCompany.findOneAndDelete({
          _id: req.params.id,
          companyId: req.user.user_id,
          status: 'pending'
      });

      if (!request) {
          return res.status(404).json({ error: 'Request not found or cannot be cancelled' });
      }

      res.json({ message: 'Request cancelled successfully' });
  } catch (err) {
      console.error('Error cancelling request:', err);
      res.status(500).json({ error: 'Server error' });
  }
});
// Route to display bids page with available projects and company's bid status
app.get("/companybids.html", isAuthenticated, async (req, res) => {
  try {
    // Get company ID from authenticated user
    const companyId = req.user.user_id;

    // Get company details
    const company = await Company.findById(companyId)
    if (!company) {
      return res.status(404).render("company/company_bids", {
        error: "Company not found",
        bids: [],
        companyBids: [],
        selectedBid: null,
        req,
        companyName: "",
        companyId: "",
      })
    }
    const activeSection = req.query.section || 'place-bid';
    // 1. Fetch all available bids (exclude bids where company has already bid and only include open bids)
    const bids = await Bid.find({
      "companyBids.companyId": { $ne: companyId },
      status: "open"
    }).lean();

    // 2. Fetch bids where this company has placed a bid
    const projectsWithCompanyBids = await Bid.find({
      "companyBids.companyId": companyId,
    }).lean()

    // Format company bids for display
    const companyBids = []
    projectsWithCompanyBids.forEach((project) => {
      const companyBid = project.companyBids.find((bid) => bid.companyId.toString() === companyId.toString())

      if (companyBid) {
        // Determine status based on project state
        // This is a placeholder - you'll need to implement your own status logic
        let status = "Pending"
        if (project.winningBidId) {
          status = project.winningBidId.toString() === companyBid._id.toString() ? "Accepted" : "Rejected"
        }

        companyBids.push({
          project: project,
          bidPrice: companyBid.bidPrice,
          bidDate: companyBid.bidDate,
          status: status,
        })
      }
    })

    // 3. Handle selected bid if ID is provided
    const selectedBidId = req.query.bidId
    let selectedBid = null

    if (selectedBidId && mongoose.Types.ObjectId.isValid(selectedBidId)) {
      selectedBid = await Bid.findById(selectedBidId).lean()
    }
    const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };
    // 4. Render with all necessary data
    res.render("company/company_bids", {
      activeSection: activeSection,
      bids,
      companyBids,
      selectedBid,
      req,
      companyName: company.companyName,
      companyId: company._id,
    })
  } catch (error) {
    console.error("Error fetching bids:", error)
    res.status(500).render("company/company_bids", {
      error: "Error loading bids",
      bids: [],
      companyBids: [],
      selectedBid: null,
      req,
      companyName: "",
      companyId: "",
    })
  }
})

// Route to handle bid submission
app.post("/submit-bid", isAuthenticated, async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { bidPrice, bidId } = req.body
    const companyId = req.user.user_id

    // Validate inputs
    if (!bidPrice || isNaN(bidPrice) || bidPrice <= 0) {
      await session.abortTransaction()
      session.endSession()
      return res.redirect(`/companybids.html?bidId=${bidId}&error=invalid_data`)
    }

    if (!mongoose.Types.ObjectId.isValid(bidId)) {
      await session.abortTransaction()
      session.endSession()
      return res.redirect("/companybids.html?error=invalid_data")
    }

    // Get company details
    const company = await Company.findById(companyId).session(session)
    if (!company) {
      await session.abortTransaction()
      session.endSession()
      return res.redirect("/companybids.html?error=server_error")
    }

    // Find the bid project
    const bidProject = await Bid.findById(bidId).session(session)
    if (!bidProject) {
      await session.abortTransaction()
      session.endSession()
      return res.redirect("/companybids.html?error=server_error")
    }

    // Check if company already submitted a bid
    const hasExistingBid = bidProject.companyBids.some((bid) => bid.companyId.toString() === companyId.toString())

    if (hasExistingBid) {
      // Update existing bid
      await Bid.updateOne(
        {
          _id: bidId,
          "companyBids.companyId": companyId,
        },
        {
          $set: {
            "companyBids.$.bidPrice": Number(bidPrice),
            "companyBids.$.bidDate": new Date(),
          },
        },
        { session },
      )
    } else {
      // Create new bid submission
      const newBid = {
        companyId,
        companyName: company.companyName,
        bidPrice: Number(bidPrice),
        bidDate: new Date(),
      }

      // Add the bid to the project
      await Bid.updateOne({ _id: bidId }, { $push: { companyBids: newBid } }, { session })
    }

    await session.commitTransaction()
    session.endSession()

    // Redirect with success message
    res.redirect(`/companybids.html?bidId=${bidId}&success=bid_submitted`)
  } catch (error) {
    await session.abortTransaction()
    session.endSession()
    console.error("Error submitting bid:", error)
    res.redirect(`/companybids.html?error=server_error`)
  }
})
// Get customer bidspace page with dynamic data
app.get('/bidspace.html', isAuthenticated, async (req, res) => {
  try {
    // Get customer ID from authenticated user
    const customerId = req.user.user_id;

    // Fetch bids created by this customer
    const customerBids = await Bid.find({ customerId }).lean();

    res.render("customer/bid_space", {
      customerBids,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).send('Server error');
  }
});

// Accept a company's bid
app.post('/accept-bid', isAuthenticated, async (req, res) => {
  try {
    const { bidId, companyBidId } = req.body;
    const customerId = req.user.user_id;

    // Validate the bid belongs to this customer
    const bid = await Bid.findOne({ 
      _id: bidId, 
      customerId 
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found or unauthorized' });
    }

    // Find the company bid in the array
    const companyBid = bid.companyBids.id(companyBidId);
    if (!companyBid) {
      return res.status(404).json({ error: 'Company bid not found' });
    }

    // Update the bid status and set winning bid
    bid.status = 'awarded';
    bid.winningBidId = companyBidId;
    await bid.save();

    res.json({ success: true, message: 'Bid accepted successfully' });
  } catch (error) {
    console.error('Error accepting bid:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Decline a company's bid
// Decline a company's bid (mark as rejected)
app.post('/decline-bid', isAuthenticated, async (req, res) => {
  try {
    const { bidId, companyBidId } = req.body;
    const customerId = req.user.user_id;

    // 1. Validate parent bid belongs to requesting customer
    const bid = await Bid.findOne({
      _id: bidId,
      customerId: customerId
    });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found or unauthorized' });
    }

    // 2. Find the specific company bid subdocument
    const companyBid = bid.companyBids.id(companyBidId);
    if (!companyBid) {
      return res.status(404).json({ error: 'Company bid not found' });
    }

    // 3. Update status to rejected
    companyBid.status = 'rejected';
    companyBid.statusChangedAt = Date.now(); // If you added this timestamp field

    // 4. Save changes
    await bid.save();

    res.json({
      success: true,
      message: 'Bid declined successfully',
      updatedBid: {
        _id: bid._id,
        status: bid.status,
        companyBids: bid.companyBids.map(b => ({
          _id: b._id,
          status: b.status,
          companyName: b.companyName
        }))
      }
    });

  } catch (error) {
    console.error('Error declining bid:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});
// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
      const projects = await ConstructionProjectSchema.find({status: 'pending'}).lean();
      res.render('projects', { projects });
  } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project by ID
app.get('/api/projects/:id', async (req, res) => {
  try {
      const project = await ConstructionProjectSchema.findById(req.params.id).lean();
      if (!project) {
          return res.status(404).json({ error: 'Project not found' });
      }
      res.json(project);
  } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
  }
});
// GET route to render the edit project form
app.get('/edit-project/:id', isAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).send('Invalid project ID');
    }

    const project = await ConstructionProjectSchema.findById(projectId);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    res.render('company/addnewproject_form', { project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).send('Server error');
  }
});
app.post(
  '/api/projects/update',
  (req, res, next) => {
    console.log('Incoming body fields:', Object.keys(req.body));
    console.log('Incoming file fields:', Object.keys(req.files || {}));
    next();
  },
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 10 },
    { name: 'updateImages', maxCount: 1 },
  ]),
  (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).json({ message: 'File upload error', error: err.message });
    }
    if (err) {
      console.error('Other error:', err);
      return res.status(400).json({ message: 'File upload error', error: err.message });
    }
    next();
  },
  async (req, res) => {
    try {
      const {
        projectId,
        completionPercentage,
        targetCompletionDate,
        currentPhase,
        updates,
      } = req.body;

      // Validate projectId
      if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }

      // Find the project
      const project = await ConstructionProjectSchema.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Update fields only if provided
      if (completionPercentage) project.completionPercentage = parseInt(completionPercentage);
      if (targetCompletionDate) project.targetCompletionDate = new Date(targetCompletionDate);
      if (currentPhase) project.currentPhase = currentPhase;

      // Handle file uploads and normalize paths to use backslashes
      if (req.files.mainImage) {
        const filePath = req.files.mainImage[0].path.replace(/\//g, '\\');
        project.mainImagePath = filePath; // e.g., \Uploads\1746617698619-863761563.png
      }
      if (req.files.additionalImages) {
        project.additionalImagePaths = req.files.additionalImages.map(file => 
          file.path.replace(/\//g, '\\') // e.g., \Uploads\1746617698619-863761563.png
        );
      }

      // Handle recent updates
      if (updates) {
        const updateImages = req.files.updateImages || [];
        const updatesArray = Array.isArray(updates) ? updates : [updates];
        project.recentUpdates = updatesArray.map((updateText, index) => ({
          updateText: updateText || '',
          updateImagePath: updateImages[0]
            ? updateImages[0].path.replace(/\//g, '\\') // e.g., \Uploads\1746617698619-863761563.png
            : null,
          createdAt: new Date(),
        }));
      }

      // Save the updated project
      await project.save();

      res.status(200).json({ message: 'Project updated successfully' });
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);