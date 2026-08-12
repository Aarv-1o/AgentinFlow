// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://www.agentinflow.com',

    // Emit directory-style URLs so /service/ and /aboutus/ keep resolving
    // exactly as they did on the old hand-written site. Do not change this
    // without adding redirects - those URLs are indexed by Google.
    build: {
        format: 'directory'
    }
});
