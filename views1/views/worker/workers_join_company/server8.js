const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const path = require('path');

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/architectPortal', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Schemas
const companySchema = new mongoose.Schema({
    id: String,
    name: String,
    location: String,
    size: String,
    founded: String,
    projectTypes: [String],
    lookingFor: [String],
    tags: [{ name: String, class: String }],
    logo: String,
    description: String,
    benefits: [String],
    status: { type: String, default: 'active' }
});

const applicationSchema = new mongoose.Schema({
    userId: String,
    companyId: String,
    companyName: String,
    position: String,
    location: String,
    salaryRange: String,
    applicationDate: String,
    specializations: [String],
    status: { type: String, default: 'pending' } // pending, accepted, declined
});

const offerSchema = new mongoose.Schema({
    userId: String,
    companyId: String,
    companyName: String,
    position: String,
    location: String,
    salaryRange: String,
    expires: String,
    status: { type: String, default: 'pending' }, // pending, accepted, declined, expired
    date: String
});

const userSchema = new mongoose.Schema({
    name: String,
    profileImage: String,
    title: String,
    applicationsCount: Number,
    offersCount: Number,
    experienceYears: Number
});

const Company = mongoose.model('Company', companySchema);
const Application = mongoose.model('Application', applicationSchema);
const Offer = mongoose.model('Offer', offerSchema);
const User = mongoose.model('User', userSchema);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/workerjoin_company', async (req, res) => {
    try {
        const companies = await Company.find({ status: 'active' });
        const applications = await Application.find({ userId: 'user123' }); // Replace with actual user ID
        const offers = await Offer.find({ userId: 'user123', status: 'pending' });
        const pastOffers = await Offer.find({ userId: 'user123', status: { $in: ['declined', 'expired'] } });
        const user = await User.findOne({ _id: 'user123' }); // Replace with actual user ID

        res.render('join_company', {
            user: user || {
                name: 'Avinash',
                profileImage: 'https://t4.ftcdn.net/jpg/03/64/21/11/360_F_364211147_1qgLVxv1Tcq0Ohz3FawUfrtONzz8nq3e.jpg',
                title: 'Principal Architect with 15 years experience',
                applicationsCount: 12,
                offersCount: 5,
                experienceYears: 8
            },
            companies,
            applications,
            offers,
            pastOffers
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/companies/:id/apply', async (req, res) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        const application = new Application({
            userId: 'user123', // Replace with actual user ID
            companyId: req.params.id,
            companyName: company.name,
            position: req.body.position || company.lookingFor[0],
            location: company.location,
            salaryRange: req.body.salaryRange || 'Negotiable',
            applicationDate: new Date().toISOString().split('T')[0],
            specializations: req.body.specializations || company.projectTypes,
            status: 'pending'
        });

        await application.save();
        res.json({ success: true, message: 'Application submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.post('/offers/:id/accept', async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(req.params.id, 
            { status: 'accepted' }, 
            { new: true }
        );
        
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        
        res.json({ success: true, message: 'Offer accepted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

app.post('/offers/:id/decline', async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(req.params.id, 
            { status: 'declined' }, 
            { new: true }
        );
        
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        
        res.json({ success: true, message: 'Offer declined successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Seed initial data
async function seedDatabase() {
    const companyCount = await Company.countDocuments();
    if (companyCount === 0) {
        const initialCompanies = [
            {
                id: 'modern-structures',
                name: 'Modern Structures Inc.',
                location: 'Chennai, Tamil Nadu',
                size: 'Medium (50-200 employees)',
                founded: '2005',
                projectTypes: ['Commercial', 'Residential High-rise', 'Urban Development'],
                lookingFor: ['Senior Architects', 'Project Managers'],
                tags: [
                    { name: 'Sustainable Design', class: 'badge-green' },
                    { name: 'BIM Expertise', class: 'badge-blue' },
                    { name: 'LEED Projects', class: 'badge-orange' }
                ],
                logo: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-1.2.1&auto=format&fit=crop&w=120&h=120',
                description: 'Modern Structures Inc. is a leading architectural firm specializing in innovative commercial and residential high-rise designs...',
                benefits: [
                    'Competitive salary with performance bonuses',
                    'Comprehensive health insurance and retirement plans',
                    'Continuing education and professional development opportunities',
                    'Collaborative work environment with cutting-edge technology',
                    'Opportunity to work on high-profile, innovative projects',
                    'Flexible work arrangements including remote options'
                ]
            },
            // Add other companies similarly
        ];

        await Company.insertMany(initialCompanies);
        console.log('Companies seeded');
    }

    const userCount = await User.countDocuments();
    if (userCount === 0) {
        const initialUser = {
            _id: 'user123',
            name: 'Avinash',
            profileImage: 'https://t4.ftcdn.net/jpg/03/64/21/11/360_F_364211147_1qgLVxv1Tcq0Ohz3FawUfrtONzz8nq3e.jpg',
            title: 'Principal Architect with 15 years experience',
            applicationsCount: 12,
            offersCount: 5,
            experienceYears: 8
        };

        await User.create(initialUser);
        console.log('User seeded');
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    seedDatabase();
});