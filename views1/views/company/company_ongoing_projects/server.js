const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/realEstateDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Define Project Schema
const projectSchema = new mongoose.Schema({
  name: String,
  location: String,
  type: String,
  status: String,
  mainImage: String,
  completionPercentage: Number,
  targetDate: String,
  currentPhase: String,
  images: [String],
  updates: [{
    image: String,
    description: String,
    date: Date
  }]
});

// Create Project Model
const Project = mongoose.model('Project', projectSchema);

// Dashboard Route
router.get('/dashboard', async (req, res) => {
  try {
    // Get projects from MongoDB
    const projects = await Project.find({});
    
    // Calculate dashboard metrics
    const metrics = {
      totalProjects: projects.length,
      monthlyRevenue: calculateMonthlyRevenue(projects),
      customerSatisfaction: 4.7, // This could be calculated or fetched from another collection
      projectsOnSchedule: calculateProjectsOnSchedule(projects)
    };
    
    // Render the EJS template with data
    res.render('company_dashboard', { 
      projects: projects,
      metrics: metrics
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Helper function to calculate monthly revenue
function calculateMonthlyRevenue(projects) {
  // This is a simplified calculation - adjust based on your business logic
  const revenuePerProject = 4800000; // Example value
  return (projects.length * revenuePerProject / 10000000).toFixed(1) + ' Cr';
}

// Helper function to calculate projects on schedule
function calculateProjectsOnSchedule(projects) {
  // This is a simplified calculation - adjust based on your business logic
  const onScheduleProjects = projects.filter(project => 
    project.completionPercentage >= getExpectedCompletion(project)
  ).length;
  
  return Math.round((onScheduleProjects / projects.length) * 100) || 0;
}

// Helper function to get expected completion percentage
function getExpectedCompletion(project) {
  // This would be based on your project timeline logic
  // For simplicity, we'll return a fixed value here
  return 65; // Example value
}

// Add New Project Route
router.post('/add-project', async (req, res) => {
  try {
    const newProject = new Project({
      name: req.body.name,
      location: req.body.location,
      type: req.body.type,
      status: req.body.status,
      mainImage: req.body.mainImage,
      completionPercentage: req.body.completionPercentage,
      targetDate: req.body.targetDate,
      currentPhase: req.body.currentPhase,
      images: req.body.images,
      updates: req.body.updates
    });
    
    await newProject.save();
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving project');
  }
});

// Edit Project Route
router.post('/edit-project/:id', async (req, res) => {
  try {
    await Project.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating project');
  }
});

module.exports = router;