// LinkedIn URL Configuration
// ========================================
// Add the LinkedIn profile URLs for each team member
// ========================================

const linkedInProfiles = {
    aarv: 'https://www.linkedin.com/in/aarv-singh-chauhan/', // Replace with actual LinkedIn URL
    chinmay: 'https://www.linkedin.com/in/chinmay-bhadouria/' // Replace with actual LinkedIn URL
};

// ========================================
// END CONFIGURATION
// ========================================

/**
 * Opens LinkedIn profile in a new tab
 * @param {string} member - The team member identifier ('aarv' or 'chinmay')
 */
function openLinkedIn(member) {
    const url = linkedInProfiles[member];
    
    if (url) {
        // Open LinkedIn profile in new tab
        window.open(url, '_blank', 'noopener,noreferrer');
    } else {
        console.error(`LinkedIn URL not found for ${member}`);
        alert('LinkedIn profile URL not configured yet.');
    }
}

// Smooth scroll for navigation links
document.addEventListener('DOMContentLoaded', function() {
    // Handle navigation links with hash
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href === '#') return;
            
            e.preventDefault();
            
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add animation on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe team cards and mission cards
    const cards = document.querySelectorAll('.team-card, .mission-card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
});

// Add active state to navigation
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('#')[0];
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        }
    });
});

// Add this to your existing script.js file

// Smooth scroll for all anchor links
document.addEventListener('DOMContentLoaded', function() {
    // Handle navigation links with hash
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href === '#') return;
            
            e.preventDefault();
            
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add active state to navigation based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('#')[0];
        if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
            link.classList.add('active');
        }
    });
});