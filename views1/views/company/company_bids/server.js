const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/biddingSystem', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Define schemas
const projectSchema = new mongoose.Schema({
    title: String,
    description: String,
    minBid: Number,
    maxBid: Number,
    postedDate: { type: Date, default: Date.now },
    timeline: String,
    location: String,
    requirements: String
});

const bidSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    bidDate: { type: Date, default: Date.now }
});

const requestSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestDate: { type: Date, default: Date.now }
});

// Create models
const Project = mongoose.model('Project', projectSchema);
const Bid = mongoose.model('Bid', bidSchema);
const Request = mongoose.model('Request', requestSchema);

// Middleware to format currency
const formatCurrency = (amount) => {
    return parseFloat(amount).toLocaleString('en-IN', {
        maximumFractionDigits: 0
    });
};

// Route to render bidding page
router.get('/bidding', async (req, res) => {
    try {
        // In a real app, you'd get the user ID from the session
        const userId = 'sampleUserId'; // Replace with actual user ID from session
        
        const projects = await Project.find();
        const userBids = await Bid.find({ userId }).populate('project');
        const userRequests = await Request.find({ userId }).populate('project');
        
        res.render('bidding_system', {
            projects,
            userBids,
            userRequests,
            formatCurrency
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Route to handle bid submission
router.post('/submit-bid', async (req, res) => {
    try {
        const { projectId, bidAmount } = req.body;
        // In a real app, you'd get the user ID from the session
        const userId = 'sampleUserId'; // Replace with actual user ID from session
        
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).send('Project not found');
        }
        
        if (bidAmount < project.minBid || bidAmount > project.maxBid) {
            return res.status(400).send(`Bid must be between ${project.minBid} and ${project.maxBid}`);
        }
        
        const newBid = new Bid({
            projectId,
            userId,
            amount: bidAmount
        });
        
        await newBid.save();
        
        res.redirect('/bidding');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Route to handle request submission
router.post('/submit-request', async (req, res) => {
    try {
        const { projectId, message } = req.body;
        // In a real app, you'd get the user ID from the session
        const userId = 'sampleUserId'; // Replace with actual user ID from session
        
        const newRequest = new Request({
            projectId,
            userId,
            message
        });
        
        await newRequest.save();
        
        res.redirect('/bidding');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;