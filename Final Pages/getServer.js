const express = require("express");
const app = express();
const PORT = 4000;
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const router = express.Router();
// Multer
const multer = require("multer");
const fs = require("fs");
const bcrypt=require("bcrypt");
const {Customer,Company,Worker,ArchitectHiring,ConstructionProjectSchema,DesignRequest,Bid,WorkerToCompany,CompanytoWorker}=require("./Models.js")
const jwt = require("jsonwebtoken");

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.json());
app.use(express.static("Final Pages"));
app.use(cors({
  origin: true,
  credentials: true 
}));
// JWT Authentication Middleware
const isAuthenticated = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/signin_up.html'); // Redirect to login if no token
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cec1dc25cec256e194e609ba68d0e62b7554e7b664468a99d8ca788e0b657ec7');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    res.clearCookie('token');
    return res.redirect('/signin_up.html');
  }
};
// Landing Route
app.get("/", (req, res) => {  
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


app.get("/workerjobs.html", isAuthenticated, async (req, res) => {
  try {
    // Validate req.user and req.user.user_id
    if (!req.user || !req.user.user_id) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    // Query worker by ID
    const worker = await Worker.findById(req.user.user_id).select(
      "isArchitect"
    );

    // Check if worker exists
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    // Render appropriate view based on isArchitect
    const view = worker.isArchitect
      ? "worker/worker_jobs"
      : "worker/InteriorDesigner_Jobs";
    res.render(view, { user: req.user }); // Pass user data to the view if needed
  } catch (error) {
    console.error("Error fetching worker:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/workerjoin_company.html", isAuthenticated, async (req, res) => {
  try {
    // Extract worker ID from req.user
    const workerId = req.user.user_id;

    // Fetch worker details
    const user = await Worker.findById(workerId).lean(); // .lean() for plain JS object (Mongoose)

    // Fetch all companies
    const companies = await Company.find().lean();

    // Fetch CompanytoWorker mappings (e.g., companies that invited the worker)
    const offers = await CompanytoWorker.find({ worker:req.user.user_id }).lean();

    // Fetch WorkerToCompany mappings (e.g., worker's requests to join companies)
    const jobApplications = await WorkerToCompany.find({ workerId:req.user.user_id }).lean();
    res.render("worker/workers_join_company", {
      user,
      companies,
      offers,
      jobApplications,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Server error");
  }
});

app.get("/workersettings.html", isAuthenticated,async (req, res) => {
  const user=await Worker.findById(req.user.user_id);
  res.render("worker/worker_settings",{user});
});

app.get("/worker_edit", (req, res) => {
  res.render("worker/worker_profile_edit");
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

app.get("/Job_Request_Status",isAuthenticated, async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.user_id) {
      return res.status(401).send("Unauthorized");
    }
    
    // Fetch ArchitectHiring records where workerId matches userId
    const architectApplications = await ArchitectHiring.find({
      customer: req.user.user_id,
    }).lean();

    // Fetch DesignRequest records where workerId matches userId
    const interiorApplications = await DesignRequest.find({
      customerId: req.user.user_id,
    }).lean();

    // Combine the records
    // Render the template with job requests
    res.render("customer/Job_Status", {
      architectApplications,
      interiorApplications, // Pass user data if needed
    });
  } catch (error) {
    console.error("Error fetching job request status:", error);
    res.status(500).send("Internal Server Error");
  }
});
app.get('/construction_comanies_list.html', isAuthenticated, async (req, res) => {
  try {
    // Fetch all companies from the database
    const companies = await Company.find({}).lean();
    
    // Render the EJS template with the companies data
    res.render('customer/construction_companies_list', { 
      companies,
      user: req.user
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).send('Server error');
  }
});
app.get("/construction_companies_profile.html", (req, res) => {
  res.render("customer/construction_companies_profile");
});
app.get("/architect.html", async (req, res) => {
   try {
        // Find all workers that are architects (isArchitect = true)
        const architects = await Worker.find({ 
            isArchitect: true 
        });
        
        // Render the EJS template with architect data
        res.render('customer/architect', { architects });
    } catch (error) {
        console.error('Error fetching architects:', error);
        res.status(500).json({ message: 'Failed to fetch architects' });
    }
});
app.get("/architecht_form", (req, res) => {
  const { workerId } = req.query;
  // Render the form template with the workerId
  res.render("customer/architect_form", { workerId });
});
app.get("/ongoing_projects.html", (req, res) => {
  res.render("customer/ongoing_projects");
});
app.get("/design_ideas.html", (req, res) => {
  res.render("customer/design_ideas");
});
app.get("/architecht_form.html", (req, res) => {
  res.render("customer/architect_form");
});
app.get("/interiordesign_form", isAuthenticated,async(req, res) => {
  const { workerId } = req.query;
  // Render the form template with the workerId
  res.render("customer/interiordesign_form", { workerId });
}); 

app.get("/interior_designer.html",isAuthenticated, async(req, res) => {
  try {
    // Find all workers that are architects (isArchitect = false)
    const designers = await Worker.find({ 
        isArchitect: false
    });
    
    // Render the EJS template with architect data
    res.render('customer/interior_design', { designers });
} catch (error) {
    console.error('Error fetching architects:', error);
    res.status(500).json({ message: 'Failed to fetch architects' });
}});

app.get("/constructionform.html", (req, res) => {
  res.render("customer/construction_form");
});
app.get("/bidform.html", (req, res) => {
  res.render("customer/bid_form");
});
app.get("/customersettings.html", isAuthenticated,async(req, res) => {
  const user=await Customer.findById(req.user.user_id);
  res.render("customer/customer_settings",{user});
});
// Company routes
app.get("/companyongoing_projects.html", (req, res) => {
  res.render("company/company_ongoing_projects");
});
app.get("/companyclients.html", (req, res) => {
  res.render("company/clients");
});
app.get("/companyrevenue.html", (req, res) => {
  res.render("company/revenue");
});
app.get("/companyhiring.html", isAuthenticated,async (req, res) => {
  try {
    const companyId = new mongoose.Types.ObjectId(req.user.user_id);

    // Fetch all available workers
    const workers = await Worker.find().lean();

    // Format workers with fallback image and rating (optional defaults)
    const processedWorkers = workers.map(worker => ({
      ...worker,
      profileImage: worker.profileImage?.trim()
        ? worker.profileImage
        : `https://api.dicebear.com/9.x/male/svg?seed=${encodeURIComponent((worker.name || 'worker').replace(/\s+/g, ''))}&mouth=smile`,
      rating: worker.rating || 0
    }));

    // Fetch pending requests (from workers to company)
    const workerRequests = await WorkerToCompany.find({ companyId })
      .populate("workerId")
      .lean();

    // Fetch requests sent by company to workers
    const requestedWorkersRaw = await CompanytoWorker.find({ company: companyId })
      .populate("worker", "name email location profileImage")
      .lean();

    const requestedWorkers = requestedWorkersRaw.map(request => ({
      _id: request._id,
      positionApplying: request.position,
      expectedSalary: request.salary,
      status: request.status,
      location: request.location,
      worker: {
        name: request.worker?.name || "Unknown",
        email: request.worker?.email || "N/A"
      }
    }));

    res.render("company/hiring", {
      workers: processedWorkers,
      workerRequests,
      requestedWorkers
    });
  } catch (err) {
    console.error("Error loading hiring page:", err);
    res.status(500).send("Error loading hiring page");
  }
});

app.get("/companysettings.html",isAuthenticated, async(req, res) => {
  const user=await Company.findById(req.user.user_id);
  res.render("company/company_settings", { user });
});
app.get("/companysettings.html", async(req, res) => {
  const user=await Company.findById(req.user.user_id);
  res.render("company/company_settings", { user });
});
app.get("/revenue_form.html", (req, res) => {
  res.render("company/revenue_form");
});

app.get("/addnewproject_form.html", (req, res) => {
  res.render("company/addnewproject_form");
});

app.get("/companySettings",(req,res)=>{
  res.render("company/company_settings");
})

module.exports = {
  express,
  app,
  PORT,
  bodyParser,
  cookieParser,
  cors,
  path,
  mongoose,
  router,
  multer,
  fs,
  bcrypt,
  jwt
};

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});