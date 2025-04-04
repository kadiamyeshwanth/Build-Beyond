const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const ejs = require('ejs');

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/clientDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Client Schema
const clientSchema = new mongoose.Schema({
    name: String,
    type: String,
    contact: String,
    phone: String,
    projects: [String],
    status: String
});

// Create Client Model
const Client = mongoose.model('Client', clientSchema);

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Seed initial data (optional - run once)
async function seedDatabase() {
    const clients = [
        {
            name: "Metro Housing Corp.",
            type: "Development",
            contact: "Prudhvi",
            phone: "123456789",
            projects: ["Residential Complex", "Commercial Plaza"],
            status: "Ongoing"
        },
        {
            name: "Urban Builders",
            type: "Construction",
            contact: "Sarah Johnson",
            phone: "987654321",
            projects: ["Office Tower"],
            status: "Completed"
        },
        {
            name: "Greenfield Developers",
            type: "Architecture",
            contact: "Michael Chen",
            phone: "5551234567",
            projects: ["Eco Village", "Sustainable Office"],
            status: "Ongoing"
        }
    ];

    try {
        await Client.deleteMany({});
        await Client.insertMany(clients);
        console.log('Database seeded successfully');
    } catch (err) {
        console.error('Error seeding database:', err);
    }
}

// Uncomment to seed data (run once)
// seedDatabase();

// Route to display clients
app.get('/clients', async (req, res) => {
    try {
        const clients = await Client.find({});
        res.render('clients', { clients });
    } catch (err) {
        console.error('Error fetching clients:', err);
        res.status(500).send('Error fetching clients');
    }
});

// Route to add a new client (example)
app.post('/clients', async (req, res) => {
    try {
        const newClient = new Client(req.body);
        await newClient.save();
        res.redirect('/clients');
    } catch (err) {
        console.error('Error adding client:', err);
        res.status(500).send('Error adding client');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});