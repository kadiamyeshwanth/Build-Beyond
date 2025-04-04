const express = require("express");
const mongoose = require("mongoose");
const ejs = require("ejs");
const path = require("path");

const app = express();

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/revenueDashboard", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Project Schema
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ["ongoing", "completed"], required: true },
  totalCost: { type: Number, required: true },
  receivedAmount: { type: Number, required: true },
  pendingAmount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  estimatedEndDate: { type: Date },
  endDate: { type: Date },
  clientName: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  completionPercentage: { type: Number, min: 0, max: 100 },
});

const Project = mongoose.model("Project", projectSchema);

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper function for number formatting
const formatNumber = (num) => {
  return num.toLocaleString("en-US");
};

// Routes
app.get("/", async (req, res) => {
  try {
    const projects = await Project.find().sort({ startDate: -1 });

    const ongoingCount = await Project.countDocuments({ status: "ongoing" });
    const completedCount = await Project.countDocuments({
      status: "completed",
    });

    const totalRevenue = projects.reduce(
      (sum, project) => sum + project.receivedAmount,
      0
    );

    res.render("dashboard", {
      projects,
      ongoingCount,
      completedCount,
      totalRevenue,
      formatNumber,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// API endpoint for project details
app.get("/api/projects/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Edit route
app.get("/edit/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).send("Project not found");
    }
    // Here you would render an edit form (you'll need to create this)
    res.send("Edit form would go here");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Seed initial data (run once)
async function seedDatabase() {
  const count = await Project.countDocuments();
  if (count === 0) {
    const sampleProjects = [
      {
        name: "City Heights Tower",
        status: "ongoing",
        totalCost: 1250000,
        receivedAmount: 650000,
        pendingAmount: 600000,
        startDate: new Date("2024-04-15"),
        estimatedEndDate: new Date("2025-03-20"),
        clientName: "Urban Living Enterprises",
        location: "Downtown Financial District",
        description:
          "A 28-story luxury apartment complex with retail spaces on the ground floor. The project includes smart home integration throughout the building.",
        completionPercentage: 52,
      },
      // Add all other sample projects here...
    ];

    await Project.insertMany(sampleProjects);
    console.log("Database seeded with sample projects");
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  seedDatabase();
});
