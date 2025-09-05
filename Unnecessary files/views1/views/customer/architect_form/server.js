const express = require("express");
const mongoose = require("mongoose");
const ejs = require("ejs");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/architectureDesigns", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Design Request Schema
const designRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  contactNumber: { type: String, required: true },
  email: { type: String, required: true },
  streetAddress: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  plotLocation: { type: String, required: true },
  plotSize: { type: String, required: true },
  plotOrientation: { type: String, required: true },
  designType: { type: String, required: true },
  numFloors: { type: String, required: true },
  floorRequirements: { type: Object },
  specialFeatures: { type: String },
  architecturalStyle: { type: String, required: true },
  budget: { type: String },
  completionDate: { type: Date },
  referenceImages: { type: [String] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const DesignRequest = mongoose.model("DesignRequest", designRequestSchema);

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = "public/uploads";
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get("/design-request", (req, res) => {
  res.render("design-request", {
    formData: {},
    editMode: false,
  });
});

app.get("/edit-request/:id", async (req, res) => {
  try {
    const request = await DesignRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).send("Design request not found");
    }

    res.render("design-request", {
      formData: request,
      editMode: true,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.post(
  "/submit-design",
  upload.array("referenceImages"),
  async (req, res) => {
    try {
      const formData = req.body;
      const files = req.files || [];

      const designRequestData = {
        ...formData,
        referenceImages: files.map((file) => `/uploads/${file.filename}`),
        floorRequirements: formData.floorRequirements || {},
      };

      if (formData.requestId) {
        // Update existing request
        const updatedRequest = await DesignRequest.findByIdAndUpdate(
          formData.requestId,
          designRequestData,
          { new: true }
        );
        res.redirect(`/view-request/${updatedRequest._id}`);
      } else {
        // Create new request
        const newRequest = new DesignRequest(designRequestData);
        await newRequest.save();
        res.redirect(`/view-request/${newRequest._id}`);
      }
    } catch (err) {
      console.error(err);
      res.status(500).send("Error submitting design request");
    }
  }
);

app.get("/view-request/:id", async (req, res) => {
  try {
    const request = await DesignRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).send("Design request not found");
    }

    res.render("view-request", { request });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/list-requests", async (req, res) => {
  try {
    const requests = await DesignRequest.find().sort({ createdAt: -1 });
    res.render("list-requests", { requests });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Seed sample data (optional)
async function seedDatabase() {
  const count = await DesignRequest.countDocuments();
  if (count === 0) {
    const sampleRequest = {
      fullName: "John Doe",
      contactNumber: "1234567890",
      email: "john@example.com",
      streetAddress: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      plotLocation: "456 Park Ave",
      plotSize: "2000 sq.ft",
      plotOrientation: "North",
      designType: "Residential",
      numFloors: "2",
      floorRequirements: {
        1: "Living room, kitchen, 1 bedroom",
        2: "2 bedrooms, 1 bathroom",
      },
      specialFeatures: "Solar panels, garden",
      architecturalStyle: "Modern",
      budget: "$200,000 - $250,000",
      completionDate: new Date("2023-12-31"),
    };

    await DesignRequest.create(sampleRequest);
    console.log("Database seeded with sample design request");
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  seedDatabase();
});