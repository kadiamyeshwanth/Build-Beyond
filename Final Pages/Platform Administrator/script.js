// DOM Elements
const sidebarLinks = document.querySelectorAll('.nav-menu ul li a');
const contentSections = document.querySelectorAll('.content-section');
const userTabs = document.querySelectorAll('.user-tabs .tab-btn');
const userTabContents = document.querySelectorAll('.tab-content');
const paymentDetailModal = document.getElementById('payment-detail-modal');
const userDetailModal = document.getElementById('user-detail-modal');
const closeModalButtons = document.querySelectorAll('.btn-close');
const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
const dropdownMenus = document.querySelectorAll('.dropdown-menu');
const settingsNavItems = document.querySelectorAll('.settings-nav-item');
const settingsPanels = document.querySelectorAll('.settings-panel');
const toastContainer = document.createElement('div');
toastContainer.classList.add('toast-container');
document.body.appendChild(toastContainer);

// Helper Functions
function hideAllSections() {
    contentSections.forEach(section => section.classList.remove('active'));
}

function hideAllTabs() {
    userTabContents.forEach(tab => tab.classList.remove('active'));
    userTabs.forEach(tab => tab.classList.remove('active'));
}

function hideAllDropdowns() {
    dropdownMenus.forEach(menu => menu.classList.remove('show'));
}

function hideAllSettingsPanels() {
    settingsPanels.forEach(panel => panel.classList.remove('active'));
    settingsNavItems.forEach(item => item.classList.remove('active'));
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.classList.add('toast', type);
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Sidebar Navigation
sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = link.getAttribute('data-section');

        hideAllSections();
        document.getElementById(targetSection).classList.add('active');
        sidebarLinks.forEach(link => link.parentElement.classList.remove('active'));
        link.parentElement.classList.add('active');
    });
});

// User Tabs
userTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        hideAllTabs();
        document.getElementById(`${targetTab}-tab`).classList.add('active');
        tab.classList.add('active');
    });
});

// Modals
closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
        paymentDetailModal.classList.remove('active');
        userDetailModal.classList.remove('active');
    });
});

// Payment Detail Modal (Example Trigger)
document.querySelectorAll('.action-buttons .btn-icon[title="View Details"]').forEach(button => {
    button.addEventListener('click', () => {
        paymentDetailModal.classList.add('active');
    });
});

// User Detail Modal (Example Trigger)
document.querySelectorAll('.action-buttons .btn-icon[title="View Details"]').forEach(button => {
    button.addEventListener('click', () => {
        userDetailModal.classList.add('active');
    });
});

// Dropdowns
dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
        const dropdownMenu = toggle.nextElementSibling;
        hideAllDropdowns();
        dropdownMenu.classList.toggle('show');
    });
});

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
        hideAllDropdowns();
    }
});

// Settings Navigation
settingsNavItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetPanel = item.getAttribute('data-settings');
        hideAllSettingsPanels();
        document.getElementById(`${targetPanel}-settings`).classList.add('active');
        item.classList.add('active');
    });
});

// Form Validation (Example for Settings Form)
document.querySelector('.settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const platformName = document.getElementById('platform-name').value;
    const platformEmail = document.getElementById('platform-email').value;

    if (!platformName || !platformEmail) {
        showToast('Please fill in all required fields.', 'error');
    } else {
        showToast('Settings saved successfully!', 'success');
        // Simulate saving settings
        setTimeout(() => {
            // Reset form or perform other actions
        }, 1000);
    }
});


// Real-time Notifications (Simulated)
setInterval(() => {
    const notificationBadge = document.querySelector('.notification-btn .badge');
    if (notificationBadge) {
        const count = parseInt(notificationBadge.textContent) || 0;
        notificationBadge.textContent = count + 1;
        showToast('New notification received!', 'info');
    }
}, 10000); // Simulate a new notification every 10 seconds



