const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const ejs = require('ejs');

const app = express();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/constructionDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const bidSchema = new mongoose.Schema({
    title: String,
    client: String,
    location: String,
    budget: String,
    timeline: String,
    dueDate: Date
});

const projectSchema = new mongoose.Schema({
    title: String,
    client: String,
    location: String,
    budget: String,
    timeline: String,
    dueDate: Date
});

const timelineProjectSchema = new mongoose.Schema({
    title: String,
    client: String,
    startDate: Date,
    endDate: Date,
    progress: Number,
    daysRemaining: Number,
    status: String
});

// Create models
const Bid = mongoose.model('Bid', bidSchema);
const Project = mongoose.model('Project', projectSchema);
const TimelineProject = mongoose.model('TimelineProject', timelineProjectSchema);

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Dashboard route
app.get('/dashboard', async (req, res) => {
    try {
        // Get stats
        const stats = {
            activeProjects: 12,
            completedProjects: 8,
            monthlyRevenue: 348500
        };

        // Get new bids
        const newBids = await Bid.find().sort({ dueDate: 1 }).limit(2);
        
        // Get new projects
        const newProjects = await Project.find().sort({ dueDate: 1 }).limit(2);
        
        // Get timeline projects
        const timelineProjects = await TimelineProject.find().sort({ endDate: 1 }).limit(3);

        res.render('dashboard_company', {
            stats,
            newBids,
            newProjects,
            timelineProjects
        });
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).send('Server Error');
    }
});

// Seed initial data (for testing)
async function seedData() {
    // Check if data already exists
    const bidCount = await Bid.countDocuments();
    if (bidCount === 0) {
        await Bid.insertMany([
            {
                title: "Office Building Renovation",
                client: "TechCorp Inc.",
                location: "Downtown, Metro City",
                budget: "450,000 - 550,000",
                timeline: "4-6 months",
                dueDate: new Date("2025-03-20")
            },
            {
                title: "Residential Complex",
                client: "Metro Housing Corp.",
                location: "East Suburb, Metro City",
                budget: "1.2M - 1.5M",
                timeline: "10-12 months",
                dueDate: new Date("2025-03-25")
            }
        ]);
    }

    const projectCount = await Project.countDocuments();
    if (projectCount === 0) {
        await Project.insertMany([
            {
                title: "Industrial Warehouse Construction",
                client: "Logistics Solutions Ltd.",
                location: "Industrial Zone, Metro City",
                budget: "2.5M - 3M",
                timeline: "12-15 months",
                dueDate: new Date("2025-04-10")
            },
            {
                title: "Hospital Expansion",
                client: "HealthCare Group",
                location: "West Suburb, Metro City",
                budget: "3.5M - 4M",
                timeline: "18-24 months",
                dueDate: new Date("2025-05-15")
            }
        ]);
    }

    const timelineCount = await TimelineProject.countDocuments();
    if (timelineCount === 0) {
        await TimelineProject.insertMany([
            {
                title: "Green Valley Shopping Center",
                client: "Retail Investments Ltd.",
                startDate: new Date("2024-11-05"),
                endDate: new Date("2025-06-30"),
                progress: 45,
                daysRemaining: 138,
                status: "On Track"
            },
            {
                title: "Riverside Apartments",
                client: "City Development Group",
                startDate: new Date("2025-01-15"),
                endDate: new Date("2025-09-30"),
                progress: 20,
                daysRemaining: 203,
                status: "Delayed"
            },
            {
                title: "Corporate HQ Renovation",
                client: "Finance Solutions Inc.",
                startDate: new Date("2025-02-10"),
                endDate: new Date("2025-04-15"),
                progress: 65,
                daysRemaining: 35,
                status: "On Track"
            }
        ]);
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await seedData();
});