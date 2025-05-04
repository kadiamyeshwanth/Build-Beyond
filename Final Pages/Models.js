// Schemas
// const {
//   express,
//   app,
//   PORT,
//   bodyParser,
//   session,
//   SQLiteStore,
//   cors,
//   path,
//   mongoose,
//   router,
//   multer,
//   fs,
//   bcrypt
// } = require("./getServer");

// app.set("view engine", "ejs");
// app.set("views", "views");

const mongoose=require("mongoose")
const bcrypt=require("bcrypt");

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
      address: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
    },
    description: { type: String },
    specialization: [{ type: String }], // Array of specializations
    size: {
      type: String,
      enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
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
        name: { type: String },
        year: { type: Number },
        location: { type: String },
        description: { type: String },
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

// Index for faster queries on specialization
workerSchema.index({ specialization: 1 });

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

// Models
const Customer = mongoose.model("Customer", customerSchema);
const Company = mongoose.model("Company", companySchema);
const Worker = mongoose.model("Worker", workerSchema);
const ArchitectHiring = mongoose.model(
  "ArchitectHiring",
  architectHiringSchema
);

module.exports = { Customer, Company, Worker, ArchitectHiring };
