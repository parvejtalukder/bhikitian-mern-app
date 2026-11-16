import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Mail,
  MessageCircle,
  Search,
} from 'lucide-react';
import { PaymentStatusText, StatusBadge } from '../components/StatusBadge.tsx';
import type { SubmissionRequest } from '../types/index.ts';

const SAMPLE_IDS = [
  { id: 'BHK-2026-4102', note: 'Published (100% Waived)' },
  { id: 'BHK-2026-5289', note: 'Awaiting Payment (25% off)' },
  { id: 'BHK-2026-6731', note: 'Fee Waived (100%)' },
  { id: 'BHK-2026-7904', note: 'Under Review' },
];

export function TrackPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id') || 'BHK-2026-5289';

  const [inputId, setInputId] = useState(initialId);
  const [record, setRecord] = useState<SubmissionRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState('bKash Merchant');
  const [paymentReference, setPaymentReference] = useState('');
  const [proofLoading, setProofLoading] = useState(false);
  const [proofMessage, setProofMessage] = useState<string | null>(null);

  const [contactCfg, setContactCfg] = useState({
    whatsappNumber: '8801700000000',
    editorialEmail: 'editorial@bhikitia.org',
  });

  const lookupTrackingId = async (idToFetch: string) => {
    const clean = idToFetch.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    setProofMessage(null);
    try {
      const res = await fetch(`/api/submissions/track/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) {
        setRecord(null);
        throw new Error(data.error || 'Tracking ID not found.');
      }
      setRecord(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to locate request.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Track Submission — Bhikitia';
    fetch('/api/config/contact')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setContactCfg(d);
      })
      .catch(() => {});
    if (initialId) {
      lookupTrackingId(initialId);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputId.trim().toUpperCase();
    if (!clean) return;
    setSearchParams({ id: clean });
    lookupTrackingId(clean);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    setProofLoading(true);
    setProofMessage(null);
    try {
      const res = await fetch(
        `/api/submissions/track/${encodeURIComponent(record.id)}/payment-proof`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethod, paymentReference }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit payment proof.');
      }
      setRecord(data);
      setPaymentReference('');
      setProofMessage('Payment reference submitted. Editorial staff will verify it manually.');
    } catch (err) {
      setProofMessage(err instanceof Error ? err.message : 'Error saving payment proof.');
    } finally {
      setProofLoading(false);
    }
  };

  const formatMoney = (amount: number, currency: 'USD' | 'BDT') =>
    currency === 'BDT' ? `৳${amount.toLocaleString()}` : `$${amount.toFixed(2)}`;

  const waFollowupUrl = record
    ? `https://wa.me/${contactCfg.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hello Bhikitia Desk, following up on Tracking ID ${record.id} ("${record.proposedTitle}"). Current status: ${record.status}.`
      )}`
    : '#';

  const mailFollowupUrl = record
    ? `mailto:${contactCfg.editorialEmail}?subject=${encodeURIComponent(
        `[${record.id}] Follow-up: ${record.proposedTitle}`
      )}&body=${encodeURIComponent(
        `Hello Bhikitia Editorial Desk,\n\nI am checking in on submission ${record.id} (${record.proposedTitle}).`
      )}`
    : '#';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-16">
      <div className="pb-6 border-b border-[#e2e8f0] dark:border-[#1e293b]">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#1d4ed8] dark:text-sky-400">
          Public Submission Tracker
        </p>
        <h1 className="mt-2 font-editorial text-2xl sm:text-3xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
          Track Article Request &amp; Payment Status
        </h1>

        <form onSubmit={handleSearchSubmit} className="mt-5 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              placeholder="Enter Tracking ID (e.g., BHK-2026-5289)"
              className="w-full h-11 pl-9 pr-3 text-sm font-mono-tabular uppercase rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] focus:outline-none focus:border-[#1d4ed8]"
            />
          </div>
          <button
            type="submit"
            className="h-11 px-5 text-sm font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Track Request
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Sample IDs:</span>
          {SAMPLE_IDS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setInputId(sample.id);
                setSearchParams({ id: sample.id });
                lookupTrackingId(sample.id);
              }}
              className="px-2.5 py-1 rounded border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] hover:border-[#1d4ed8] text-[#0f1f38] dark:text-[#f8fafc] font-mono-tabular cursor-pointer"
            >
              {sample.id} · {sample.note}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 h-64 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
      ) : error ? (
        <div className="mt-6 p-6 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-800 dark:text-rose-200">
          {error}
        </div>
      ) : record ? (
        <div className="mt-6 space-y-6">
          {/* Header Status Card */}
          <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                  {record.id} · {record.edition.toUpperCase()} Edition
                </div>
                <h2 className="mt-1 font-editorial text-2xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
                  {record.proposedTitle}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  {record.summary}
                </p>
              </div>
              <StatusBadge status={record.status} />
            </div>

            {/* Published Article Link Callout */}
            {record.publishedArticleUrl && (
              <div className="mt-5 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.04em] text-emerald-800 dark:text-emerald-300">
                      Published on Bhikitia
                    </div>
                    <div className="text-sm font-mono-tabular text-[#0f1f38] dark:text-[#f8fafc] break-all">
                      {record.publishedArticleUrl}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {record.publishedArticleSlug && (
                    <Link
                      to={`/wiki/${encodeURIComponent(record.publishedArticleSlug)}`}
                      className="px-3.5 py-2 text-xs font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors whitespace-nowrap"
                    >
                      Read Article
                    </Link>
                  )}
                  <a
                    href={record.publishedArticleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d] hover:bg-[#f1f5f9]"
                  >
                    <span>Open External</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Follow-up Buttons */}
            <div className="mt-5 pt-5 border-t border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Requester: <span className="font-semibold text-[#0f1f38] dark:text-[#f8fafc]">{record.requesterName}</span>
                {record.affiliation ? ` (${record.affiliation})` : ''}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={waFollowupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>WhatsApp Desk</span>
                </a>
                <a
                  href={mailFollowupUrl}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded border border-[#cbd5e1] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Email Desk</span>
                </a>
              </div>
            </div>
          </div>

          {/* Pricing, Discount & Manual Payment Verification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6">
              <h3 className="font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc]">
                Editorial Pricing &amp; Waiver
              </h3>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">Base Review Fee</dt>
                  <dd className="font-mono-tabular">{formatMoney(record.baseFee, record.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">
                    Discount ({record.discountPercent}%)
                  </dt>
                  <dd className="font-mono-tabular text-violet-700 dark:text-violet-300">
                    -{formatMoney(record.baseFee - record.finalAmount, record.currency)}
                  </dd>
                </div>
                {record.discountReason && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {record.discountReason}
                  </div>
                )}
                <div className="pt-2.5 border-t border-[#e2e8f0] dark:border-[#1e293b] flex justify-between font-bold text-[#0f1f38] dark:text-[#f8fafc]">
                  <dt>Final Payable Amount</dt>
                  <dd className="font-mono-tabular text-base">
                    {formatMoney(record.finalAmount, record.currency)}
                  </dd>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <dt className="text-slate-500 dark:text-slate-400 text-xs">Verification State</dt>
                  <dd>
                    <PaymentStatusText status={record.paymentStatus} />
                  </dd>
                </div>
              </dl>

              {record.paymentReference && (
                <div className="mt-4 p-3 rounded bg-[#f8fafc] dark:bg-[#0a0f1d] border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
                  <div className="text-slate-500 dark:text-slate-400">Submitted Reference</div>
                  <div className="mt-0.5 font-mono-tabular font-semibold text-[#0f1f38] dark:text-[#f8fafc]">
                    {record.paymentMethod} · {record.paymentReference}
                  </div>
                </div>
              )}
            </div>

            {/* Manual Payment Proof Form */}
            <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6">
              <h3 className="font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc]">
                Manual Payment Verification
              </h3>
              {record.finalAmount === 0 || record.paymentStatus === 'waived' ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  No payment is required. A 100% fee waiver has been applied to this submission.
                </p>
              ) : record.paymentStatus === 'verified' ? (
                <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Payment verified by {record.paymentVerifiedBy || 'Editorial Staff'}. Your entry is
                  proceeding through MediaWiki publication.
                </p>
              ) : (
                <form onSubmit={handleSubmitProof} className="mt-3 space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Transfer {formatMoney(record.finalAmount, record.currency)} via bKash Merchant, Nagad,
                    or Bank Wire, then submit your Transaction ID below for manual staff verification.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Payment Channel</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-9 px-3 text-xs rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                    >
                      <option value="bKash Merchant">bKash Merchant</option>
                      <option value="Nagad">Nagad</option>
                      <option value="Bank Transfer (BDT)">Bank Transfer (BDT)</option>
                      <option value="International Wire / Wise">International Wire / Wise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Transaction ID / Receipt Ref</label>
                    <input
                      required
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="e.g., TRX9B44K208M"
                      className="w-full h-9 px-3 text-xs font-mono-tabular rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                    />
                  </div>
                  {proofMessage && (
                    <div className="text-xs text-[#1d4ed8] dark:text-sky-400">{proofMessage}</div>
                  )}
                  <button
                    type="submit"
                    disabled={proofLoading}
                    className="w-full h-9 text-xs font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {proofLoading ? 'Submitting...' : 'Submit Payment Proof'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Outreach & Audit Log */}
          <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6">
            <h3 className="font-editorial text-lg font-bold text-[#0f1f38] dark:text-[#f8fafc] mb-4">
              Activity &amp; Follow-up Timeline
            </h3>
            <ul className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
              {record.outreachLog.map((item) => (
                <li key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold uppercase tracking-[0.04em] text-[#1d4ed8] dark:text-sky-400 mr-2">
                      {item.channel}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">{item.summary}</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono-tabular whitespace-nowrap">
                    {item.sentBy} · {new Date(item.sentAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
