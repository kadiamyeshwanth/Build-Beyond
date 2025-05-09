const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      required: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },
    dob: { type: Date, required: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "customer" },
  },
  { timestamps: true }
);

const companySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      required: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },
    phone: { type: String, required: true },
    companyDocuments: [{ type: String, default: [] }],
    password: { type: String, required: true },
    role: { type: String, default: "company" },
    location: {
      address: { type: String, default: '' },
      city: { type: String, default: 'Not specified' },
      state: { type: String, default: '' },
      country: { type: String, default: '' },
      postalCode: { type: String, default: '' }
    },
    description: { type: String },
    aboutCompany: { type: String }, // For worker profile
    whyJoinUs: { type: String }, // For worker profile
    currentOpenings: [{ type: String }], // For worker profile
    specialization: [{ type: String }], // Array of specializations
    size: {
      type: String,
      enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
    },
    // For customer profile
    projectsCompleted: { type: String },
    yearsInBusiness: { type: String },
    teamMembers: [
      {
        name: { type: String },
        position: { type: String },
        image: { type: String },
      },
    ],
    completedProjects: [
      {
        title: { type: String },
        description: { type: String },
        image: { type: String },
      },
    ],
    didYouKnow: { type: String },
    profileType: {
      type: String,
      enum: ["worker", "customer"],
      default: "worker",
    },
  },
  { timestamps: true }
);

const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      required: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    aadharNumber: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^\d{12}$/.test(v);
        },
        message: "Aadhaar number must be 12 digits",
      },
    },
    dob: { type: Date, required: true },
    specialization: { type: String, required: true },
    experience: { type: Number, default: 0, min: 0 },
    certificateFiles: [{ type: String }],
    role: { type: String, default: "worker" },
    profileImage: { type: String },
    professionalTitle: { type: String },
    about: { type: String },
    specialties: [{ type: String, default: [] }],
    projects: [
      {
        name: { type: String, required: true },
        year: { type: Number, required: true, min: 1900, max: 2100 },
        location: { type: String, required: true },
        description: { type: String, required: true },
        image: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    isArchitect: { type: Boolean, default: false },
    servicesOffered: [{ type: String, default: [] }],
    availability: {
      type: String,
      enum: ["available", "busy", "unavailable"],
      default: "available",
    },
  },
  { timestamps: true }
);

// Optional indexes for performance
workerSchema.index({ specialization: 1 });
workerSchema.index({ isArchitect: 1 });
workerSchema.index({ availability: 1 });

// Password Hashing Middleware
[customerSchema, companySchema, workerSchema].forEach((schema) => {
  schema.pre("save", async function (next) {
    if (this.isModified("password")) {
      this.password = await bcrypt.hash(this.password, 10);
    }
    next();
  });
});

const architectHiringSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: [true, "Project name is required"],
    trim: true,
  },
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected"],
    default: "Pending",
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to User model (customer)
    required: true,
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to User model (architect/worker)
    required: false, // Optional, as worker may be assigned later
  },
  customerDetails: {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
  },
  customerAddress: {
    streetAddress: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    zipCode: {
      type: String,
      required: true,
      trim: true,
    },
  },
  plotInformation: {
    plotLocation: {
      type: String,
      required: true,
      trim: true,
    },
    plotSize: {
      type: String,
      required: true,
      trim: true,
    },
    plotOrientation: {
      type: String,
      required: true,
      enum: [
        "North",
        "South",
        "East",
        "West",
        "North-East",
        "North-West",
        "South-East",
        "South-West",
      ],
    },
  },
  designRequirements: {
    designType: {
      type: String,
      required: true,
      enum: [
        "Residential",
        "Commercial",
        "Landscape",
        "Mixed-Use",
        "Industrial",
        "Other",
      ],
    },
    numFloors: {
      type: String,
      required: true,
      enum: ["1", "2", "3", "4", "5+"],
    },
    floorRequirements: [
      {
        floorNumber: {
          type: Number,
          required: true,
        },
        details: {
          type: String,
          trim: true,
        },
      },
    ],
    specialFeatures: {
      type: String,
      trim: true,
    },
    architecturalStyle: {
      type: String,
      required: true,
      enum: [
        "Modern",
        "Traditional",
        "Contemporary",
        "Minimalist",
        "Mediterranean",
        "Victorian",
        "Colonial",
        "Industrial",
        "Other",
      ],
    },
  },
  additionalDetails: {
    budget: {
      type: String,
      trim: true,
    },
    completionDate: {
      type: Date,
    },
    referenceImages: [
      {
        url: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
          enum: ["image/jpeg", "image/png", "application/pdf"],
        },
        size: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to update the updatedAt field before saving
architectHiringSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const constructionProjectSchema = new mongoose.Schema({
  // Project Identification
  projectName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },

  // Customer Information
  customerName: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
    required: true,
    match: [/.+\@.+\..+/, "Please enter a valid email"],
  },
  customerPhone: {
    type: String,
    required: true,
  },

  // Project Details
  projectAddress: {
    type: String,
    required: true,
  },
  projectLocation: {
    type: String,
  },
  totalArea: {
    type: Number,
    required: true,
  },
  buildingType: {
    type: String,
    enum: ["residential", "commercial", "industrial", "mixedUse", "other"],
    required: true,
  },
  estimatedBudget: Number,
  projectTimeline: Number,

  // Floor Plans
  totalFloors: {
    type: Number,
    required: true,
    min: 1,
  },
  floors: [
    {
      floorNumber: Number,
      floorType: {
        type: String,
        enum: ["residential", "commercial", "parking", "mechanical", "other"],
      },
      floorArea: Number,
      floorDescription: String,
      floorImage: String,
    },
  ],

  // Additional Requirements
  specialRequirements: String,
  accessibilityNeeds: {
    type: String,
    enum: ["wheelchair", "elevators", "ramps", "other", "none", ""],
  },
  energyEfficiency: {
    type: String,
    enum: ["standard", "leed", "passive", "netZero", "other", ""],
  },
  siteFilepaths: [String],

  // Progress and Updates (Added from Form)
  completionPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  targetCompletionDate: {
    type: Date,
  },
  currentPhase: {
    type: String,
    enum: ["Foundation", "Structure", "Interior work", "Finishing"],
  },
  mainImagePath: String,
  additionalImagePaths: [String],
  recentUpdates: [
    {
      updateText: String,
      updateImagePath: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

constructionProjectSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const designRequestSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  roomType: { type: String, required: true },
  roomSize: {
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    unit: { type: String, required: true, enum: ["feet", "meters"] },
  },
  ceilingHeight: {
    height: { type: Number },
    unit: { type: String, enum: ["feet", "meters"] },
  },
  designPreference: { type: String },
  projectDescription: { type: String },
  currentRoomImages: [{ type: String }], // Array of image paths
  inspirationImages: [{ type: String }], // Array of image paths
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false 
  },
  workerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // or 'Worker' if you have a separate model
  },
  createdAt: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ["pending", "accepted","rejected"],
    default: "pending"
  }
});

//Bid-form by Krishna
const floorSchema = new mongoose.Schema({
  floorNumber: {
    type: Number,
    required: true,
  },
  floorType: {
    type: String,
    enum: ["residential", "commercial", "parking", "mechanical", "other"],
    required: true,
  },
  floorArea: {
    type: Number,
    required: true,
    min: 0,
  },
  floorDescription: {
    type: String,
    trim: true,
  },
  floorImage: {
    type: String, // Store file path or URL for the image
    trim: true,
  },
});

// Define the company bid sub-schema
const companyBidSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company', // Reference to the Company model
    required: true,
  },
  companyName: {
    type: String,
    required: true,
    trim: true,
  },
  bidPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  bidDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending"
  }
});

const BidSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  customerName: {
    type: String,
    required: true,
    trim: true,
  },
  customerEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true,
  },
  projectAddress: {
    type: String,
    required: true,
    trim: true,
  },
  projectLocation: {
    type: String,
    required: true,
    trim: true,
  },
  totalArea: {
    type: Number,
    required: true,
    min: 0,
  },
  buildingType: {
    type: String,
    enum: ["residential", "commercial", "industrial", "mixedUse", "other"],
    required: true,
  },
  estimatedBudget: {
    type: Number,
    min: 0,
  },
  projectTimeline: {
    type: Number,
    min: 0,
  },
  totalFloors: {
    type: Number,
    required: true,
    min: 1,
  },
  floors: [floorSchema],
  specialRequirements: {
    type: String,
    trim: true,
  },
  accessibilityNeeds: {
    type: String,
    enum: ["wheelchair", "elevators", "ramps", "other", "none", ""],
  },
  energyEfficiency: {
    type: String,
    enum: ["standard", "leed", "passive", "netZero", "other", ""],
  },
  siteFiles: [
    {
      type: String, // Store file paths or URLs for uploaded documents
      trim: true,
    },
  ],
  companyBids: [companyBidSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // Add a field to track the winning bid
  winningBidId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "companyBids",
    default: null,
  },

  // Add a status field to the bid itself
  status: {
    type: String,
    enum: ["open", "closed", "awarded", "cancelled"],
    default: "open",
  }
});

BidSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Company To Worker Schema
const companyToWorkerSchema = new mongoose.Schema({
  position: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  salary: {
    type: Number,
    required: true,
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Worker",
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Denied"],
    default: "Pending",
  },
});

//Worker to Company
// Mongoose schema and model
const jobApplicationSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    location: {
      type: String,
      required: [true, "Current location is required"],
      trim: true,
    },
    linkedin: {
      type: String,
      trim: true,
      match: [
        /^https?:\/\/(www\.)?linkedin\.com\/.*$/,
        "Please enter a valid LinkedIn URL",
      ],
      default: null,
    },
    experience: {
      type: Number,
      required: [true, "Years of experience is required"],
      min: [0, "Experience cannot be negative"],
    },
    expectedSalary: {
      type: Number,
      required: [true, "Expected salary is required"],
      min: [0, "Expected salary cannot be negative"],
    },
    positionApplying: {
      type: String,
      required: [true, "Position applying for is required"],
      trim: true,
    },
    primarySkills: {
      type: [String],
      required: [true, "Primary skills are required"],
      validate: {
        validator: function (array) {
          return array.length > 0;
        },
        message: "At least one primary skill is required",
      },
    },
    workExperience: {
      type: String,
      required: [true, "Previous work experience is required"],
      trim: true,
    },
    resume: {
      type: String,
      required: [true, "Resume is required"],
      trim: true,
    },
    termsAgree: {
      type: Boolean,
      required: [true, "You must agree to the terms"],
      enum: [true],
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: [true, "Worker ID is required"],
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
    },
    compName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Denied"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

// Models
const Customer = mongoose.model("Customer", customerSchema);
const Company = mongoose.model("Company", companySchema);
const Worker = mongoose.model("Worker", workerSchema);
const ArchitectHiring = mongoose.model(
  "ArchitectHiring",
  architectHiringSchema
);
const ConstructionProjectSchema = mongoose.model(
  "ConstructionProjectSchema",
  constructionProjectSchema
);
const DesignRequest = mongoose.model("DesignRequest", designRequestSchema);
const Bid = mongoose.model("Bid", BidSchema);
const WorkerToCompany = mongoose.model("WorkerToCompany", jobApplicationSchema);
const CompanytoWorker = mongoose.model(
  "CompanytoWorker",
  companyToWorkerSchema
);

module.exports = {
  Customer,
  Company,
  Worker,
  ArchitectHiring,
  ConstructionProjectSchema,
  DesignRequest,
  Bid,
  WorkerToCompany,
  CompanytoWorker,
};
