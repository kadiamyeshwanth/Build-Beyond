const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const ejs = require('ejs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/constructionPortal', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    address: String,
    bio: String,
    role: { type: String, default: 'worker' },
    createdAt: { type: Date, default: Date.now }
});

// Invoice Schema
const invoiceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invoiceNumber: { type: String, required: true },
    date: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'pending', 'cancelled'], default: 'pending' },
    filePath: String
});

// FAQ Schema
const faqSchema = new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'general' }
});

const User = mongoose.model('User', userSchema);
const Invoice = mongoose.model('Invoice', invoiceSchema);
const FAQ = mongoose.model('FAQ', faqSchema);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

// Routes
app.get('/account-settings', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        const invoices = await Invoice.find({ userId: req.session.userId }).sort({ date: -1 });
        const faqs = await FAQ.find({ category: 'worker' });

        res.render('account_settings', {
            user,
            invoices,
            faqs
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Update profile
app.post('/profile/update', requireAuth, async (req, res) => {
    try {
        const { name, email, phone, address, bio } = req.body;
        
        const updatedUser = await User.findByIdAndUpdate(
            req.session.userId,
            { name, email, phone, address, bio },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Change password
app.post('/profile/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }

        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Download invoice
app.get('/invoices/download/:id', requireAuth, async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            _id: req.params.id,
            userId: req.session.userId
        });

        if (!invoice || !invoice.filePath) {
            return res.status(404).send('Invoice not found');
        }

        res.download(invoice.filePath);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Seed initial data (run once)
async function seedDatabase() {
    try {
        // Check if admin exists
        const adminCount = await User.countDocuments({ email: 'admin@example.com' });
        if (adminCount === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                name: 'Admin',
                email: 'admin@example.com',
                password: hashedPassword,
                role: 'admin'
            });
        }

        // Check if test worker exists
        const workerCount = await User.countDocuments({ email: 'worker@example.com' });
        if (workerCount === 0) {
            const hashedPassword = await bcrypt.hash('worker123', 10);
            await User.create({
                name: 'Test Worker',
                email: 'worker@example.com',
                password: hashedPassword,
                phone: '7885634429',
                address: 'Avenue Road, Meerut',
                bio: 'Professional construction worker with 10 years of experience',
                role: 'worker'
            });
        }

        // Check if FAQs exist
        const faqCount = await FAQ.countDocuments();
        if (faqCount === 0) {
            await FAQ.insertMany([
                {
                    question: "How do I create a new project?",
                    answer: "Go to the Dashboard and click on the 'New Project' button in the top right corner.",
                    category: "worker"
                },
                {
                    question: "How do I invite team members?",
                    answer: "Navigate to your project, click on 'Team' tab, and use the 'Invite Member' button.",
                    category: "worker"
                },
                {
                    question: "How can I track my project's budget?",
                    answer: "Use the 'Finances' tab within your project to track expenses and compare with your budget.",
                    category: "worker"
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