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
// Route for showing pending jobs for both architects and interior designers
app.get("/workerjobs.html", isAuthenticated, async (req, res) => {
  try {
      if (!req.user || !req.user.user_id) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    const worker = await Worker.findById(req.user.user_id).select(
      "isArchitect"
    );

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    if (worker.isArchitect) {
      const Jobs = await ArchitectHiring.find({
        worker: req.user.user_id,
        status: "Pending"
      }).sort({ updatedAt: -1 });

      return res.render("worker/worker_jobs", {
        user: req.user,
        jobOffers: Jobs
      });
    } else {
      const Jobs = await DesignRequest.find({
        workerId: req.user.user_id,
        status: "pending",
      }).sort({ updatedAt: -1 });

      return res.render("worker/InteriorDesigner_Jobs", {
        user: req.user,
        jobs: Jobs
      });
    }
  } catch (error) {
    console.error("Error fetching accepted projects:", error.message);
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
  res.render("landing_page");
});
// Serve Static Files
app.use(express.static("Final Pages"));
app.get('/companydashboard.html',isAuthenticated, async (req, res) => {
  try {
    // Fetch open bids (limited to 2 for display, adjust as needed)
    const bids = await Bid.find({ status: 'open' })
      .sort({ createdAt: -1 })
      .limit(2)
      .lean();

    // Fetch all projects for the company
    const projects = await ConstructionProjectSchema.find({
      companyId: req.user ? req.user.user_id : null
    })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate stats
    const activeProjects = projects.filter(p => p.status === 'accepted').length;
    const completedProjects = projects.filter(p => p.status === 'rejected').length;
    const revenue = projects
      .filter(p => 
        p.status === 'rejected' && 
        new Date(p.updatedAt).getMonth() === new Date().getMonth() &&
        new Date(p.updatedAt).getFullYear() === new Date().getFullYear()
      )
      .reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);

    // Render the dashboard
    res.render('company/company_dashboard', {
      bids,
      projects,
      activeProjects,
      completedProjects,
      revenue,
      calculateProgress,
      calculateDaysRemaining
    });
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    res.status(500).send('Server Error');
  }
});
app.get("/customerdashboard.html", (req, res) => {
  res.render("customer/customer_dashboard");
});
app.get('/workerdashboard.html', isAuthenticated, async (req, res) => {
  try {
    // Check authentication
    if (!req.user || !req.user.user_id) {
      console.error('Authentication error - missing user ID');
      return res.status(401).send('Unauthorized: User not authenticated');
    }

    // Fetch worker details
    const worker = await Worker.findById(req.user.user_id).lean();
    if (!worker) {
      console.error(`Worker not found for ID: ${req.user.user_id}`);
      return res.status(404).send('Worker not found');
    }

    // Parallel data fetching
    const [offers, companies, jobs] = await Promise.all([
      // Recent offers
      CompanytoWorker.find({ worker: req.user.user_id, status: 'Pending' })
        .populate('company', 'companyName')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),

      // Companies
      Company.find({})
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),

      // Design jobs
      DesignRequest.find({ workerId: req.user.user_id, status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()
    ]);

    // Enhance jobs data
    const enhancedJobs = jobs.map(job => ({
      ...job,
      timeline: job.roomType === 'Residential' ? '2 weeks' : '1 month',
      budget: job.roomSize?.length && job.roomSize?.width 
        ? job.roomSize.length * job.roomSize.width * 1000 
        : 0
    }));

    // Render dashboard view
    res.render('worker/worker_dashboard', {
      workerName: worker.name || 'Builder',
      offers: offers,
      companies: companies,
      jobs: enhancedJobs,
      user: req.user // Pass user data to view if needed
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      message: 'Dashboard Loading Failed',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});
app.get("/admindashboard.html", async (req, res) => {
  try {
    // Fetch all data from collections (adjust queries as needed)
    const Customers = await Customer.find({});
    const Companies = await Company.find({});
    const Workers = await Worker.find({});
    const customersCount = await Customer.countDocuments();
    const companiesCount = await Company.countDocuments();
    const workersCount = await Worker.countDocuments();
    const Projects = await ConstructionProjectSchema.find({});
    const Bids = await Bid.find({});

    res.render("admin/admin_dashboard", {
      customers: Customers,
      companies: Companies,
      workers: Workers,
      customersCount,
      companiesCount,
      workersCount,
      projects: Projects,
      bids: Bids,
    });
  } catch (err) {
    console.error("Error fetching data for admin dashboard:", err);
    res.status(500).send("Server Error");
  }
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

    const companyApplications = await ConstructionProjectSchema.find({
      customerId: req.user.user_id,
    }).lean();

    // Combine the records
    // Render the template with job requests
    res.render("customer/Job_Status", {
      architectApplications,
      interiorApplications,
      companyApplications// Pass user data if needed
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



app.get("/ongoing_projects.html", isAuthenticated, async (req, res) => {
  try {
    // Get the logged in company's ID from the session
    const customerId = req.user.user_id;

    // If no company is logged in, redirect to login
    if (!customerId) {
      return res.redirect("/login");
    }

    // Fetch only accepted projects for this company
    const projects = await ConstructionProjectSchema.find({
      customerId: customerId,
      status: "accepted",
    });

    // Calculate metrics based on accepted projects
    const totalActiveProjects = projects.length;

    // Example metrics - in a real app, these would be calculated from your data
    const metrics = {
      totalActiveProjects,
      monthlyRevenue: "4.8", // Placeholder value
      customerSatisfaction: "4.7", // Placeholder value
      projectsOnSchedule: "85", // Placeholder value
    };

    // Add some properties to projects for display purposes
    const enhancedProjects = projects.map((project) => {
      // Convert Mongoose document to plain JavaScript object
      const projectObj = project.toObject();

      // Add display-only properties with fallbacks
      // These fields don't exist in the schema, so we're setting defaults
      projectObj.completion = 0; // Default completion percentage
      projectObj.targetDate = getTargetDate(
        project.createdAt,
        project.projectTimeline
      );
      projectObj.currentPhase = "Update current "; // Default phase

      // Make sure we have safe defaults for all referenced properties
      if (!projectObj.siteFilepaths) {
        projectObj.siteFilepaths = [];
      }

      if (!projectObj.floors) {
        projectObj.floors = [];
      }

      // Ensure all values that might be displayed have safe defaults
      projectObj.customerName = projectObj.customerName || "None specified";
      projectObj.customerEmail = projectObj.customerEmail || "None specified";
      projectObj.customerPhone = projectObj.customerPhone || "None specified";
      projectObj.projectAddress = projectObj.projectAddress || "None specified";
      projectObj.projectLocation =
        projectObj.projectLocation || "None specified";
      projectObj.totalArea = projectObj.totalArea || "None specified";
      projectObj.buildingType = projectObj.buildingType || "other";
      projectObj.estimatedBudget = projectObj.estimatedBudget || 0;
      projectObj.projectTimeline =
        projectObj.projectTimeline || "None specified";
      projectObj.totalFloors = projectObj.totalFloors || 0;
      projectObj.specialRequirements =
        projectObj.specialRequirements || "None specified";
      projectObj.accessibilityNeeds =
        projectObj.accessibilityNeeds || "None specified";
      projectObj.energyEfficiency =
        projectObj.energyEfficiency || "None specified";

      return projectObj;
    });

    // Render the template with the data
    res.render("customer/ongoing_projects", {
      projects: enhancedProjects,
      metrics: metrics,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
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

// Updated route with better error handling
app.get("/companyongoing_projects.html",isAuthenticated, async (req, res) => {
  try {
    // Get the logged in company's ID from the session
    const companyId = req.user.user_id;
    
    // If no company is logged in, redirect to login
    if (!companyId) {
      return res.redirect('/login');
    }
    
    // Fetch only accepted projects for this company
    const projects = await ConstructionProjectSchema.find({ 
      companyId: companyId,
      status: "accepted" 
    });
    
    // Calculate metrics based on accepted projects
    const totalActiveProjects = projects.length;
    
    // Example metrics - in a real app, these would be calculated from your data
    const metrics = {
      totalActiveProjects,
      monthlyRevenue: '4.8', // Placeholder value
      customerSatisfaction: '4.7', // Placeholder value
      projectsOnSchedule: '85' // Placeholder value
    };
    
    // Add some properties to projects for display purposes
    const enhancedProjects = projects.map(project => {
      // Convert Mongoose document to plain JavaScript object
      const projectObj = project.toObject();
      
      // Add display-only properties with fallbacks
      // These fields don't exist in the schema, so we're setting defaults
      projectObj.completion = 0; // Default completion percentage
      projectObj.targetDate = getTargetDate(project.createdAt, project.projectTimeline);
      projectObj.currentPhase = 'Update current '; // Default phase
      
      // Make sure we have safe defaults for all referenced properties
      if (!projectObj.siteFilepaths) {
        projectObj.siteFilepaths = [];
      }
      
      if (!projectObj.floors) {
        projectObj.floors = [];
      }
      
      // Ensure all values that might be displayed have safe defaults
      projectObj.customerName = projectObj.customerName || "None specified";
      projectObj.customerEmail = projectObj.customerEmail || "None specified";
      projectObj.customerPhone = projectObj.customerPhone || "None specified";
      projectObj.projectAddress = projectObj.projectAddress || "None specified";
      projectObj.projectLocation = projectObj.projectLocation || "None specified";
      projectObj.totalArea = projectObj.totalArea || "None specified";
      projectObj.buildingType = projectObj.buildingType || "other";
      projectObj.estimatedBudget = projectObj.estimatedBudget || 0;
      projectObj.projectTimeline = projectObj.projectTimeline || "None specified";
      projectObj.totalFloors = projectObj.totalFloors || 0;
      projectObj.specialRequirements = projectObj.specialRequirements || "None specified";
      projectObj.accessibilityNeeds = projectObj.accessibilityNeeds || "None specified";
      projectObj.energyEfficiency = projectObj.energyEfficiency || "None specified";
      
      return projectObj;
    });
    
    // Render the template with the data
    res.render("company/company_ongoing_projects", {
      projects: enhancedProjects,
      metrics: metrics
    });
    
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
});

// Helper function to calculate target date based on creation date and timeline
function getTargetDate(createdAt, projectTimeline) {
  if (!createdAt || !projectTimeline || isNaN(parseInt(projectTimeline))) {
    return 'June 2025'; // Default fallback
  }
  
  try {
    const targetDate = new Date(createdAt);
    targetDate.setMonth(targetDate.getMonth() + parseInt(projectTimeline));
    
    // Format date as Month Year
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return `${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
  } catch (error) {
    return 'June 2025'; // Default fallback in case of any error
  }
}


app.get("/project_requests.html", isAuthenticated,async(req, res) => {
  try {
    const projects = await ConstructionProjectSchema.find({status: 'pending',companyId:req.user.user_id}).lean();
    res.render('company/project_requests', { projects });
} catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
}
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
app.get("/revenue_form.html", (req, res) => {
  res.render("company/revenue_form");
});

app.get("/addnewproject_form.html", (req, res) => {
  res.render("company/addnewproject_form");
});

app.get("/companySettings",(req,res)=>{
  res.render("company/company_settings");
})
function calculateProgress(startDate, timeline) {
  if (!timeline) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const end = new Date(start.setMonth(start.getMonth() + timeline));
  const totalDays = (end - start) / (1000 * 60 * 60 * 24);
  const elapsedDays = (now - start) / (1000 * 60 * 60 * 24);
  return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
}

function calculateDaysRemaining(startDate, timeline) {
  if (!timeline) return 'TBD';
  const start = new Date(startDate);
  const end = new Date(start.setMonth(start.getMonth() + timeline));
  const now = new Date();
  return Math.max(0, Math.round((end - now) / (1000 * 60 * 60 * 24)));
}
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