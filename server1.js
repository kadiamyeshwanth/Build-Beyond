const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Route for the settings page
app.get('/settings', (req, res) => {
    // Mock user data (replace this with data from your database)
    const user = {
        fullName: 'Sai',
        email: 'aarav@gmail.com',
        phone: '+91 78856 34429',
        address: 'Avenue Road, Meerut',
        bio: "I'm a homeowner looking to renovate my kitchen and add a deck to the back of my house."
    };
    res.render('settings', { user });
});

// Route for the home page (example)
app.get('/', (req, res) => {
    res.send();
});

// Route for handling form submission (example)
app.post('/update-profile', (req, res) => {
    // Handle form submission logic here
    // For example, update user data in the database
    res.send('Profile updated successfully!');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});