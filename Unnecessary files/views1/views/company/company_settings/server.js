const Company = require('../models/Company'); // Assuming you have a Company model
const bcrypt = require('bcryptjs');

// Render settings page with company data
exports.getSettings = async (req, res) => {
    try {
        const company = await Company.findById(req.user._id).select('-password');
        if (!company) {
            return res.status(404).send('Company not found');
        }
        
        res.render('settings_company', { 
            company: company,
            messages: req.flash() // If you're using flash messages
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// Update company profile
exports.updateProfile = async (req, res) => {
    try {
        const { companyName, email, phone, address, about } = req.body;
        
        const updateData = {
            companyName,
            email,
            phone,
            address,
            about
        };
        
        const updatedCompany = await Company.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true }
        ).select('-password');
        
        req.flash('success', 'Profile updated successfully');
        res.redirect('/company/settings');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error updating profile');
        res.redirect('/company/settings');
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
            req.flash('error', 'New passwords do not match');
            return res.redirect('/company/settings#security');
        }
        
        // Get company
        const company = await Company.findById(req.user._id);
        if (!company) {
            req.flash('error', 'Company not found');
            return res.redirect('/company/settings#security');
        }
        
        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, company.password);
        if (!isMatch) {
            req.flash('error', 'Current password is incorrect');
            return res.redirect('/company/settings#security');
        }
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password
        company.password = hashedPassword;
        await company.save();
        
        req.flash('success', 'Password updated successfully');
        res.redirect('/company/settings#security');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error changing password');
        res.redirect('/company/settings#security');
    }
};