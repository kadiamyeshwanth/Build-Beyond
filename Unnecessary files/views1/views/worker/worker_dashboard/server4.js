require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/buildAndBeyond', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Schemas
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['worker', 'company', 'admin'], default: 'worker' },
    specialization: String,
    experience: Number,
    createdAt: { type: Date, default: Date.now }
});

const offerSchema = new mongoose.Schema({
    company: String,
    location: String,
    description: String,
    position: String,
    salary: String,
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

const companySchema = new mongoose.Schema({
    name: String,
    location: String,
    description: String,
    industry: String,
    size: String,
    hiring: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

const jobSchema = new mongoose.Schema({
    title: String,
    location: String,
    description: String,
    timeline: String,
    budget: String,
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Create Models
const User = mongoose.model('User', userSchema);
const Offer = mongoose.model('Offer', offerSchema);
const Company = mongoose.model('Company', companySchema);
const Job = mongoose.model('Job', jobSchema);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// Routes
app.get('/worker/dashboard', isAuthenticated, async (req, res) => {
    try {
        // Get user data
        const user = await User.findById(req.session.userId);
        
        // Get offers for this worker
        const offers = await Offer.find({ workerId: req.session.userId }).limit(3);
        
        // Get companies that are hiring
        const companies = await Company.find({ hiring: true }).limit(3);
        
        // Get recent jobs
        const jobs = await Job.find().sort({ createdAt: -1 }).limit(2);
        
        res.render('worker_dashboard', {
            user,
            offers,
            companies,
            jobs
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Seed Initial Data (for testing)
async function seedData() {
    // Check if data already exists
    const count = await User.countDocuments();
    if (count === 0) {
        // Create a sample worker
        const worker = await User.create({
            name: 'John Builder',
            email: 'john@example.com',
            password: 'hashedpassword', // In real app, hash this
            role: 'worker',
            specialization: 'Architect',
            experience: 5
        });

        // Create sample offers
        await Offer.create([
            {
                company: 'Metropolitan Builders',
                location: 'Mumbai',
                description: "We're impressed with your portfolio and would like to offer you a position as Senior Architect on our high-rise development team.",
                position: 'Senior Architect',
                salary: '₹95K - ₹120K',
                workerId: worker._id
            },
            {
                company: 'Reliable Infrastructure Inc.',
                location: 'Chennai',
                description: "Your civil engineering experience is exactly what we're looking for. We'd like to discuss a Architect Designer position with you.",
                position: 'Architect Designer',
                salary: '₹85K - ₹105K',
                workerId: worker._id
            }
        ]);

        // Create sample companies
        await Company.create([
            {
                name: 'Skyline Developments',
                location: 'Mumbai',
                description: 'Leading commercial construction company focused on high-rise office buildings and mixed-use developments.',
                industry: 'Commercial Construction',
                size: '500+ employees'
            },
            {
                name: 'Premier Renovations',
                location: 'Chennai',
                description: 'Boutique renovation company specializing in historic building restoration and luxury home remodeling projects.',
                industry: 'Residential Renovation',
                size: '20-50 employees'
            }
        ]);

        // Create sample jobs
        await Job.create([
            {
                title: 'Guest house',
                location: 'Rajyalakshmi Nagar, Guntur',
                description: 'Need you to build an house plan for a land of 700sft which contains a living room,2bedrooms,2bathrooms and a bit of open place.',
                timeline: '2-weeks',
                budget: '₹10k',
                postedBy: worker._id
            },
            {
                title: 'Dream house',
                location: 'Krishna Nagar, Vijayawada',
                description: 'I want you to design a plan for a bungalow with 1500sft which contains a large swimming pool, large garden area etc.',
                timeline: '2 weeks',
                budget: '₹20k',
                postedBy: worker._id
            }
        ]);

        console.log('Sample data seeded successfully');
    }
}

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await seedData();
});