const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/constructionPortal', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Schemas
const workerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    title: String,
    profileImage: String,
    bio: String,
    specialties: [String],
    rating: { type: Number, default: 0 },
    projects: [{
        name: String,
        year: Number,
        location: String,
        image: String,
        description: String
    }],
    stats: {
        applications: { type: Number, default: 0 },
        offers: { type: Number, default: 0 },
        experience: { type: Number, default: 0 }
    }
});

const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: String,
    size: String,
    projectTypes: [String],
    positions: [String],
    tags: [{
        name: String,
        color: String
    }],
    createdAt: { type: Date, default: Date.now }
});

const offerSchema = new mongoose.Schema({
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    companyName: String,
    position: String,
    location: String,
    salaryRange: String,
    expiryDate: Date,
    daysRemaining: Number,
    status: { type: String, enum: ['current', 'expired', 'declined'], default: 'current' },
    statusReason: String,
    date: { type: Date, default: Date.now }
});

const Worker = mongoose.model('Worker', workerSchema);
const Company = mongoose.model('Company', companySchema);
const Offer = mongoose.model('Offer', offerSchema);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Authentication middleware (simplified)
const requireAuth = (req, res, next) => {
    // In a real app, you would check session or JWT
    next();
};

// Routes
app.get('/worker-profile', requireAuth, async (req, res) => {
    try {
        // In a real app, you would get the worker ID from the session
        const workerId = '65d5f8a9b4c9b8c1f4e8f7d2'; // Example hardcoded ID
        
        const worker = await Worker.findById(workerId);
        if (!worker) {
            return res.status(404).send('Worker not found');
        }
        
        // Add rating display
        worker.ratingDisplay = '★'.repeat(Math.floor(worker.rating)) + '☆'.repeat(5 - Math.floor(worker.rating)) + ` (${worker.rating.toFixed(1)})`;
        
        const companies = await Company.find();
        const currentOffers = await Offer.find({ 
            workerId: worker._id, 
            status: 'current' 
        });
        
        const pastOffers = await Offer.find({ 
            workerId: worker._id, 
            status: { $in: ['expired', 'declined'] } 
        }).sort({ date: -1 });
        
        res.render('worker_profile', {
            worker,
            stats: worker.stats,
            companies,
            currentOffers,
            pastOffers
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// API Endpoints
app.post('/api/apply', requireAuth, async (req, res) => {
    try {
        const { companyId } = req.body;
        const company = await Company.findById(companyId);
        
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }
        
        // In a real app, you would create an application record
        res.json({ 
            success: true, 
            message: 'Application submitted',
            companyName: company.name
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.post('/api/offers/:id/accept', requireAuth, async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(
            req.params.id,
            { status: 'accepted' },
            { new: true }
        );
        
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        
        // In a real app, you would update the worker's status
        res.json({ success: true, message: 'Offer accepted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.post('/api/offers/:id/decline', requireAuth, async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(
            req.params.id,
            { 
                status: 'declined',
                statusReason: req.body.reason || 'No reason provided'
            },
            { new: true }
        );
        
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        
        res.json({ success: true, message: 'Offer declined' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Seed initial data
async function seedDatabase() {
    try {
        // Check if worker exists
        const workerCount = await Worker.countDocuments();
        if (workerCount === 0) {
            await Worker.create({
                userId: new mongoose.Types.ObjectId(),
                name: 'Avinash',
                title: 'Principal Architect with 15 years experience',
                profileImage: 'https://t4.ftcdn.net/jpg/03/64/21/11/360_F_364211147_1qgLVxv1Tcq0Ohz3FawUfrtONzz8nq3e.jpg',
                bio: 'Avinash is an award-winning architect with expertise in sustainable design and urban development. He has worked on numerous high-profile projects across the globe.',
                specialties: ['Sustainable design', 'Urban planning', 'Residential architecture'],
                rating: 4.7,
                projects: [
                    {
                        name: 'Eco Urban Center',
                        year: 2022,
                        location: 'Delhi',
                        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZkV3_0Ft7onHGmmLz-TZbphv7KircKuOMqw&s',
                        description: 'A LEED Platinum certified commercial complex featuring innovative green technologies and sustainable materials.'
                    },
                    {
                        name: 'Riverside Residences',
                        year: 2020,
                        location: 'Chennai',
                        image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQC7-RFA1xE4wTSP0DZJSJ1AJ8TitBYtkmEYA&s',
                        description: 'A luxury residential development that seamlessly integrates with its natural surroundings and maximizes river views.'
                    }
                ],
                stats: {
                    applications: 12,
                    offers: 5,
                    experience: 8
                }
            });
        }

        // Check if companies exist
        const companyCount = await Company.countDocuments();
        if (companyCount === 0) {
            await Company.insertMany([
                {
                    name: 'Modern Structures Inc.',
                    location: 'Chennai',
                    size: 'Medium (50-200 employees)',
                    projectTypes: ['Commercial', 'Residential High-rise', 'Urban Development'],
                    positions: ['Senior Architects', 'Project Managers'],
                    tags: [
                        { name: 'Sustainable Design', color: 'green' },
                        { name: 'BIM Expertise', color: 'blue' },
                        { name: 'LEED Projects', color: 'orange' }
                    ]
                },
                {
                    name: 'Skyline Builders Group',
                    location: 'Delhi',
                    size: 'Large (500+ employees)',
                    projectTypes: ['Skyscrapers', 'Public Buildings', 'International Projects'],
                    positions: ['Design Architects', 'Technical Directors'],
                    tags: [
                        { name: 'Green Architecture', color: 'green' },
                        { name: 'Parametric Design', color: 'blue' },
                        { name: 'International Projects', color: 'orange' }
                    ]
                }
            ]);
        }

        console.log('Database seeded successfully');
    } catch (err) {
        console.error('Database seeding error:', err);
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    seedDatabase();
});