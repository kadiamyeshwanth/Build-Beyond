const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const MONGODB_URI = "mongodb://localhost:27017";
const DB_NAME = "constructionWorkersDB";

// Set up EJS
app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Worker Model
class Worker {
  constructor(data) {
    this.name = data.name;
    this.title = data.title;
    this.location = data.location;
    this.skills = data.skills;
    this.experience = data.experience;
    this.rate = data.rate;
    this.availability = data.availability;
    this.contractType = data.contractType || "Project-based";
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.initials = this.getInitials();
  }

  getInitials() {
    return this.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }
}

// WorkerRequest Model
class WorkerRequest {
  constructor(data) {
    this.name = data.name;
    this.title = data.title;
    this.location = data.location;
    this.skills = data.skills;
    this.experience = data.experience;
    this.rate = data.rate;
    this.availability = data.availability;
    this.status = "pending";
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.initials = this.getInitials();
  }

  getInitials() {
    return this.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }
}

// Database Service
class DatabaseService {
  constructor() {
    this.client = new MongoClient(MONGODB_URI);
    this.db = null;
    this.workers = null;
    this.requests = null;
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db(DB_NAME);
      this.workers = this.db.collection("workers");
      this.requests = this.db.collection("workerRequests");
      console.log("Connected to MongoDB");
    } catch (err) {
      console.error("Error connecting to MongoDB:", err);
      throw err;
    }
  }

  async getWorkers(filters = {}, sort = {}, page = 1, limit = 6) {
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.location) query.location = filters.location;
    if (filters.skill) query.skills = filters.skill;
    if (filters.experience) query.experience = filters.experience;
    if (filters.rateRange) {
      const [min, max] = filters.rateRange.split("-").map(Number);
      query.rate = { $gte: min };
      if (max) query.rate.$lte = max;
    }
    if (filters.contractType) query.contractType = filters.contractType;

    const total = await this.workers.countDocuments(query);
    const workers = await this.workers
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      workers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getWorkerById(id) {
    return await this.workers.findOne({ _id: new ObjectId(id) });
  }

  async getWorkerRequests() {
    return await this.requests.find({ status: "pending" }).toArray();
  }

  async createWorker(workerData) {
    const worker = new Worker(workerData);
    const result = await this.workers.insertOne(worker);
    return result.insertedId;
  }

  async createWorkerRequest(requestData) {
    const request = new WorkerRequest(requestData);
    const result = await this.requests.insertOne(request);
    return result.insertedId;
  }

  async acceptWorkerRequest(requestId) {
    const request = await this.requests.findOne({
      _id: new ObjectId(requestId),
    });
    if (!request) throw new Error("Request not found");

    const worker = new Worker(request);
    await this.workers.insertOne(worker);
    await this.requests.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: "accepted", updatedAt: new Date() } }
    );

    return worker;
  }

  async getFilterOptions() {
    const locations = await this.workers.distinct("location");
    const skills = await this.workers.distinct("skills");
    const contractTypes = await this.workers.distinct("contractType");

    return { locations, skills, contractTypes };
  }

  async seedDatabase() {
    try {
      // Clear existing collections
      await this.workers.deleteMany({});
      await this.requests.deleteMany({});

      // Sample workers
      const workers = [
        new Worker({
          name: "Kedhar Jadhav",
          title: "Master Carpenter",
          location: "Kolkata",
          skills: ["Carpentry", "Woodworking"],
          experience: "10+ years",
          rate: 1200,
          availability: "Available Now",
          contractType: "Full-time",
        }),
        new Worker({
          name: "Arjun Suresh",
          title: "Electrical Engineer",
          location: "Hyderabad",
          skills: ["Electrical", "Wiring"],
          experience: "5-10 years",
          rate: 1000,
          availability: "In 1 week",
          contractType: "Contract",
        }),
        new Worker({
          name: "Ravindra Josh",
          title: "Master Plumber",
          location: "Mumbai",
          skills: ["Plumbing", "Piping"],
          experience: "3-5 years",
          rate: 1300,
          availability: "Available Now",
          contractType: "Full-time",
        }),
        new Worker({
          name: "Mahesh Krishna",
          title: "Master Mason",
          location: "Ahmedabad",
          skills: ["Masonry", "Stonework"],
          experience: "10+ years",
          rate: 1100,
          availability: "In 2 weeks",
          contractType: "Project-based",
        }),
        new Worker({
          name: "Suresh karthik",
          title: "Professional Painter",
          location: "Hyderabad",
          skills: ["Painting", "Finishing"],
          experience: "3-5 years",
          rate: 1500,
          availability: "Available Now",
          contractType: "Part-time",
        }),
        new Worker({
          name: "Tharun Ganesh",
          title: "HVAC Specialist",
          location: "Delhi",
          skills: ["HVAC", "Installation"],
          experience: "5-10 years",
          rate: 1450,
          availability: "In 1 week",
          contractType: "Contract",
        }),
      ];

      // Sample requests
      const requests = [
        new WorkerRequest({
          name: "Karthik Mahvash",
          title: "Concrete Specialist",
          location: "Gandhinagar",
          skills: ["Concrete", "Foundation"],
          experience: "8+ years",
          rate: 950,
          availability: "Available Immediately",
        }),
        new WorkerRequest({
          name: "Laksh Dev",
          title: "Architectural Drafter",
          location: "Meerut",
          skills: ["Drafting", "CAD"],
          experience: "5 years",
          rate: 1500,
          availability: "Available in 1 week",
        }),
        new WorkerRequest({
          name: "Patil Harish",
          title: "Heavy Equipment Operator",
          location: "Mumbai",
          skills: ["Excavation", "Heavy Machinery"],
          experience: "10+ years",
          rate: 1200,
          availability: "Available Immediately",
        }),
      ];

      await this.workers.insertMany(workers);
      await this.requests.insertMany(requests);

      console.log("Database seeded successfully");
    } catch (err) {
      console.error("Error seeding database:", err);
    }
  }
}

// Application Controller
class AppController {
  constructor(dbService) {
    this.db = dbService;
  }

  async renderHireWorkersPage(req, res) {
    try {
      const activeTab = req.query.tab || "find-workers";
      const page = parseInt(req.query.page) || 1;
      const limit = 6;

      // Get filter options
      const { locations, skills, contractTypes } =
        await this.db.getFilterOptions();

      // Define static options
      const experienceLevels = [
        { value: "1-3", label: "1-3 years" },
        { value: "3-5", label: "3-5 years" },
        { value: "5-10", label: "5-10 years" },
        { value: "10+", label: "10+ years" },
      ];

      const rateRanges = [
        { value: "500-750", label: "₹500-₹750/hr" },
        { value: "750-1000", label: "₹750-₹1000/hr" },
        { value: "1000-1500", label: "₹1000-₹1500/hr" },
        { value: "1500-9999", label: "₹1500+/hr" },
      ];

      const sortOptions = [
        { value: "relevance", label: "Relevance" },
        { value: "experience-desc", label: "Experience: High to Low" },
        { value: "rate-asc", label: "Rate: Low to High" },
        { value: "rate-desc", label: "Rate: High to Low" },
        { value: "availability", label: "Availability" },
      ];

      // Get sort criteria
      let sort = {};
      const sortBy = req.query.sort || "relevance";

      switch (sortBy) {
        case "experience-desc":
          sort = { experience: -1 };
          break;
        case "rate-asc":
          sort = { rate: 1 };
          break;
        case "rate-desc":
          sort = { rate: -1 };
          break;
        case "availability":
          sort = { availability: 1 };
          break;
        default:
          sort = { createdAt: -1 };
      }

      // Get filters from query
      const filters = {
        location: req.query.location,
        skill: req.query.skill,
        experience: req.query.experience,
        rateRange: req.query.rateRange,
        contractType: req.query.contractType,
      };

      // Get workers or requests based on active tab
      let workers = [];
      let requests = [];
      let totalWorkers = 0;
      let totalPages = 1;

      if (activeTab === "find-workers") {
        const result = await this.db.getWorkers(filters, sort, page, limit);
        workers = result.workers;
        totalWorkers = result.total;
        totalPages = result.totalPages;
      } else {
        requests = await this.db.getWorkerRequests();
      }

      res.render("hire-workers", {
        activeTab,
        workers,
        requests,
        totalWorkers,
        currentPage: page,
        totalPages,
        searchQuery: req.query.search || "",
        filters,
        sortBy,
        locations,
        skills,
        contractTypes,
        experienceLevels,
        rateRanges,
        sortOptions,
      });
    } catch (err) {
      console.error("Error rendering hire workers page:", err);
      res.status(500).send("Internal Server Error");
    }
  }

  async viewWorkerProfile(req, res) {
    try {
      const worker = await this.db.getWorkerById(req.params.id);
      if (!worker) {
        return res.status(404).send("Worker not found");
      }
      res.render("worker-profile", { worker });
    } catch (err) {
      console.error("Error viewing worker profile:", err);
      res.status(500).send("Internal Server Error");
    }
  }

  async hireWorker(req, res) {
    try {
      // In a real app, you would also create a contract/job record
      res.redirect("/hire-workers?tab=find-workers");
    } catch (err) {
      console.error("Error hiring worker:", err);
      res.status(500).send("Internal Server Error");
    }
  }

  async acceptRequest(req, res) {
    try {
      await this.db.acceptWorkerRequest(req.body.requestId);
      res.redirect("/hire-workers?tab=worker-requests");
    } catch (err) {
      console.error("Error accepting worker request:", err);
      res.status(500).send("Internal Server Error");
    }
  }
}

// Initialize and start the application
async function initializeApp() {
  const dbService = new DatabaseService();
  await dbService.connect();
  await dbService.seedDatabase();

  const appController = new AppController(dbService);

  // Routes
  app.get("/", (req, res) => res.redirect("/hire-workers"));
  app.get("/hire-workers", (req, res) =>
    appController.renderHireWorkersPage(req, res)
  );
  app.get("/workers/:id", (req, res) =>
    appController.viewWorkerProfile(req, res)
  );
  app.post("/hire", (req, res) => appController.hireWorker(req, res));
  app.post("/accept-request", (req, res) =>
    appController.acceptRequest(req, res)
  );

  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initializeApp().catch((err) => {
  console.error("Failed to initialize application:", err);
  process.exit(1);
});
