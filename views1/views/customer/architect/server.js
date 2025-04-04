const express = require("express");
const mongoose = require("mongoose");
const ejs = require("ejs");
const path = require("path");

const app = express();

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/architectureDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Architect Schema
const architectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  title: { type: String, required: true },
  experience: { type: String, required: true },
  image: { type: String, required: true },
  rating: { type: Number, required: true },
  bio: { type: String, required: true },
  specialties: { type: String, required: true },
  projects: [
    {
      name: String,
      location: String,
      year: String,
      image: String,
      description: String,
    },
  ],
  reviews: [
    {
      customer: String,
      comment: String,
      rating: Number,
    },
  ],
});

const Architect = mongoose.model("Architect", architectSchema);

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// Helper functions for EJS
app.locals.renderRating = function (rating) {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 !== 0;
  let starsHTML = "";

  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<span class="star">★</span>';
  }

  if (halfStar) {
    starsHTML += '<span class="star">½</span>';
  }

  return `<div class="rating">${starsHTML} <span>(${rating})</span></div>`;
};

app.locals.renderReviews = function (reviews) {
  let reviewsHTML = "";
  reviews.forEach((review) => {
    reviewsHTML += `
            <div class="review">
                <h4>${review.customer}</h4>
                ${this.renderRating(review.rating)}
                <p>${review.comment}</p>
            </div>
        `;
  });
  return reviewsHTML;
};

// Routes
app.get("/architects", async (req, res) => {
  try {
    const architects = await Architect.find();
    res.render("architects", { architects });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/architects/:id", async (req, res) => {
  try {
    const architects = await Architect.find();
    const selectedArchitect = await Architect.findById(req.params.id);

    if (!selectedArchitect) {
      return res.status(404).send("Architect not found");
    }

    res.render("architects", { architects, selectedArchitect });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/book-architect", (req, res) => {
  res.redirect("/architect-form");
});

app.get("/book-architect/:id", (req, res) => {
  res.redirect(`/architect-form?architectId=${req.params.id}`);
});

// Seed initial data (run once)
async function seedDatabase() {
  const count = await Architect.countDocuments();
  if (count === 0) {
    const sampleArchitects = [
      {
        name: "Krishna",
        title: "Principal Architect",
        experience: "15 years",
        image:
          "https://t4.ftcdn.net/jpg/03/64/21/11/360_F_364211147_1qgLVxv1Tcq0Ohz3FawUfrtONzz8nq3e.jpg",
        rating: 4.7,
        bio: "Krishna is an award-winning architect with expertise in sustainable design and urban development. He has worked on numerous high-profile projects across the globe.",
        specialties:
          "Sustainable design, Urban planning, Residential architecture",
        projects: [
          {
            name: "Eco Urban Center",
            location: "Guntur, Anddhra Pradesh",
            year: "2022",
            image:
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZkV3_0Ft7onHGmmLz-TZbphv7KircKuOMqw&s",
            description:
              "A LEED Platinum certified commercial complex featuring innovative green technologies and sustainable materials.",
          },
          {
            name: "Riverside Residences",
            location: "Tenkasi,Chennai",
            year: "2020",
            image:
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZkV3_0Ft7onHGmmLz-TZbphv7KircKuOMqw&s",
            description:
              "A luxury residential development that seamlessly integrates with its natural surroundings and maximizes river views.",
          },
        ],
        reviews: [
          {
            customer: "Sankar",
            comment:
              "Krishna's designs are truly innovative and sustainable. He transformed our vision into reality!",
            rating: 5,
          },
          {
            customer: "Jane Smith",
            comment:
              "Working with Krishna was a pleasure. His attention to detail is unmatched.",
            rating: 4.5,
          },
        ],
      },
      // Add all other architects here...
    ];

    await Architect.insertMany(sampleArchitects);
    console.log("Database seeded with sample architects");
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  seedDatabase();
});
