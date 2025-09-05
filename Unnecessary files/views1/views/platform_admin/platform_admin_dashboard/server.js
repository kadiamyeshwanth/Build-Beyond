const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const ejs = require('ejs');

// Initialize Express app
const app = express();

// Configure EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/adminDashboard', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Mongoose Schemas and Models
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    type: String, // 'company', 'customer', 'worker'
    avatar: String,
    contactPerson: String,
    company: String,
    specialization: String,
    projects: Number,
    revenue: Number,
    totalSpent: Number,
    totalEarned: Number,
    createdAt: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
    name: String,
    customerName: String,
    providerName: String,
    customerEmail: String,
    companyEmail: String,
    receivedMoney: Number,
    pendingMoney: Number,
    status: String, // 'active', 'completed', 'pending'
    createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
    paymentId: String,
    projectName: String,
    customerName: String,
    recipientName: String,
    amount: Number,
    commission: Number,
    received: Number,
    status: String, // 'completed', 'pending', 'failed'
    date: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
    senderName: String,
    senderType: String, // 'company', 'customer', 'worker'
    avatar: String,
    preview: String,
    read: Boolean,
    time: { type: Date, default: Date.now }
});

const settingSchema = new mongoose.Schema({
    platformName: String,
    platformEmail: String,
    supportContact: String,
    timezone: String,
    maintenanceMode: Boolean,
    commissionRate: Number,
    paymentProcessor: String,
    apiKey: String,
    paymentMethods: [String],
    autoPayout: Boolean,
    payoutSchedule: String,
    lastUpdated: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Message = mongoose.model('Message', messageSchema);
const Setting = mongoose.model('Setting', settingSchema);

// Helper function to generate sample data
async function generateSampleData() {
    // Check if data already exists
    const userCount = await User.countDocuments();
    if (userCount === 0) {
        // Create sample users
        const sampleUsers = [
            { name: 'ABC Constructions', email: 'abc@example.com', phone: '9876543210', type: 'company', contactPerson: 'Ramesh Kumar', projects: 12, revenue: 1250000 },
            { name: 'XYZ Builders', email: 'xyz@example.com', phone: '8765432109', type: 'company', contactPerson: 'Suresh Patel', projects: 8, revenue: 980000 },
            { name: 'Rajesh Sharma', email: 'rajesh@example.com', phone: '7654321098', type: 'customer', company: 'Tech Solutions', projects: 3, totalSpent: 450000 },
            { name: 'Priya Singh', email: 'priya@example.com', phone: '6543210987', type: 'customer', company: 'Design Studio', projects: 5, totalSpent: 320000 },
            { name: 'Amit Kumar', email: 'amit@example.com', phone: '9432109876', type: 'worker', specialization: 'Plumbing', projects: 7, totalEarned: 280000 },
            { name: 'Sunita Devi', email: 'sunita@example.com', phone: '8321098765', type: 'worker', specialization: 'Electrical', projects: 9, totalEarned: 310000 }
        ];
        await User.insertMany(sampleUsers);

        // Create sample projects
        const sampleProjects = [
            { name: 'Office Renovation', customerName: 'Rajesh Sharma', providerName: 'ABC Constructions', customerEmail: 'rajesh@example.com', companyEmail: 'abc@example.com', receivedMoney: 150000, pendingMoney: 50000, status: 'active' },
            { name: 'House Construction', customerName: 'Priya Singh', providerName: 'XYZ Builders', customerEmail: 'priya@example.com', companyEmail: 'xyz@example.com', receivedMoney: 200000, pendingMoney: 0, status: 'completed' },
            { name: 'Bathroom Remodel', customerName: 'Rajesh Sharma', providerName: 'Amit Kumar', customerEmail: 'rajesh@example.com', companyEmail: 'amit@example.com', receivedMoney: 75000, pendingMoney: 25000, status: 'pending' }
        ];
        await Project.insertMany(sampleProjects);

        // Create sample payments
        const samplePayments = [
            { paymentId: 'PAY001', projectName: 'Office Renovation', customerName: 'Rajesh Sharma', recipientName: 'ABC Constructions', amount: 200000, commission: 20000, received: 180000, status: 'completed' },
            { paymentId: 'PAY002', projectName: 'House Construction', customerName: 'Priya Singh', recipientName: 'XYZ Builders', amount: 150000, commission: 15000, received: 135000, status: 'completed' },
            { paymentId: 'PAY003', projectName: 'Bathroom Remodel', customerName: 'Rajesh Sharma', recipientName: 'Amit Kumar', amount: 100000, commission: 10000, received: 0, status: 'pending' }
        ];
        await Payment.insertMany(samplePayments);

        // Create sample messages
        const sampleMessages = [
            { senderName: 'Rajesh Sharma', senderType: 'customer', preview: 'Regarding the project timeline...', read: false },
            { senderName: 'ABC Constructions', senderType: 'company', preview: 'Payment received for project...', read: true },
            { senderName: 'Amit Kumar', senderType: 'worker', preview: 'Need clarification on the design...', read: false }
        ];
        await Message.insertMany(sampleMessages);

        // Create default settings
        const defaultSettings = new Setting({
            platformName: 'ConstructPro Admin',
            platformEmail: 'admin@constructpro.com',
            supportContact: '1800-123-4567',
            timezone: 'UTC+5:30',
            maintenanceMode: false,
            commissionRate: 10,
            paymentProcessor: 'stripe',
            apiKey: 'sk_test_1234567890',
            paymentMethods: ['credit', 'debit', 'bank'],
            autoPayout: true,
            payoutSchedule: 'weekly'
        });
        await defaultSettings.save();

        console.log('Sample data generated successfully');
    }
}

// Generate sample data on startup
generateSampleData().catch(err => console.error('Error generating sample data:', err));

// Route Handlers
app.get('/admin/:section?', async (req, res) => {
    try {
        const section = req.params.section || 'dashboard';
        const tab = req.query.tab || (section === 'users' ? 'companies' : 
                                    section === 'projects' ? 'active' : 
                                    section === 'settings' ? 'general' : '');

        // Fetch data from MongoDB based on the section
        let data = {
            platformName: 'ConstructPro Admin',
            activeSection: section,
            activeUserTab: section === 'users' ? tab : '',
            activeProjectTab: section === 'projects' ? tab : '',
            activeSettingsTab: section === 'settings' ? tab : ''
        };

        if (section === 'dashboard') {
            const users = await User.countDocuments();
            const messages = await Message.countDocuments({ read: false });
            const payments = await Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            const commission = await Payment.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: '$commission' } } }
            ]);

            data.stats = [
                { title: 'Total Users', value: users, change: 5.2, icon: 'users' },
                { title: 'New Messages', value: messages, change: -2.1, icon: 'envelope' },
                { title: 'Total Payments', value: payments[0]?.total || 0, change: 12.7, icon: 'money-bill-wave' },
                { title: 'Platform Commission', value: commission[0]?.total || 0, change: 12.7, icon: 'percentage' }
            ];

            data.messages = await Message.find().sort({ time: -1 }).limit(5);
            data.payments = await Payment.find().sort({ date: -1 }).limit(3);
        } 
        else if (section === 'payments') {
            const summary = await Payment.aggregate([
                { 
                    $group: { 
                        _id: null,
                        totalTransactions: { $sum: '$amount' },
                        platformCommission: { $sum: '$commission' },
                        paidToCompanies: { 
                            $sum: { 
                                $cond: [
                                    { $or: [
                                        { $eq: ['$status', 'completed'] },
                                        { $eq: ['$status', 'pending'] }
                                    ]},
                                    { $subtract: ['$amount', '$commission'] },
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            data.paymentSummary = [
                { title: 'Total Transactions', amount: summary[0]?.totalTransactions || 0 },
                { title: 'Platform Commission', amount: summary[0]?.platformCommission || 0 },
                { title: 'Paid to Companies', amount: summary[0]?.paidToCompanies || 0 },
                { title: 'Pending Payments', amount: await Payment.countDocuments({ status: 'pending' }) * 50000 } // Example value
            ];

            data.payments = await Payment.find().sort({ date: -1 });
        } 
        else if (section === 'projects') {
            data.projects = await Project.find().sort({ createdAt: -1 });
        } 
        else if (section === 'users') {
            data.users = await User.find().sort({ createdAt: -1 });
        } 
        else if (section === 'settings') {
            const settings = await Setting.findOne();
            data.settings = {
                general: {
                    platformName: settings.platformName,
                    platformEmail: settings.platformEmail,
                    supportContact: settings.supportContact,
                    timezone: settings.timezone,
                    maintenanceMode: settings.maintenanceMode,
                    timezones: [
                        { value: 'UTC-8', label: 'PST (UTC-8)' },
                        { value: 'UTC-5', label: 'EST (UTC-5)' },
                        { value: 'UTC+0', label: 'GMT (UTC+0)' },
                        { value: 'UTC+5:30', label: 'IST (UTC+5:30)' }
                    ]
                },
                payment: {
                    commissionRate: settings.commissionRate,
                    processor: settings.paymentProcessor,
                    apiKey: settings.apiKey,
                    paymentMethods: settings.paymentMethods,
                    autoPayout: settings.autoPayout,
                    payoutSchedule: settings.payoutSchedule,
                    processors: [
                        { value: 'stripe', label: 'Stripe' },
                        { value: 'paypal', label: 'PayPal' },
                        { value: 'razorpay', label: 'Razorpay' }
                    ],
                    methods: [
                        { value: 'credit', label: 'Credit Card' },
                        { value: 'debit', label: 'Debit Card' },
                        { value: 'bank', label: 'Bank Transfer' },
                        { value: 'digital', label: 'Digital Wallet' }
                    ],
                    schedules: [
                        { value: 'immediate', label: 'Immediate' },
                        { value: 'daily', label: 'Daily' },
                        { value: 'weekly', label: 'Weekly' },
                        { value: 'monthly', label: 'Monthly' }
                    ]
                }
            };
        }

        res.render('dashboard', data);
    } catch (err) {
        console.error('Error rendering dashboard:', err);
        res.status(500).send('Internal Server Error');
    }
});

// API endpoints for data operations
app.post('/api/settings/general', async (req, res) => {
    try {
        const { platformName, platformEmail, supportContact, timezone, maintenanceMode } = req.body;
        await Setting.updateOne({}, {
            platformName,
            platformEmail,
            supportContact,
            timezone,
            maintenanceMode: maintenanceMode === 'on',
            lastUpdated: new Date()
        });
        res.redirect('/admin/settings?tab=general');
    } catch (err) {
        console.error('Error updating general settings:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/settings/payment', async (req, res) => {
    try {
        const { commissionRate, paymentProcessor, apiKey, paymentMethods, autoPayout, payoutSchedule } = req.body;
        await Setting.updateOne({}, {
            commissionRate: parseFloat(commissionRate),
            paymentProcessor,
            apiKey,
            paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods],
            autoPayout: autoPayout === 'on',
            payoutSchedule,
            lastUpdated: new Date()
        });
        res.redirect('/admin/settings?tab=payment');
    } catch (err) {
        console.error('Error updating payment settings:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});