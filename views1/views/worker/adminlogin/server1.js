const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const ejs = require('ejs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Configure EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set secure: true in production with HTTPS
}));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/adminDashboard', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Admin Schema
const adminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    passKey: { type: String, required: true },
    resetToken: String,
    resetTokenExpiry: Date,
    createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);

// Routes
app.get('/', (req, res) => {
    res.render('login', {
        title: 'Admin Login',
        subtitle: 'Enter your details to access the dashboard',
        messages: {},
        formData: {}
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Admin Login',
        subtitle: 'Enter your details to access the dashboard',
        messages: {},
        formData: {}
    });
});

app.post('/admin-login', async (req, res) => {
    const { email, password, passKey, rememberMe } = req.body;
    
    try {
        const admin = await Admin.findOne({ email });
        
        if (!admin) {
            return res.render('login', {
                title: 'Admin Login',
                subtitle: 'Enter your details to access the dashboard',
                messages: { error: 'Invalid email or password' },
                formData: { email, rememberMe }
            });
        }
        
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        const isPassKeyValid = passKey === admin.passKey;
        
        if (!isPasswordValid || !isPassKeyValid) {
            return res.render('login', {
                title: 'Admin Login',
                subtitle: 'Enter your details to access the dashboard',
                messages: { error: 'Invalid email, password, or pass key' },
                formData: { email, rememberMe }
            });
        }
        
        // Set session
        req.session.adminId = admin._id;
        req.session.isAuthenticated = true;
        
        // Set cookie if remember me is checked
        if (rememberMe) {
            res.cookie('rememberAdmin', admin._id.toString(), { 
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true
            });
        }
        
        // Redirect to dashboard
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            title: 'Admin Login',
            subtitle: 'Enter your details to access the dashboard',
            messages: { error: 'An error occurred during login' },
            formData: { email, rememberMe }
        });
    }
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    try {
        const admin = await Admin.findOne({ email });
        
        if (!admin) {
            return res.json({ success: false, message: 'If this email exists, a reset link has been sent' });
        }
        
        // Generate reset token
        const resetToken = uuidv4();
        const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
        
        admin.resetToken = resetToken;
        admin.resetTokenExpiry = resetTokenExpiry;
        await admin.save();
        
        // In a real app, you would send an email with the reset link
        console.log(`Password reset link: http://localhost:3000/reset-password/${resetToken}`);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.json({ success: false, message: 'An error occurred' });
    }
});

// Dashboard route (protected)
app.get('/dashboard', (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login');
    }
    
    res.send('Welcome to the dashboard!');
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.clearCookie('rememberAdmin');
        res.redirect('/login');
    });
});

// Create initial admin (for testing)
async function createInitialAdmin() {
    try {
        const existingAdmin = await Admin.findOne({ email: 'admin@example.com' });
        
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            const admin = new Admin({
                email: 'admin@example.com',
                password: hashedPassword,
                passKey: 'secret123'
            });
            
            await admin.save();
            console.log('Initial admin created');
        }
    } catch (error) {
        console.error('Error creating initial admin:', error);
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    createInitialAdmin();
});