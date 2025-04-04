require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/buildAndBeyond', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    role: { type: String, required: true, enum: ['customer', 'company', 'worker', 'admin'] },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // Customer fields
    name: String,
    dob: Date,
    phone: String,
    
    // Company fields
    companyName: String,
    contactPerson: String,
    companyDocuments: [String],
    
    // Worker fields
    aadharNumber: String,
    specialization: String,
    experience: Number,
    workerDocuments: [String],
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

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

// Configure EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/');
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session.userId && req.session.role === 'admin') {
        return next();
    }
    res.status(403).send('Access denied');
};

// Routes
app.get('/', async (req, res) => {
    try {
        // Check if user is already logged in
        if (req.session.userId) {
            switch (req.session.role) {
                case 'customer':
                    return res.redirect('/customer/dashboard');
                case 'company':
                    return res.redirect('/company/dashboard');
                case 'worker':
                    return res.redirect('/worker/dashboard');
                case 'admin':
                    return res.redirect('/admin/dashboard');
                default:
                    return res.redirect('/');
            }
        }

        // Render the auth page with dynamic data
        res.render('auth', {
            isAdmin: false, // Set to true if you want to show admin link
            userTypes: [
                { value: 'customer', label: 'Customer' },
                { value: 'company', label: 'Company' },
                { value: 'worker', label: 'Professional' }
            ],
            specializations: [
                { value: 'architect', label: 'Architect' },
                { value: 'interiordesign', label: 'Interior Design' }
                // Add more specializations as needed
            ],
            loginFormData: {},
            registerFormData: {},
            loginError: null,
            registerError: null
        });
    } catch (err) {
        console.error('Error rendering auth page:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Login route
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('auth', {
                isAdmin: false,
                userTypes: [],
                specializations: [],
                loginFormData: { email },
                registerFormData: {},
                loginError: 'Invalid email or password',
                registerError: null
            });
        }
        
        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('auth', {
                isAdmin: false,
                userTypes: [],
                specializations: [],
                loginFormData: { email },
                registerFormData: {},
                loginError: 'Invalid email or password',
                registerError: null
            });
        }
        
        // Set session
        req.session.userId = user._id;
        req.session.role = user.role;
        
        // Redirect based on role
        switch (user.role) {
            case 'customer':
                return res.redirect('/customer/dashboard');
            case 'company':
                return res.redirect('/company/dashboard');
            case 'worker':
                return res.redirect('/worker/dashboard');
            case 'admin':
                return res.redirect('/admin/dashboard');
            default:
                return res.redirect('/');
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Registration route
app.post('/signup', upload.any(), async (req, res) => {
    try {
        const { role, email, password, confirmPassword, termsAccepted, ...otherFields } = req.body;
        const files = req.files || [];
        
        // Basic validation
        if (password !== confirmPassword) {
            return res.render('auth', {
                isAdmin: false,
                userTypes: [],
                specializations: [],
                loginFormData: {},
                registerFormData: { ...req.body, role },
                loginError: null,
                registerError: 'Passwords do not match'
            });
        }
        
        if (!termsAccepted) {
            return res.render('auth', {
                isAdmin: false,
                userTypes: [],
                specializations: [],
                loginFormData: {},
                registerFormData: { ...req.body, role },
                loginError: null,
                registerError: 'You must accept the terms and conditions'
            });
        }
        
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('auth', {
                isAdmin: false,
                userTypes: [],
                specializations: [],
                loginFormData: {},
                registerFormData: { ...req.body, role },
                loginError: null,
                registerError: 'Email already in use'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Prepare user data based on role
        let userData = {
            role,
            email,
            password: hashedPassword
        };
        
        if (role === 'customer') {
            userData = {
                ...userData,
                name: otherFields['customer-name'],
                dob: otherFields['customer-dob'],
                phone: otherFields['customer-phone']
            };
        } else if (role === 'company') {
            const companyDocs = files.filter(f => f.fieldname === 'company-documents').map(f => f.filename);
            userData = {
                ...userData,
                companyName: otherFields['company-name'],
                contactPerson: otherFields['contact-person'],
                phone: otherFields['company-phone'],
                companyDocuments: companyDocs
            };
        } else if (role === 'worker') {
            const workerDocs = files.filter(f => f.fieldname === 'worker-documents').map(f => f.filename);
            userData = {
                ...userData,
                name: otherFields['worker-name'],
                dob: otherFields['worker-dob'],
                phone: otherFields['worker-phone'],
                aadharNumber: otherFields['aadhar-number'],
                specialization: otherFields['specialization'],
                experience: otherFields['experience'],
                workerDocuments: workerDocs
            };
        }
        
        // Create new user
        const newUser = new User(userData);
        await newUser.save();
        
        // Set session
        req.session.userId = newUser._id;
        req.session.role = newUser.role;
        
        // Redirect based on role
        switch (newUser.role) {
            case 'customer':
                return res.redirect('/customer/dashboard');
            case 'company':
                return res.redirect('/company/dashboard');
            case 'worker':
                return res.redirect('/worker/dashboard');
            default:
                return res.redirect('/');
        }
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Error logging out');
        }
        res.redirect('/');
    });
});

// Protected routes (example)
app.get('/customer/dashboard', isAuthenticated, (req, res) => {
    if (req.session.role !== 'customer') {
        return res.redirect('/');
    }
    res.send('Customer Dashboard');
});

app.get('/company/dashboard', isAuthenticated, (req, res) => {
    if (req.session.role !== 'company') {
        return res.redirect('/');
    }
    res.send('Company Dashboard');
});

app.get('/worker/dashboard', isAuthenticated, (req, res) => {
    if (req.session.role !== 'worker') {
        return res.redirect('/');
    }
    res.send('Worker Dashboard');
});

app.get('/admin/dashboard', isAdmin, (req, res) => {
    res.send('Admin Dashboard');
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});