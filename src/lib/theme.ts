/**
 * Theme constants shared by the server-rendered bootstrap script in
 * `src/app/layout.tsx` and the client theme provider.
 *
 * This deliberately lives outside the `'use client'` module: non-component
 * exports of a client module are replaced by client-reference stubs on the
 * server, which would stringify into a broken inline script.
 */
export const THEME_STORAGE_KEY = 'bhikitia-reading-theme';
