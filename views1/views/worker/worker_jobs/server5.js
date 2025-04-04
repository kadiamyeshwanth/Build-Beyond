const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const path = require('path');

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/jobPortal', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Job Schema
const jobSchema = new mongoose.Schema({
    title: String,
    type: String,
    budget: String,
    summary: String,
    customerDetails: {
        fullName: String,
        contactNumber: String,
        email: String,
        address: {
            street: String,
            city: String,
            state: String,
            zipCode: String
        }
    },
    plotInfo: {
        location: String,
        size: String,
        orientation: String,
        floors: String,
        roomRequirements: String,
        specialFeatures: String,
        preferredStyle: String
    },
    preferredCompletionDate: String,
    referenceImages: [String],
    status: { type: String, default: 'available' }, // available, accepted, denied
    createdAt: { type: Date, default: Date.now }
});

const Job = mongoose.model('Job', jobSchema);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', async (req, res) => {
    try {
        const jobOffers = await Job.find({ status: 'available' });
        res.render('job_dashboard', { jobOffers });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/jobs/:id/accept', async (req, res) => {
    try {
        const job = await Job.findByIdAndUpdate(req.params.id, 
            { status: 'accepted' }, 
            { new: true }
        );
        
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }
        
        res.json({ success: true, message: 'Job accepted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.post('/jobs/:id/deny', async (req, res) => {
    try {
        const job = await Job.findByIdAndUpdate(req.params.id, 
            { status: 'denied' }, 
            { new: true }
        );
        
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }
        
        res.json({ success: true, message: 'Job denied successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Seed initial data (run once)
async function seedDatabase() {
    const count = await Job.countDocuments();
    if (count === 0) {
        const initialJobs = [
            {
                title: "Modern Hillside Residence",
                type: "residential",
                budget: "₹5k - ₹10k",
                summary: "Design a contemporary 3-bedroom home with panoramic views, sustainable features, and indoor-outdoor living spaces.",
                customerDetails: {
                    fullName: "Krishna",
                    contactNumber: "123456789",
                    email: "krishna@gmail.com",
                    address: {
                        street: "425 Highland Drive",
                        city: "Ooty",
                        state: "Tamil Nadu",
                        zipCode: "643001"
                    }
                },
                plotInfo: {
                    location: "785 Vista Way, Ooty, Tamil Nadu 643001",
                    size: "8,500 sq.ft",
                    orientation: "South-West",
                    floors: 2,
                    roomRequirements: "3 bedrooms, 2.5 baths, home office, open concept kitchen/living",
                    specialFeatures: "Infinity pool, rooftop terrace, solar panels, electric vehicle charging station",
                    preferredStyle: "Modern"
                },
                preferredCompletionDate: "June 15, 2025",
                referenceImages: [
                    "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&q=80&w=2346&ixlib=rb-4.0.3",
                    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2075&ixlib=rb-4.0.3",
                    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=2053&ixlib=rb-4.0.3"
                ]
            },
            // Add all other job objects from your original data here
            // ...
        ];
        
        await Job.insertMany(initialJobs);
        console.log('Database seeded with initial data');
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    seedDatabase();
});