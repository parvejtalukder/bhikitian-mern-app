export type SubmissionStatus =
  | 'review'
  | 'awaiting_payment'
  | 'fee_waived'
  | 'in_editorial'
  | 'published'
  | 'declined';

export type PaymentVerificationStatus =
  | 'unpaid'
  | 'proof_submitted'
  | 'verified'
  | 'waived';

export interface OutreachLogEntry {
  id: string;
  channel: 'whatsapp' | 'email' | 'system';
  summary: string;
  sentBy: string;
  sentAt: string;
}

export interface SubmissionRequest {
  id: string; // Tracking ID e.g. BHK-2026-8412
  submissionType: 'new_article' | 'biography' | 'organization' | 'update_correction';
  edition: 'en' | 'bn' | 'bilingual';
  proposedTitle: string;
  summary: string;
  referenceUrls: string[];
  requesterName: string;
  requesterEmail: string;
  requesterWhatsapp: string;
  affiliation?: string;
  notes?: string;
  status: SubmissionStatus;
  currency: 'USD' | 'BDT';
  baseFee: number;
  discountPercent: number; // 0 to 100
  discountReason?: string;
  finalAmount: number;
  paymentStatus: PaymentVerificationStatus;
  paymentMethod?: string;
  paymentReference?: string;
  paymentSubmittedAt?: string;
  paymentVerifiedBy?: string;
  paymentVerifiedAt?: string;
  staffNotes?: string;
  mediawikiDraftTitle?: string;
  publishedArticleSlug?: string;
  publishedArticleUrl?: string;
  publishedAt?: string;
  outreachLog: OutreachLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface WikiSection {
  index: string;
  level: string;
  line: string;
  number: string;
  anchor: string;
}

export interface WikiArticleResponse {
  exists: boolean;
  slug: string;
  title: string;
  displayTitle: string;
  pageId?: number;
  revId?: number;
  lastModified?: string;
  lastEditor?: string;
  canonicalUrl: string;
  editUrl: string;
  /** Public URL of the original article on the MediaWiki source wiki. */
  sourceUrl?: string;
  /** Present only when a verified revision id and revision URL are available. */
  revisionUrl?: string;
  redirectedFrom?: string;
  html?: string;
  infoboxHtml?: string | null;
  sections: WikiSection[];
  categories: string[];
  langLinks: { lang: string; autonym: string; title: string; url: string }[];
  suggestions?: { title: string; slug: string; snippet: string }[];
  cacheStatus: 'HIT' | 'MISS' | 'REVALIDATED' | 'STALE';
  fetchedAt: string;
}

export interface WikiRevision {
  revid: number;
  parentid: number;
  user: string;
  timestamp: string;
  size: number;
  comment: string;
}

export interface WikiSearchResult {
  pageid: number;
  title: string;
  slug: string;
  snippet: string;
  wordcount: number;
  timestamp: string;
}
