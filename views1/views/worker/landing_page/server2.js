require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const ejs = require('ejs');
const bodyParser = require('body-parser');

const app = express();

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/buildAndBeyond', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Schemas
const homeSchema = new mongoose.Schema({
    welcomeMessage: String,
    aboutText1: String,
    aboutText2: String
});

const userSchema = new mongoose.Schema({
    name: String,
    description: String
});

const aboutSchema = new mongoose.Schema({
    mainDescription: String,
    mission: String,
    services: [String],
    additionalInfo: String,
    testimonials: [{
        name: String,
        text: String,
        image: String
    }]
});

const contactSchema = new mongoose.Schema({
    address: String,
    phone: String,
    email: String,
    mapLink: String,
    socialMedia: {
        instagram: String
    }
});

const contactSubmissionSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    message: String,
    date: { type: Date, default: Date.now }
});

// Models
const Home = mongoose.model('Home', homeSchema);
const User = mongoose.model('User', userSchema);
const About = mongoose.model('About', aboutSchema);
const Contact = mongoose.model('Contact', contactSchema);
const ContactSubmission = mongoose.model('ContactSubmission', contactSubmissionSchema);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Default data insertion function
async function initializeData() {
    try {
        // Check if data already exists
        const homeCount = await Home.countDocuments();
        if (homeCount === 0) {
            await Home.create({
                welcomeMessage: "Your one-stop platform for finding skilled professionals...",
                aboutText1: "At Build & Beyond, we are dedicated to connecting homeowners...",
                aboutText2: "Our mission is to simplify the process of finding reliable..."
            });
        }

        const userCount = await User.countDocuments();
        if (userCount === 0) {
            await User.insertMany([
                { name: "Admin", description: "Oversees website insights and app revenue..." },
                { name: "Customer", description: "Selects and hires professionals..." },
                { name: "Professional", description: "Offers specialized services..." }
            ]);
        }

        const aboutCount = await About.countDocuments();
        if (aboutCount === 0) {
            await About.create({
                mainDescription: "At Build & Beyond, we are committed to helping individuals...",
                mission: "Our mission is to simplify the construction process...",
                services: [
                    "🏗 End-to-end construction services",
                    "🏢 Professional architects, interior designers, and engineers",
                    "🔧 Access to high-quality construction materials"
                ],
                additionalInfo: "Our team consists of passionate professionals...",
                testimonials: [
                    {
                        name: "John Doe",
                        text: "Build & Beyond provided me with everything I needed...",
                        image: "https://example.com/john.jpg"
                    },
                    {
                        name: "Jane Smith",
                        text: "I was able to find a reliable architect...",
                        image: "https://example.com/jane.jpg"
                    }
                ]
            });
        }

        const contactCount = await Contact.countDocuments();
        if (contactCount === 0) {
            await Contact.create({
                address: "IIIT Sri City, Chittor",
                phone: "+91 8186790891",
                email: "queries@Build&Beyond.com",
                mapLink: "https://maps.google.com/?q=IIIT+Sri+City,Chittor",
                socialMedia: {
                    instagram: "https://www.instagram.com/buildandbeyond/"
                }
            });
        }
    } catch (err) {
        console.error('Error initializing data:', err);
    }
}

// Initialize data on startup
initializeData();

// Routes
app.get('/', async (req, res) => {
    try {
        const homeData = await Home.findOne();
        const contactData = await Contact.findOne();
        res.render('index', {
            page: 'home',
            homeData: homeData || {},
            contactData: contactData || {},
            footerServices: [
                "Home Renovation",
                "Repairs & Maintenance",
                "Interior Design",
                "Landscaping",
                "Custom Projects"
            ]
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        const contactData = await Contact.findOne();
        res.render('index', {
            page: 'users',
            users: users || [],
            contactData: contactData || {},
            footerServices: [
                "Home Renovation",
                "Repairs & Maintenance",
                "Interior Design",
                "Landscaping",
                "Custom Projects"
            ]
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.get('/about', async (req, res) => {
    try {
        const aboutData = await About.findOne();
        const contactData = await Contact.findOne();
        res.render('index', {
            page: 'about',
            aboutData: aboutData || {},
            contactData: contactData || {},
            footerServices: [
                "Home Renovation",
                "Repairs & Maintenance",
                "Interior Design",
                "Landscaping",
                "Custom Projects"
            ]
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.get('/contact', async (req, res) => {
    try {
        const contactData = await Contact.findOne();
        res.render('index', {
            page: 'contact',
            contactData: contactData || {},
            footerServices: [
                "Home Renovation",
                "Repairs & Maintenance",
                "Interior Design",
                "Landscaping",
                "Custom Projects"
            ]
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.post('/contact', async (req, res) => {
    try {
        const { firstName, lastName, email, message } = req.body;
        await ContactSubmission.create({ firstName, lastName, email, message });
        res.redirect('/contact?success=true');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error submitting form');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});