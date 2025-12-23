// Reviews Data
const reviews = [
    {
        name: "Arjun Mehta",
        text: "The n8n workflows they built for our lead management are incredible. We've automated 90% of our manual follow-ups effortlessly.",
        rating: 5
    },
    {
        name: "Priyanka Sharma",
        text: "Their AI agents handle our customer queries 24/7. The integration with our WhatsApp was seamless and very professional.",
        rating: 5
    },
    {
        name: "Vikram Singh",
        text: "Highly impressed with their n8n automation skills. They connected our CRM, Email, and Slack in ways we didn't think possible.",
        rating: 5
    },
    {
        name: "Ananya Desai",
        text: "The custom AI agents have reduced our operational costs significantly. A must-have for any modern Indian business.",
        rating: 5
    },
    {
        name: "Rohan Gupta",
        text: "Excellent work on our complex n8n workflows. Their technical expertise in automation is truly top-notch.",
        rating: 5
    }
];

// ========================================
// EMAILJS CONFIGURATION - EDIT THIS SECTION
// ========================================
// Emails will be sent to: aarvsinghchauhan@gmail.com
// To update credentials, change the values below
// ========================================

const EMAILJS_SERVICE_ID = 'service_4bh62x2';
const EMAILJS_TEMPLATE_ID = 'template_w5hz4df';
const EMAILJS_PUBLIC_KEY = 'CzHf1hBzaQZvLGMxn';

// ========================================
// END EMAILJS CONFIGURATION
// ========================================

// Scroll to Section
function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// Render Reviews
function renderReviews() {
    const track = document.getElementById('reviewsTrack');
    const allReviews = [...reviews, ...reviews];

    track.innerHTML = allReviews.map(review => `
    <div class="review-card">
      <div class="stars">
        ${Array(review.rating).fill('<svg class="star" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>').join('')}
      </div>
      <p class="review-text">"${review.text}"</p>
      <div class="review-author">
        <p class="author-name">${review.name}</p>
      </div>
    </div>
  `).join('');
}

// Form Handling
document.addEventListener('DOMContentLoaded', function () {
    renderReviews();

    document.getElementById('contactForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const btnIcon = document.getElementById('btnIcon');

        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            company: document.getElementById('company').value || 'Not provided',
            message: document.getElementById('message').value
        };

        // Disable button and show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Sending...';
        btnIcon.style.display = 'none';

        try {
            const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    service_id: EMAILJS_SERVICE_ID,
                    template_id: EMAILJS_TEMPLATE_ID,
                    user_id: EMAILJS_PUBLIC_KEY,
                    template_params: {
                        from_name: formData.name,
                        from_email: formData.email,
                        company: formData.company,
                        message: formData.message,
                        to_email: 'aarvsinghchauhan@gmail.com'
                    }
                })
            });

            if (response.ok) {
                btnText.textContent = 'Message Sent!';
                btnIcon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
                btnIcon.style.display = 'block';
                document.getElementById('contactForm').reset();

                setTimeout(() => {
                    btnText.textContent = 'Send Message';
                    btnIcon.innerHTML = '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>';
                    submitBtn.disabled = false;
                }, 5000);
            } else {
                throw new Error('Failed to send');
            }
        } catch (error) {
            console.error('Email send error:', error);
            alert('Failed to send message. Please try again.');
            btnText.textContent = 'Send Message';
            btnIcon.innerHTML = '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>';
            btnIcon.style.display = 'block';
            submitBtn.disabled = false;
        }
    });
});


