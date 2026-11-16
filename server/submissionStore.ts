import fs from 'fs';
import path from 'path';
import type {
  OutreachLogEntry,
  PaymentVerificationStatus,
  SubmissionRequest,
  SubmissionStatus,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'submissions.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function computeFinalAmount(baseFee: number, discountPercent: number): number {
  const clampedFee = Math.max(0, Number.isFinite(baseFee) ? baseFee : 0);
  const clampedDiscount = Math.min(100, Math.max(0, Number.isFinite(discountPercent) ? discountPercent : 0));
  const final = clampedFee * (1 - clampedDiscount / 100);
  return Math.round(final * 100) / 100;
}

const SEED_SUBMISSIONS: SubmissionRequest[] = [
  {
    id: 'BHK-2026-4102',
    submissionType: 'biography',
    edition: 'en',
    proposedTitle: 'A. K. Fazlul Huq',
    summary:
      'Expanded biographical entry covering Sher-e-Bangla A. K. Fazlul Huq’s legal career, the Krishak Praja Party, and the 1940 Lahore Resolution with archival citations.',
    referenceUrls: [
      'https://en.banglapedia.org/index.php/Huq,_AK_Fazlul',
      'https://www.britannica.com/biography/A-K-Fazlul-Huq',
    ],
    requesterName: 'Dr. Mahmudur Rahman',
    requesterEmail: 'm.rahman@dhakahistory.org',
    requesterWhatsapp: '+8801711223344',
    affiliation: 'Bengal Historical Society',
    notes: 'Priority academic monograph alignment.',
    status: 'published',
    currency: 'USD',
    baseFee: 120,
    discountPercent: 100,
    discountReason: 'Academic & Historical Public Interest Waiver (100%)',
    finalAmount: 0,
    paymentStatus: 'waived',
    paymentVerifiedBy: 'Editorial Desk',
    paymentVerifiedAt: '2026-11-10T09:15:00.000Z',
    staffNotes: 'Verified primary archival references. Published on MediaWiki rev 13015 and linked to canonical URL.',
    mediawikiDraftTitle: 'A._K._Fazlul_Huq',
    publishedArticleSlug: 'A._K._Fazlul_Huq',
    publishedArticleUrl: 'https://en.bhikitia.org/wiki/A._K._Fazlul_Huq',
    publishedAt: '2026-11-11T14:30:00.000Z',
    outreachLog: [
      {
        id: 'out-1',
        channel: 'system',
        summary: 'Submission logged and assigned tracking ID BHK-2026-4102.',
        sentBy: 'System',
        sentAt: '2026-11-09T11:00:00.000Z',
      },
      {
        id: 'out-2',
        channel: 'email',
        summary: 'Confirmed 100% scholarly fee waiver and moved draft to MediaWiki review queue.',
        sentBy: 'Managing Editor',
        sentAt: '2026-11-10T09:20:00.000Z',
      },
      {
        id: 'out-3',
        channel: 'whatsapp',
        summary: 'Sent published canonical link https://en.bhikitia.org/wiki/A._K._Fazlul_Huq via WhatsApp.',
        sentBy: 'Managing Editor',
        sentAt: '2026-11-11T14:35:00.000Z',
      },
    ],
    createdAt: '2026-11-09T11:00:00.000Z',
    updatedAt: '2026-11-11T14:35:00.000Z',
  },
  {
    id: 'BHK-2026-5289',
    submissionType: 'organization',
    edition: 'bilingual',
    proposedTitle: 'Sylhet Heritage Research Archive',
    summary:
      'Institutional encyclopedia article documenting the 1998 founding, manuscript preservation initiatives, and open-access catalog of Sylhet regional records.',
    referenceUrls: [
      'https://example.org/sylhet-archive-annual-report-2025',
      'https://example.org/bangladesh-national-archives-directory',
    ],
    requesterName: 'Nusrat Jahan Chowdhury',
    requesterEmail: 'nusrat@sylhetheritage.org',
    requesterWhatsapp: '+8801819556677',
    affiliation: 'Sylhet Heritage Trust',
    notes: 'Requires both English and Bengali cross-linked articles.',
    status: 'awaiting_payment',
    currency: 'BDT',
    baseFee: 12000,
    discountPercent: 25,
    discountReason: 'Cultural Non-Profit Partner Discount (25%)',
    finalAmount: 9000,
    paymentStatus: 'proof_submitted',
    paymentMethod: 'bKash Merchant',
    paymentReference: 'TRX9B44K208M',
    paymentSubmittedAt: '2026-11-14T16:40:00.000Z',
    staffNotes: 'Bilingual scope confirmed. Requester submitted bKash TxID TRX9B44K208M; awaiting manual ledger check.',
    mediawikiDraftTitle: 'Sylhet_Heritage_Research_Archive',
    outreachLog: [
      {
        id: 'out-4',
        channel: 'system',
        summary: 'Submission logged and assigned tracking ID BHK-2026-5289.',
        sentBy: 'System',
        sentAt: '2026-11-13T08:15:00.000Z',
      },
      {
        id: 'out-5',
        channel: 'whatsapp',
        summary: 'Shared 25% institutional discount quote (BDT 9,000) and bKash/Bank payment details.',
        sentBy: 'Billing Desk',
        sentAt: '2026-11-14T10:10:00.000Z',
      },
    ],
    createdAt: '2026-11-13T08:15:00.000Z',
    updatedAt: '2026-11-14T16:40:00.000Z',
  },
  {
    id: 'BHK-2026-6731',
    submissionType: 'new_article',
    edition: 'en',
    proposedTitle: '2026 SAFF Championship',
    summary:
      'Tournament overview, participating South Asian football federations, venues, and qualifying brackets for the 2026 SAFF Championship.',
    referenceUrls: [
      'https://en.bhikitia.org/wiki/2026_SAFF_Championship',
      'https://www.the-afc.com/en/national/saff_championship.html',
    ],
    requesterName: 'Tariqul Islam',
    requesterEmail: 'tariq.sports@pressdesk.bd',
    requesterWhatsapp: '+8801912334455',
    affiliation: 'South Asia Sports Chronicle',
    status: 'fee_waived',
    currency: 'USD',
    baseFee: 90,
    discountPercent: 100,
    discountReason: 'Public Sporting Record Community Grant (100% Waiver)',
    finalAmount: 0,
    paymentStatus: 'waived',
    paymentVerifiedBy: 'Chief Editor',
    paymentVerifiedAt: '2026-11-15T07:00:00.000Z',
    staffNotes: '100% fee waived. Ready for final copyedit in edit.bhikitia.org.',
    mediawikiDraftTitle: '2026_SAFF_Championship',
    outreachLog: [
      {
        id: 'out-6',
        channel: 'email',
        summary: 'Approved 100% community fee waiver and queued article for MediaWiki editorial formatting.',
        sentBy: 'Chief Editor',
        sentAt: '2026-11-15T07:05:00.000Z',
      },
    ],
    createdAt: '2026-11-14T18:20:00.000Z',
    updatedAt: '2026-11-15T07:05:00.000Z',
  },
  {
    id: 'BHK-2026-7904',
    submissionType: 'update_correction',
    edition: 'en',
    proposedTitle: '2024 Interim government of Bangladesh',
    summary:
      'Update advisory council portfolio revisions and add verifiable Gazette notification references from Q4 2025.',
    referenceUrls: [
      'https://bangabhaban.gov.bd/',
      'https://cabinet.gov.bd/',
    ],
    requesterName: 'Farhana Yasmin',
    requesterEmail: 'farhana.y@civicwatch.org',
    requesterWhatsapp: '+8801670889900',
    affiliation: 'Civic Policy Desk',
    status: 'review',
    currency: 'USD',
    baseFee: 60,
    discountPercent: 0,
    finalAmount: 60,
    paymentStatus: 'unpaid',
    staffNotes: 'Pending source verification by policy desk editor before issuing quote.',
    mediawikiDraftTitle: '2024_Interim_government_of_Bangladesh',
    outreachLog: [
      {
        id: 'out-7',
        channel: 'system',
        summary: 'Request received and entered initial editorial notability & source review.',
        sentBy: 'System',
        sentAt: '2026-11-15T19:45:00.000Z',
      },
    ],
    createdAt: '2026-11-15T19:45:00.000Z',
    updatedAt: '2026-11-15T19:45:00.000Z',
  },
];

function readStore(): SubmissionRequest[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_SUBMISSIONS, null, 2), 'utf8');
    return [...SEED_SUBMISSIONS];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as SubmissionRequest[];
    }
  } catch {
    // Fallback to seed on corrupted JSON
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_SUBMISSIONS, null, 2), 'utf8');
  return [...SEED_SUBMISSIONS];
}

function writeStore(items: SubmissionRequest[]): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function generateTrackingId(existingIds: Set<string>): string {
  const year = new Date().getFullYear();
  for (let i = 0; i < 20; i++) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const candidate = `BHK-${year}-${rand}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
  return `BHK-${year}-${Date.now().toString().slice(-4)}`;
}

export function listSubmissions(): SubmissionRequest[] {
  const items = readStore();
  return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSubmissionByTrackingId(trackingId: string): SubmissionRequest | null {
  const normalized = trackingId.trim().toUpperCase();
  const items = readStore();
  return items.find((item) => item.id.toUpperCase() === normalized) || null;
}

export interface CreateSubmissionInput {
  submissionType: SubmissionRequest['submissionType'];
  edition: SubmissionRequest['edition'];
  proposedTitle: string;
  summary: string;
  referenceUrls: string[];
  requesterName: string;
  requesterEmail: string;
  requesterWhatsapp: string;
  affiliation?: string;
  notes?: string;
}

export function createSubmission(input: CreateSubmissionInput): SubmissionRequest {
  const items = readStore();
  const existingIds = new Set(items.map((i) => i.id));
  const id = generateTrackingId(existingIds);
  const now = new Date().toISOString();
  const defaultFee = input.submissionType === 'update_correction' ? 60 : input.edition === 'bilingual' ? 160 : 120;

  const created: SubmissionRequest = {
    id,
    submissionType: input.submissionType,
    edition: input.edition,
    proposedTitle: input.proposedTitle.trim(),
    summary: input.summary.trim(),
    referenceUrls: input.referenceUrls.map((u) => u.trim()).filter(Boolean),
    requesterName: input.requesterName.trim(),
    requesterEmail: input.requesterEmail.trim(),
    requesterWhatsapp: input.requesterWhatsapp.trim(),
    affiliation: input.affiliation?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    status: 'review',
    currency: 'USD',
    baseFee: defaultFee,
    discountPercent: 0,
    finalAmount: defaultFee,
    paymentStatus: 'unpaid',
    mediawikiDraftTitle: input.proposedTitle.trim().replace(/\s+/g, '_'),
    outreachLog: [
      {
        id: `out-${Date.now()}`,
        channel: 'system',
        summary: `Submission logged and assigned tracking ID ${id}.`,
        sentBy: 'System',
        sentAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  items.unshift(created);
  writeStore(items);
  return created;
}

export function submitPaymentProof(
  trackingId: string,
  paymentMethod: string,
  paymentReference: string
): SubmissionRequest | null {
  const items = readStore();
  const normalized = trackingId.trim().toUpperCase();
  const idx = items.findIndex((item) => item.id.toUpperCase() === normalized);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const current = items[idx];
  const updated: SubmissionRequest = {
    ...current,
    paymentMethod: paymentMethod.trim(),
    paymentReference: paymentReference.trim(),
    paymentStatus: 'proof_submitted',
    paymentSubmittedAt: now,
    updatedAt: now,
    outreachLog: [
      {
        id: `out-${Date.now()}`,
        channel: 'system',
        summary: `Requester submitted payment proof (${paymentMethod.trim()}: ${paymentReference.trim()}) for manual verification.`,
        sentBy: current.requesterName,
        sentAt: now,
      },
      ...current.outreachLog,
    ],
  };

  items[idx] = updated;
  writeStore(items);
  return updated;
}

export interface AdminUpdateInput {
  status?: SubmissionStatus;
  currency?: 'USD' | 'BDT';
  baseFee?: number;
  discountPercent?: number;
  discountReason?: string;
  paymentStatus?: PaymentVerificationStatus;
  paymentMethod?: string;
  paymentReference?: string;
  staffNotes?: string;
  mediawikiDraftTitle?: string;
  publishedArticleSlug?: string;
  publishedArticleUrl?: string;
  newOutreach?: {
    channel: OutreachLogEntry['channel'];
    summary: string;
    sentBy?: string;
  };
  verifiedBy?: string;
}

export function adminUpdateSubmission(
  trackingId: string,
  patch: AdminUpdateInput
): SubmissionRequest | null {
  const items = readStore();
  const normalized = trackingId.trim().toUpperCase();
  const idx = items.findIndex((item) => item.id.toUpperCase() === normalized);
  if (idx === -1) return null;

  const current = items[idx];
  const now = new Date().toISOString();

  const nextBaseFee = patch.baseFee !== undefined ? Math.max(0, patch.baseFee) : current.baseFee;
  const nextDiscount =
    patch.discountPercent !== undefined
      ? Math.min(100, Math.max(0, patch.discountPercent))
      : current.discountPercent;
  const nextFinalAmount = computeFinalAmount(nextBaseFee, nextDiscount);

  let nextPaymentStatus = patch.paymentStatus ?? current.paymentStatus;
  let nextStatus = patch.status ?? current.status;

  if (nextDiscount === 100 && nextPaymentStatus !== 'waived') {
    nextPaymentStatus = 'waived';
    if (nextStatus === 'awaiting_payment' || nextStatus === 'review') {
      nextStatus = 'fee_waived';
    }
  }

  const outreachAdditions: OutreachLogEntry[] = [];
  if (patch.newOutreach?.summary) {
    outreachAdditions.push({
      id: `out-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      channel: patch.newOutreach.channel,
      summary: patch.newOutreach.summary.trim(),
      sentBy: patch.newOutreach.sentBy || 'Editorial Staff',
      sentAt: now,
    });
  }

  if (patch.publishedArticleUrl && patch.publishedArticleUrl !== current.publishedArticleUrl) {
    outreachAdditions.push({
      id: `out-${Date.now() + 1}`,
      channel: 'system',
      summary: `Saved canonical public article link: ${patch.publishedArticleUrl}`,
      sentBy: patch.verifiedBy || 'Editorial Staff',
      sentAt: now,
    });
  }

  const updated: SubmissionRequest = {
    ...current,
    status: nextStatus,
    currency: patch.currency ?? current.currency,
    baseFee: nextBaseFee,
    discountPercent: nextDiscount,
    discountReason: patch.discountReason !== undefined ? patch.discountReason : current.discountReason,
    finalAmount: nextFinalAmount,
    paymentStatus: nextPaymentStatus,
    paymentMethod: patch.paymentMethod !== undefined ? patch.paymentMethod : current.paymentMethod,
    paymentReference: patch.paymentReference !== undefined ? patch.paymentReference : current.paymentReference,
    paymentVerifiedBy:
      nextPaymentStatus === 'verified' || nextPaymentStatus === 'waived'
        ? patch.verifiedBy || current.paymentVerifiedBy || 'Editorial Staff'
        : current.paymentVerifiedBy,
    paymentVerifiedAt:
      (nextPaymentStatus === 'verified' || nextPaymentStatus === 'waived') &&
      current.paymentStatus !== nextPaymentStatus
        ? now
        : current.paymentVerifiedAt,
    staffNotes: patch.staffNotes !== undefined ? patch.staffNotes : current.staffNotes,
    mediawikiDraftTitle:
      patch.mediawikiDraftTitle !== undefined ? patch.mediawikiDraftTitle : current.mediawikiDraftTitle,
    publishedArticleSlug:
      patch.publishedArticleSlug !== undefined ? patch.publishedArticleSlug : current.publishedArticleSlug,
    publishedArticleUrl:
      patch.publishedArticleUrl !== undefined ? patch.publishedArticleUrl : current.publishedArticleUrl,
    publishedAt:
      nextStatus === 'published' && !current.publishedAt ? now : current.publishedAt,
    outreachLog: [...outreachAdditions, ...current.outreachLog],
    updatedAt: now,
  };

  items[idx] = updated;
  writeStore(items);
  return updated;
}
