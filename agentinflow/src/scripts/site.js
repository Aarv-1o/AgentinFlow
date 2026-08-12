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
//   3. The LinkedIn open-in-new-tab handler is gone: the team list uses real
//      anchors now, which is better for accessibility and lets the URL be
//      seen, copied and crawled.
//   4. The scroll-reveal observer is gone with the mission cards it animated;
//      it had no remaining targets.

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

document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
});
