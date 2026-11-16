import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Copy,
  Mail,
  MessageCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import type { SubmissionRequest } from '../types/index.ts';

export function SubmitPage() {
  const [searchParams] = useSearchParams();
  const initialTitle = searchParams.get('title') || '';
  const initialType =
    (searchParams.get('type') as SubmissionRequest['submissionType']) || 'new_article';

  const [submissionType, setSubmissionType] =
    useState<SubmissionRequest['submissionType']>(initialType);
  const [edition, setEdition] = useState<SubmissionRequest['edition']>('en');
  const [proposedTitle, setProposedTitle] = useState(initialTitle);
  const [summary, setSummary] = useState('');
  const [referenceUrls, setReferenceUrls] = useState<string[]>(['', '']);
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterWhatsapp, setRequesterWhatsapp] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionRequest | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [contactCfg, setContactCfg] = useState({
    whatsappNumber: '8801700000000',
    editorialEmail: 'editorial@bhikitia.org',
  });

  useEffect(() => {
    document.title = 'Submit Article Request — Bhikitia';
    fetch('/api/config/contact')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setContactCfg(d);
      })
      .catch(() => {});
  }, []);

  const handleAddRef = () => {
    setReferenceUrls((prev) => [...prev, '']);
  };

  const handleUpdateRef = (idx: number, val: string) => {
    setReferenceUrls((prev) => prev.map((item, i) => (i === idx ? val : item)));
  };

  const handleRemoveRef = (idx: number) => {
    setReferenceUrls((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== idx)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionType,
          edition,
          proposedTitle,
          summary,
          referenceUrls: referenceUrls.map((u) => u.trim()).filter(Boolean),
          requesterName,
          requesterEmail,
          requesterWhatsapp,
          affiliation,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed.');
      }
      setReceipt(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = async () => {
    if (!receipt) return;
    await navigator.clipboard.writeText(receipt.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  if (receipt) {
    const waText = encodeURIComponent(
      `Hello Bhikitia Editorial Desk, I submitted an article request.\nTracking ID: ${receipt.id}\nArticle Title: ${receipt.proposedTitle}\nEdition: ${receipt.edition.toUpperCase()}`
    );
    const emailSubject = encodeURIComponent(`[${receipt.id}] Bhikitia Article Request: ${receipt.proposedTitle}`);
    const emailBody = encodeURIComponent(
      `Hello Bhikitia Editorial Desk,\n\nI have submitted an article intake request:\n- Tracking ID: ${receipt.id}\n- Proposed Title: ${receipt.proposedTitle}\n- WhatsApp: ${receipt.requesterWhatsapp}\n\nPlease let me know once editorial review and pricing/waiver evaluation are complete.`
    );

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-16">
        <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6 sm:p-8">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-[0.06em]">
              Intake Logged Successfully
            </span>
          </div>

          <h1 className="mt-3 font-editorial text-2xl sm:text-3xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
            Your Tracking ID is ready
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Save this Tracking ID to monitor editorial review, fee waiver or pricing updates, payment
            verification, and your published <span className="font-mono-tabular">en.bhikitia.org</span> link.
          </p>

          <div className="mt-6 p-4 rounded-lg border border-[#cbd5e1] dark:border-[#334155] bg-[#f8fafc] dark:bg-[#0a0f1d] flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                Tracking ID
              </div>
              <div className="mt-0.5 text-2xl font-bold font-mono-tabular text-[#0f1f38] dark:text-[#f8fafc]">
                {receipt.id}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] cursor-pointer"
            >
              {copiedId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>

          <dl className="mt-6 divide-y divide-[#e2e8f0] dark:divide-[#1e293b] text-sm">
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Proposed Title</dt>
              <dd className="font-semibold text-right">{receipt.proposedTitle}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Requester</dt>
              <dd className="text-right">{receipt.requesterName}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">Follow-up Channels</dt>
              <dd className="text-right font-mono-tabular text-xs">
                {receipt.requesterWhatsapp} · {receipt.requesterEmail}
              </dd>
            </div>
          </dl>

          <div className="mt-7 pt-6 border-t border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center gap-3">
            <Link
              to={`/submit/track?id=${encodeURIComponent(receipt.id)}`}
              className="px-4 py-2.5 text-sm font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors"
            >
              Open Live Tracker
            </Link>
            <a
              href={`https://wa.me/${contactCfg.whatsappNumber.replace(/\D/g, '')}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>WhatsApp Follow-up</span>
            </a>
            <a
              href={`mailto:${contactCfg.editorialEmail}?subject=${emailSubject}&body=${emailBody}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded border border-[#cbd5e1] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>Email Editorial Desk</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8">
          <div className="pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#1d4ed8] dark:text-sky-400">
              Editorial Request Intake
            </p>
            <h1 className="mt-2 font-editorial text-2xl sm:text-3xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
              Submit an Article or Correction Request
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Provide verifiable independent sources and your WhatsApp/email contact details. Bhikitia
              editors verify notability, set transparent fees or grant up to a 100% scholarly/public-interest
              waiver, and publish directly through MediaWiki.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {error && (
              <div className="p-3.5 rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-800 dark:text-rose-200">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                  Request Type
                </label>
                <select
                  value={submissionType}
                  onChange={(e) => setSubmissionType(e.target.value as SubmissionRequest['submissionType'])}
                  className="w-full h-10 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
                >
                  <option value="new_article">New Encyclopedia Article</option>
                  <option value="biography">Biography / Public Figure</option>
                  <option value="organization">Organization / Institution</option>
                  <option value="update_correction">Update / Correction to Existing Page</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                  Target Language Edition
                </label>
                <select
                  value={edition}
                  onChange={(e) => setEdition(e.target.value as SubmissionRequest['edition'])}
                  className="w-full h-10 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
                >
                  <option value="en">English (en.bhikitia.org)</option>
                  <option value="bn">Bengali (bn.bhikitia.org)</option>
                  <option value="bilingual">Bilingual (English + বাংলা)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                Proposed Article Title <span className="text-rose-600">*</span>
              </label>
              <input
                required
                type="text"
                value={proposedTitle}
                onChange={(e) => setProposedTitle(e.target.value)}
                placeholder="e.g., Sylhet Heritage Research Archive"
                className="w-full h-10 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                Subject Summary &amp; Encyclopedic Scope <span className="text-rose-600">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summarize key verified facts, chronology, significance, or requested edits..."
                className="w-full p-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc]">
                  Independent Reference URLs / Citations
                </label>
                <button
                  type="button"
                  onClick={handleAddRef}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1d4ed8] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add source</span>
                </button>
              </div>
              <div className="space-y-2">
                {referenceUrls.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleUpdateRef(idx, e.target.value)}
                      placeholder="https://..."
                      className="flex-1 h-9 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
                    />
                    {referenceUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRef(idx)}
                        aria-label="Remove reference URL"
                        className="h-9 w-9 inline-flex items-center justify-center rounded border border-[#e2e8f0] dark:border-[#334155] text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                  Requester Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="Dr. / Mr. / Ms. Full Name"
                  className="w-full h-10 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                  Email Address <span className="text-rose-600">*</span>
                </label>
                <input
                  required
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  placeholder="name@organization.org"
                  className="w-full h-10 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                  WhatsApp Number (with country code) <span className="text-rose-600">*</span>
                </label>
                <input
                  required
                  type="tel"
                  value={requesterWhatsapp}
                  onChange={(e) => setRequesterWhatsapp(e.target.value)}
                  placeholder="+88017XXXXXXXX"
                  className="w-full h-10 px-3 text-sm font-mono-tabular rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                  Organization / Affiliation (Optional)
                </label>
                <input
                  type="text"
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  placeholder="University, Foundation, or Press Desk"
                  className="w-full h-10 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0f1f38] dark:text-[#f8fafc] mb-1.5">
                Additional Notes or Fee Waiver Justification (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Non-profit archive or academic grant request"
                className="w-full h-10 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-sm font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Generating Tracking ID...' : 'Submit Intake Request'}
              </button>
              <Link
                to="/submit/track"
                className="text-sm font-medium text-[#1d4ed8] dark:text-sky-400 hover:underline"
              >
                Already have a Tracking ID?
              </Link>
            </div>
          </form>
        </div>

        {/* Right Editorial Guidance Column */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="p-5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#111827]">
            <h2 className="font-editorial text-base font-bold text-[#0f1f38] dark:text-[#f8fafc]">
              How Editorial Intake Works
            </h2>
            <ol className="mt-3 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>
                <span className="font-semibold text-[#0f1f38] dark:text-[#f8fafc]">1. Tracking ID Issued:</span>{' '}
                Your request immediately receives a unique <span className="font-mono-tabular">BHK-YYYY-XXXX</span> code.
              </li>
              <li>
                <span className="font-semibold text-[#0f1f38] dark:text-[#f8fafc]">2. Pricing &amp; Waivers:</span>{' '}
                Editors verify sources, assign standard review pricing or apply discounts up to 100% (fee waived).
              </li>
              <li>
                <span className="font-semibold text-[#0f1f38] dark:text-[#f8fafc]">3. Manual Payment Verification:</span>{' '}
                Submit your bKash, Nagad, or bank reference on the tracker for staff sign-off.
              </li>
              <li>
                <span className="font-semibold text-[#0f1f38] dark:text-[#f8fafc]">4. MediaWiki Publication:</span>{' '}
                Staff draft and publish via <span className="font-mono-tabular">edit.bhikitia.org</span> and attach the live public <span className="font-mono-tabular">en.bhikitia.org/wiki/...</span> link back to your tracker.
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
