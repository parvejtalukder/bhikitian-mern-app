import 'dotenv/config';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  getMediaWikiConfig,
  mediawikiClient,
  normalizeSlug,
} from './server/mediawikiClient.ts';
import {
  adminUpdateSubmission,
  createSubmission,
  getSubmissionByTrackingId,
  listSubmissions,
  submitPaymentProof,
} from './server/submissionStore.ts';

const PORT = 3000;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'bhikitia-staff-2026';
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET || 'bhikitia-revalidate-secret';

const activeAdminTokens = new Set<string>();

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !activeAdminTokens.has(token)) {
    res.status(401).json({ error: 'Staff authentication required.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // --- Health ---
  app.get('/api/health', (_req, res) => {
    const cfg = getMediaWikiConfig();
    res.json({
      ok: true,
      service: 'bhikitia-headless',
      publicSiteUrl: cfg.publicSiteUrl,
      staffMediawikiUrl: cfg.staffMediawikiUrl,
      mediawikiBaseUrlConfigured: Boolean(cfg.mediawikiBaseUrl),
    });
  });

  // --- Public MediaWiki Portal & Encyclopedia Endpoints ---
  app.get('/api/portal', async (_req, res) => {
    try {
      const data = await mediawikiClient.getPortalData();
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to reach MediaWiki source of truth.',
      });
    }
  });

  app.get('/api/wiki/article', async (req, res) => {
    try {
      const rawSlug = String(req.query.slug || 'Main_Page');
      const bypass = req.query.fresh === '1';
      const article = await mediawikiClient.getArticle(rawSlug, bypass);
      res.setHeader(
        'Cache-Control',
        article.exists
          ? 'public, max-age=120, stale-while-revalidate=600'
          : 'no-store'
      );
      res.json(article);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch MediaWiki article.',
      });
    }
  });

  app.get('/api/wiki/history', async (req, res) => {
    try {
      const rawSlug = String(req.query.slug || 'Main_Page');
      const history = await mediawikiClient.getArticleHistory(rawSlug);
      res.json(history);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch article history.',
      });
    }
  });

  app.get('/api/wiki/source', async (req, res) => {
    try {
      const rawSlug = String(req.query.slug || 'Main_Page');
      const source = await mediawikiClient.getArticleSource(rawSlug);
      res.json(source);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to fetch article wikitext source.',
      });
    }
  });

  app.get('/api/wiki/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const limit = Math.min(30, Math.max(1, Number(req.query.limit || 15)));
      if (!q) {
        res.json({ query: '', results: [] });
        return;
      }
      const results = await mediawikiClient.search(q, limit);
      res.json({ query: q, results });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'MediaWiki search failed.',
      });
    }
  });

  app.get('/api/wiki/verify', async (req, res) => {
    try {
      const rawSlug = String(req.query.slug || '').trim();
      if (!rawSlug) {
        res.status(400).json({ exists: false, error: 'Missing slug parameter.' });
        return;
      }
      const article = await mediawikiClient.getArticle(rawSlug, true);
      res.json({
        exists: article.exists,
        slug: article.slug,
        title: article.title,
        canonicalUrl: article.canonicalUrl,
        revId: article.revId,
      });
    } catch (err) {
      res.status(502).json({
        exists: false,
        error: err instanceof Error ? err.message : 'Verification failed.',
      });
    }
  });

  // --- Architecture & Hosting Verification ---
  app.get('/api/architecture/audit', async (_req, res) => {
    try {
      const audit = await mediawikiClient.runHostingAudit();
      res.json(audit);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Audit probe failed.',
      });
    }
  });

  // --- Cache Refresh / Revalidation Endpoint (for MediaWiki PageSaveComplete webhooks) ---
  app.post('/api/revalidate', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const secret = String(req.body?.secret || req.headers['x-revalidate-secret'] || '');
    const isAdminToken = Boolean(bearer && activeAdminTokens.has(bearer));
    const hasSecret = secret === REVALIDATION_SECRET;

    if (!isAdminToken && !hasSecret) {
      res.status(401).json({ error: 'Invalid revalidation credentials.' });
      return;
    }

    const slug = req.body?.slug ? String(req.body.slug) : undefined;
    const result = mediawikiClient.revalidate(slug);
    res.json({
      revalidated: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  });

  // --- Public Submission Intake & Tracking (/submit & /submit/track) ---
  app.get('/api/config/contact', (_req, res) => {
    const cfg = getMediaWikiConfig();
    res.json({
      whatsappNumber: process.env.WHATSAPP_DESK_NUMBER || '8801700000000',
      editorialEmail: process.env.EDITORIAL_EMAIL || 'editorial@bhikitia.org',
      publicSiteUrl: cfg.publicSiteUrl,
      staffMediawikiUrl: cfg.staffMediawikiUrl,
    });
  });

  app.post('/api/submissions', (req, res) => {
    const body = req.body || {};
    const proposedTitle = String(body.proposedTitle || '').trim();
    const summary = String(body.summary || '').trim();
    const requesterName = String(body.requesterName || '').trim();
    const requesterEmail = String(body.requesterEmail || '').trim();
    const requesterWhatsapp = String(body.requesterWhatsapp || '').trim();

    if (!proposedTitle || !summary || !requesterName || !requesterEmail || !requesterWhatsapp) {
      res.status(400).json({
        error: 'Proposed title, summary, requester name, email, and WhatsApp number are required.',
      });
      return;
    }

    const referenceUrls = Array.isArray(body.referenceUrls)
      ? body.referenceUrls.map((u: unknown) => String(u))
      : String(body.referenceUrls || '')
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean);

    const created = createSubmission({
      submissionType: body.submissionType || 'new_article',
      edition: body.edition || 'en',
      proposedTitle,
      summary,
      referenceUrls,
      requesterName,
      requesterEmail,
      requesterWhatsapp,
      affiliation: body.affiliation ? String(body.affiliation) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
    });

    res.status(201).json(created);
  });

  app.get('/api/submissions/track/:id', (req, res) => {
    const record = getSubmissionByTrackingId(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'No submission found for that Tracking ID.' });
      return;
    }
    // Redact internal-only staffNotes from public tracking view
    const { staffNotes: _hidden, ...publicRecord } = record;
    res.json(publicRecord);
  });

  app.post('/api/submissions/track/:id/payment-proof', (req, res) => {
    const paymentMethod = String(req.body?.paymentMethod || '').trim();
    const paymentReference = String(req.body?.paymentReference || '').trim();
    if (!paymentMethod || !paymentReference) {
      res.status(400).json({ error: 'Payment method and transaction reference are required.' });
      return;
    }
    const updated = submitPaymentProof(req.params.id, paymentMethod, paymentReference);
    if (!updated) {
      res.status(404).json({ error: 'Tracking ID not found.' });
      return;
    }
    const { staffNotes: _hidden, ...publicRecord } = updated;
    res.json(publicRecord);
  });

  // --- Staff Editorial & Billing Admin (/submit/admin) ---
  app.post('/api/admin/login', (req, res) => {
    const passcode = String(req.body?.passcode || '').trim();
    if (passcode !== ADMIN_PASSCODE) {
      res.status(401).json({ error: 'Invalid staff passcode.' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    activeAdminTokens.add(token);
    res.json({ token, role: 'Editorial Staff' });
  });

  app.post('/api/admin/logout', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (token) activeAdminTokens.delete(token);
    res.json({ ok: true });
  });

  app.get('/api/admin/submissions', requireAdmin, (_req, res) => {
    res.json({ submissions: listSubmissions() });
  });

  app.patch('/api/admin/submissions/:id', requireAdmin, async (req, res) => {
    const patch = req.body || {};
    let normalizedSlug = patch.publishedArticleSlug ? normalizeSlug(String(patch.publishedArticleSlug)) : undefined;
    let resolvedUrl = patch.publishedArticleUrl ? String(patch.publishedArticleUrl).trim() : undefined;

    if (resolvedUrl && !normalizedSlug) {
      const wikiMatch = resolvedUrl.match(/\/wiki\/([^?#]+)/);
      if (wikiMatch) {
        normalizedSlug = normalizeSlug(wikiMatch[1]);
      }
    }

    const cfg = getMediaWikiConfig();
    if (normalizedSlug && !resolvedUrl) {
      resolvedUrl = `${cfg.publicSiteUrl}/wiki/${encodeURIComponent(normalizedSlug)}`;
    }

    const updated = adminUpdateSubmission(req.params.id, {
      ...patch,
      publishedArticleSlug: normalizedSlug,
      publishedArticleUrl: resolvedUrl,
    });

    if (!updated) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }

    // Automatically refresh cache when a public article link is saved/published
    if (normalizedSlug) {
      mediawikiClient.revalidate(normalizedSlug);
    }

    res.json(updated);
  });

  // --- Dynamic Sitemap & Robots.txt ---
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const { publicSiteUrl } = getMediaWikiConfig();
      const slugs = await mediawikiClient.getSitemapSlugs();
      const now = new Date().toISOString();
      const urlsXml = [
        `<url><loc>${publicSiteUrl}/</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
        `<url><loc>${publicSiteUrl}/submit</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`,
        ...slugs.map(
          (slug) =>
            `<url><loc>${publicSiteUrl}/wiki/${encodeURIComponent(slug)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`
        ),
      ].join('\n  ');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urlsXml}
</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=900');
      res.send(xml);
    } catch (err) {
      res.status(500).type('text/plain').send('Unable to build sitemap.');
    }
  });

  app.get('/robots.txt', (_req, res) => {
    const { publicSiteUrl } = getMediaWikiConfig();
    res.type('text/plain').send(
`# Public Headless Frontend (${publicSiteUrl})
User-agent: *
Allow: /
Allow: /wiki/
Disallow: /submit/admin
Disallow: /submit/track
Disallow: /api/

Sitemap: ${publicSiteUrl}/sitemap.xml

# Note: Staff MediaWiki origin (edit.bhikitia.org) must serve its own
# Disallow: / robots.txt plus HTTP header: X-Robots-Tag: noindex, nofollow
`
    );
  });

  // --- Vite Dev Middleware / Production Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/submit/admin')) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bhikitia server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
