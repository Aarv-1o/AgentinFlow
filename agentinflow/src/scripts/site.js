// Shared behaviour for the inner pages (service, about us).
//
// Ported from the old service/script.js and aboutus/script.js, which were
// near-identical copies of each other. Two things were removed deliberately:
//
//   1. The smooth-scroll block was registered twice in each file, so every
//      hash link carried two identical click listeners. Registered once here.
//   2. The nav "active" state was set in JS by comparing filenames. Astro now
//      derives it from the URL at build time, so the JS version is redundant
//      (and would no longer match, since links are paths not filenames).

const linkedInProfiles = {
    aarv: 'https://www.linkedin.com/in/aarv-singh-chauhan-4a7987291',
    chinmay: 'https://www.linkedin.com/in/chinmay-pratap-singh-bhadoria-6a8756221'
};

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            const target = document.getElementById(href.substring(1));
            if (!target) return;

            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function initScrollReveal() {
    const cards = document.querySelectorAll('.team-card, .mission-card');
    if (cards.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    cards.forEach((card) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}

// Was an inline onclick="openLinkedIn('aarv')". Inline handlers need a global
// function, but bundled module scripts are scoped, so this is delegated from
// a data attribute instead.
function initLinkedInButtons() {
    document.querySelectorAll('[data-linkedin]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const url = linkedInProfiles[btn.dataset.linkedin];
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            } else {
                console.error(`LinkedIn URL not found for ${btn.dataset.linkedin}`);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initScrollReveal();
    initLinkedInButtons();
});
