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

let EMAILJS_SERVICE_ID = 'service_4bh62x2';
let EMAILJS_TEMPLATE_ID = 'template_w5hz4df';
let EMAILJS_PUBLIC_KEY = 'CzHf1hBzaQZvLGMxn';

// ========================================
// END EMAILJS CONFIGURATION
// ========================================

// ========================================
// FROZEN: EmailJS variable contract
// ----------------------------------------
// These five names must match the EmailJS dashboard template EXACTLY.
// The dashboard lives outside this repo, so a mismatch is caught by no
// build error and no test - EmailJS renders an unknown variable as an
// empty string and still returns success. That is how the original
// "A message by ___ has been received" bug went unnoticed.
//
// Do not rename these. If a rename is truly needed: change the dashboard
// template first, then this file, then send a live test submission.
// ========================================
const EMAIL_FIELDS = ['from_name', 'from_email', 'company', 'message', 'submitted_at'];

// Where to reach us if the automated send fails.
// Mirrors the To/Cc pair configured on the EmailJS template.
const FALLBACK_EMAIL = 'aarvsinghchauhan@gmail.com';
const FALLBACK_CC = 'chinmaybhadoria1415@gmail.com';

// Contact channels. WHATSAPP_NUMBER is digits only, with country code and
// no '+' - that is the format wa.me requires.
const WHATSAPP_NUMBER = '919584598779';
const CALL_NUMBER = '+919343393388';

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

// ========================================
// Contact Form
// ========================================

const ARROW_ICON = '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>';
const CHECK_ICON = '<polyline points="20 6 9 17 4 12"/>';

// Bots submit instantly; humans need time to type. Anything faster is rejected.
const MIN_FILL_SECONDS = 3;

function setFieldError(id, message) {
    const input = document.getElementById(id);
    const slot = document.getElementById(id + 'Error');
    if (!slot) return;

    slot.textContent = message || '';
    input.classList.toggle('has-error', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function validateForm(values) {
    const errors = {};

    if (!values.name) {
        errors.name = 'Please enter your name.';
    }

    if (!values.email) {
        errors.email = 'Please enter your email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) {
        errors.email = 'That does not look like a valid email address.';
    }

    if (!values.message) {
        errors.message = 'Please tell us about your project.';
    } else if (values.message.length < 10) {
        errors.message = 'Please add a little more detail (at least 10 characters).';
    }

    return errors;
}

function showStatus(el, type, html) {
    el.className = 'form-status is-visible is-' + type;
    el.innerHTML = html;
}

function clearStatus(el) {
    el.className = 'form-status';
    el.innerHTML = '';
}

// If the automated send fails we must not lose the lead - hand the visitor a
// prefilled mailto so they can still reach us in one click.
function buildMailtoFallback(values) {
    const subject = `Project enquiry from ${values.name || 'the AgentinFlow website'}`;
    const body = [
        `Name: ${values.name}`,
        `Email: ${values.email}`,
        `Company: ${values.company}`,
        '',
        values.message
    ].join('\n');

    return `mailto:${FALLBACK_EMAIL}?cc=${encodeURIComponent(FALLBACK_CC)}` +
        `&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Prefill WhatsApp with whatever the visitor already typed, so a failed send
// does not force them to retype their enquiry.
function buildWhatsAppLink(values) {
    const text = values && values.message
        ? `Hi AgentinFlow, I'm ${values.name} from ${values.company}.\n\n${values.message}`
        : 'Hi AgentinFlow, I would like to discuss a project.';

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnIcon = document.getElementById('btnIcon');
    const status = document.getElementById('formStatus');
    const honeypot = document.getElementById('website');

    const formLoadedAt = Date.now();

    // Clear a field's error as soon as the visitor starts correcting it
    ['name', 'email', 'message'].forEach((id) => {
        document.getElementById(id).addEventListener('input', () => setFieldError(id, ''));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearStatus(status);

        const values = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            company: document.getElementById('company').value.trim() || 'Not provided',
            message: document.getElementById('message').value.trim()
        };

        // Silently accept-and-drop bot submissions so they get no useful signal
        const filledTooFast = (Date.now() - formLoadedAt) / 1000 < MIN_FILL_SECONDS;
        if (honeypot.value || filledTooFast) {
            showStatus(status, 'success', '<strong>Message sent.</strong> We will get back to you shortly.');
            form.reset();
            return;
        }

        const errors = validateForm(values);
        ['name', 'email', 'message'].forEach((id) => setFieldError(id, errors[id]));

        if (Object.keys(errors).length > 0) {
            const firstBad = ['name', 'email', 'message'].find((id) => errors[id]);
            document.getElementById(firstBad).focus();
            showStatus(status, 'error', 'Please fix the highlighted fields and try again.');
            return;
        }

        submitBtn.disabled = true;
        btnText.textContent = 'Sending...';
        btnIcon.style.display = 'none';

        try {
            // Keys here are the frozen contract - see EMAIL_FIELDS above
            const templateParams = {
                from_name: values.name,
                from_email: values.email,
                company: values.company,
                message: values.message,
                submitted_at: new Date().toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Kolkata'
                }) + ' IST'
            };

            // Guard against the contract drifting during a future refactor
            const sentKeys = Object.keys(templateParams);
            const drifted = sentKeys.filter((k) => !EMAIL_FIELDS.includes(k))
                .concat(EMAIL_FIELDS.filter((k) => !sentKeys.includes(k)));
            if (drifted.length > 0) {
                console.error('EmailJS variable contract drift:', drifted.join(', '));
            }

            const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: EMAILJS_SERVICE_ID,
                    template_id: EMAILJS_TEMPLATE_ID,
                    user_id: EMAILJS_PUBLIC_KEY,
                    template_params: templateParams
                })
            });

            // EmailJS returns the literal string "OK" on success and a plain-text
            // reason on failure, so read the body rather than trusting the status alone
            const body = (await response.text()).trim();

            if (!response.ok || body.toUpperCase() !== 'OK') {
                throw new Error(body || `Request failed with status ${response.status}`);
            }

            form.reset();
            showStatus(
                status,
                'success',
                '<strong>Message sent.</strong> We have emailed you a confirmation and will reply within one business day.'
            );

            btnText.textContent = 'Message Sent!';
            btnIcon.innerHTML = CHECK_ICON;
            btnIcon.style.display = 'block';

            setTimeout(() => {
                btnText.textContent = 'Send Message';
                btnIcon.innerHTML = ARROW_ICON;
                submitBtn.disabled = false;
            }, 5000);
        } catch (error) {
            console.error('Email send error:', error);

            showStatus(
                status,
                'error',
                `<strong>We could not send your message.</strong> Your details are safe below &mdash; reach us directly instead:` +
                `<span class="status-actions">` +
                `<a href="${buildWhatsAppLink(values)}" target="_blank" rel="noopener">WhatsApp us</a>` +
                `<a href="${buildMailtoFallback(values)}">Email us</a>` +
                `<a href="tel:${CALL_NUMBER}">Call us</a>` +
                `</span>` +
                `<span class="status-detail">Reason: ${error.message}</span>`
            );

            btnText.textContent = 'Try Again';
            btnIcon.innerHTML = ARROW_ICON;
            btnIcon.style.display = 'block';
            submitBtn.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    renderReviews();
    initContactForm();
});


