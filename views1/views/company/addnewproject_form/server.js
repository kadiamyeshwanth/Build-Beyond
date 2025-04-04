const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const ejs = require('ejs');

const app = express();

// Configure EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/constructionDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Project Schema
const projectSchema = new mongoose.Schema({
    projectName: String,
    location: String,
    tags: [String],
    completionPercentage: Number,
    targetCompletionDate: Date,
    currentPhase: String,
    mainImage: String,
    additionalImages: [String],
    updates: [{
        text: String,
        image: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Project = mongoose.model('Project', projectSchema);

// Routes
app.get('/', (req, res) => {
    res.redirect('/projects');
});

// Display all projects
app.get('/projects', async (req, res) => {
    try {
        const projects = await Project.find().sort({ createdAt: -1 });
        res.render('construction-app', { 
            title: 'Construction Projects',
            view: 'list',
            projects 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Display form to add new project
app.get('/projects/new', (req, res) => {
    res.render('construction-app', { 
        title: 'Construction Projects',
        view: 'form',
        formTitle: 'Add Construction Project',
        project: null
    });
});

// Display form to edit existing project
app.get('/projects/edit/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).send('Project not found');
        }
        res.render('construction-app', { 
            title: 'Edit Project',
            view: 'form',
            formTitle: 'Edit Construction Project',
            project 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Handle form submission (create or update)
app.post('/projects', upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 10 },
    { name: 'updateImages', maxCount: 10 }
]), async (req, res) => {
    try {
        const { 
            projectId,
            projectName, 
            location, 
            tags, 
            completionPercentage, 
            targetCompletionDate, 
            currentPhase,
            updates
        } = req.body;

        // Handle tags - if it's a single value, convert to array
        const tagsArray = Array.isArray(tags) ? tags : tags ? [tags] : [];

        // Handle updates - if it's a single update, convert to array
        const updatesArray = Array.isArray(updates) ? updates : updates ? [updates] : [];
        
        // Prepare updates with images
        const processedUpdates = updatesArray.map((text, index) => {
            const updateImage = req.files['updateImages'] && req.files['updateImages'][index] 
                ? req.files['updateImages'][index].filename 
                : null;
            return { text, image: updateImage };
        });

        const projectData = {
            projectName,
            location,
            tags: tagsArray,
            completionPercentage: parseInt(completionPercentage),
            targetCompletionDate: new Date(targetCompletionDate),
            currentPhase,
            mainImage: req.files['mainImage'] ? req.files['mainImage'][0].filename : null,
            additionalImages: req.files['additionalImages'] 
                ? req.files['additionalImages'].map(file => file.filename) 
                : [],
            updates: processedUpdates
        };

        if (projectId) {
            // Update existing project
            const updatedProject = await Project.findByIdAndUpdate(
                projectId,
                projectData,
                { new: true }
            );
            res.redirect(`/projects/${updatedProject._id}`);
        } else {
            // Create new project
            const newProject = new Project(projectData);
            await newProject.save();
            res.redirect(`/projects/${newProject._id}`);
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Display single project
app.get('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).send('Project not found');
        }
        res.render('construction-app', { 
            title: project.projectName,
            view: 'details',
            project 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Delete project
app.post('/projects/delete/:id', async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.params.id);
        res.redirect('/projects');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});