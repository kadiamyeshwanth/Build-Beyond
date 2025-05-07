const {express,app,PORT,bodyParser,cookieParser,SQLiteStore,cors,path,mongoose,router,multer,fs,bcrypt} = require("./getServer");
const {Customer,Company,Worker,ArchitectHiring,ConstructionProjectSchema,DesignRequest,Bid,workertocompany,CompanytoWorker}=require("./Models.js")
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

//Architect 
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

//Interiror design
app.post('/design_request', upload.any(), async (req, res) => {
  try {
    const {
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
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !address || !roomType || !roomLength || !roomWidth || !dimensionUnit) {
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
app.post('/bidForm_Submit', upload.fields([
    { name: 'siteFiles', maxCount: 10 },
    { name: 'floorImages', maxCount: 100 }
]), async (req, res) => {
    try {
        // Placeholder customerId (replace with actual auth system)
        const customerId = new mongoose.Types.ObjectId();

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
      const { position, location, salary } = req.body;

      // Replace these with actual values (from session, auth, or hidden form inputs)
      const dummyCompanyId = req.user.user_id;
      const dummyWorkerId = req.user.user_id;

      const newEntry = new CompanytoWorker({
          position,
          location,
          salary,
          company: dummyCompanyId,
          worker: dummyWorkerId
      });

      await newEntry.save();
      res.status(201).json({ message: 'Offer successfully saved.' });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

