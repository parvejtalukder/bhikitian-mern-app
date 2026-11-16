import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { PaymentStatusText, StatusBadge } from '../components/StatusBadge.tsx';
import type {
  PaymentVerificationStatus,
  SubmissionRequest,
  SubmissionStatus,
} from '../types/index.ts';

export function AdminPage() {
  const [token, setToken] = useState<string>(() =>
    typeof window !== 'undefined' ? window.sessionStorage.getItem('bhikitia_staff_token') || '' : ''
  );
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [submissions, setSubmissions] = useState<SubmissionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Inspector form state
  const [editStatus, setEditStatus] = useState<SubmissionStatus>('review');
  const [editCurrency, setEditCurrency] = useState<'USD' | 'BDT'>('USD');
  const [editBaseFee, setEditBaseFee] = useState<number>(120);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editDiscountReason, setEditDiscountReason] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentVerificationStatus>('unpaid');
  const [editStaffNotes, setEditStaffNotes] = useState('');
  const [editPublishedSlug, setEditPublishedSlug] = useState('');
  const [editPublishedUrl, setEditPublishedUrl] = useState('');

  const [verifyingSlug, setVerifyingSlug] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [staffBaseUrl, setStaffBaseUrl] = useState('https://edit.bhikitia.org');
  const [publicBaseUrl, setPublicBaseUrl] = useState('https://en.bhikitia.org');

  const fetchSubmissions = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/submissions', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        window.sessionStorage.removeItem('bhikitia_staff_token');
        setToken('');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const list: SubmissionRequest[] = data.submissions || [];
        setSubmissions(list);
        if (list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Editorial Staff Console — Bhikitia';
    fetch('/api/config/contact')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          if (d.staffMediawikiUrl) setStaffBaseUrl(d.staffMediawikiUrl);
          if (d.publicSiteUrl) setPublicBaseUrl(d.publicSiteUrl);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (token) {
      fetchSubmissions(token);
    }
  }, [token]);

  const selectedRecord = useMemo(
    () => submissions.find((s) => s.id === selectedId) || null,
    [submissions, selectedId]
  );

  useEffect(() => {
    if (!selectedRecord) return;
    setEditStatus(selectedRecord.status);
    setEditCurrency(selectedRecord.currency);
    setEditBaseFee(selectedRecord.baseFee);
    setEditDiscount(selectedRecord.discountPercent);
    setEditDiscountReason(selectedRecord.discountReason || '');
    setEditPaymentStatus(selectedRecord.paymentStatus);
    setEditStaffNotes(selectedRecord.staffNotes || '');
    setEditPublishedSlug(
      selectedRecord.publishedArticleSlug || selectedRecord.mediawikiDraftTitle || ''
    );
    setEditPublishedUrl(selectedRecord.publishedArticleUrl || '');
    setVerifyFeedback(null);
    setSaveMessage(null);
  }, [selectedRecord]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }
      window.sessionStorage.setItem('bhikitia_staff_token', data.token);
      setToken(data.token);
      setPasscode('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login error.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    window.sessionStorage.removeItem('bhikitia_staff_token');
    setToken('');
    setSubmissions([]);
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          item.id.toLowerCase().includes(q) ||
          item.proposedTitle.toLowerCase().includes(q) ||
          item.requesterName.toLowerCase().includes(q) ||
          item.requesterEmail.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [submissions, statusFilter, searchTerm]);

  const computedFinal = useMemo(() => {
    const clampedFee = Math.max(0, editBaseFee || 0);
    const clampedDiscount = Math.min(100, Math.max(0, editDiscount || 0));
    return Math.round(clampedFee * (1 - clampedDiscount / 100) * 100) / 100;
  }, [editBaseFee, editDiscount]);

  const handleVerifyArticleSlug = async () => {
    const slug = editPublishedSlug.trim().replace(/\s+/g, '_');
    if (!slug) return;
    setVerifyingSlug(true);
    setVerifyFeedback(null);
    try {
      const res = await fetch(`/api/wiki/verify?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (data.exists) {
        setEditPublishedSlug(data.slug);
        setEditPublishedUrl(data.canonicalUrl);
        setVerifyFeedback(`Verified live on MediaWiki (Rev #${data.revId}): ${data.title}`);
      } else {
        setVerifyFeedback(`Article "${slug}" does not exist yet on MediaWiki.`);
      }
    } catch {
      setVerifyFeedback('Could not reach MediaWiki verification API.');
    } finally {
      setVerifyingSlug(false);
    }
  };

  const handleSaveChanges = async (
    overridePatch?: Record<string, unknown>,
    outreachSummary?: { channel: 'whatsapp' | 'email' | 'system'; summary: string }
  ) => {
    if (!selectedRecord) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        status: editStatus,
        currency: editCurrency,
        baseFee: Number(editBaseFee),
        discountPercent: Number(editDiscount),
        discountReason: editDiscountReason,
        paymentStatus: editPaymentStatus,
        staffNotes: editStaffNotes,
        publishedArticleSlug: editPublishedSlug.trim() || undefined,
        publishedArticleUrl: editPublishedUrl.trim() || undefined,
        ...overridePatch,
        ...(outreachSummary ? { newOutreach: outreachSummary } : {}),
      };

      const res = await fetch(`/api/admin/submissions/${encodeURIComponent(selectedRecord.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Update failed.');

      setSubmissions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSaveMessage('Changes saved and synced with tracker.');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = (amount: number, currency: 'USD' | 'BDT') =>
    currency === 'BDT' ? `৳${amount.toLocaleString()}` : `$${amount.toFixed(2)}`;

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 sm:px-6 pt-16 pb-20">
        <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-6 sm:p-8">
          <div className="flex items-center gap-2.5 text-[#0f1f38] dark:text-[#f8fafc]">
            <Lock className="h-5 w-5 text-[#1d4ed8] dark:text-sky-400" />
            <h1 className="font-editorial text-xl font-bold">Staff Editorial Console</h1>
          </div>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Authenticate to manage intake pricing, up to 100% fee waivers, manual payment verification,
            WhatsApp/email follow-up, and MediaWiki publication links.
          </p>

          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            {authError && (
              <div className="p-3 rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-200">
                {authError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1.5">Staff Passcode</label>
              <input
                required
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter staff passcode"
                className="w-full h-10 px-3 text-sm rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d] focus:outline-none focus:border-[#1d4ed8]"
              />
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Configured via <span className="font-mono-tabular">ADMIN_PASSCODE</span> (default preview:{' '}
                <button
                  type="button"
                  onClick={() => setPasscode('bhikitia-staff-2026')}
                  className="font-mono-tabular text-[#1d4ed8] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  bhikitia-staff-2026
                </button>
                )
              </p>
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-10 text-sm font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {authLoading ? 'Signing in...' : 'Open Editorial Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1340px] mx-auto px-4 sm:px-6 pt-8 pb-16">
      {/* Admin Header */}
      <div className="pb-5 border-b border-[#e2e8f0] dark:border-[#1e293b] flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#1d4ed8] dark:text-sky-400">
            Staff Operations · Protected Queue
          </p>
          <h1 className="mt-1 font-editorial text-2xl sm:text-3xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
            Editorial Intake, Pricing &amp; MediaWiki Handoff
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <a
            href={staffBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] transition-colors"
          >
            <span>Open MediaWiki ({staffBaseUrl.replace('https://', '')})</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => fetchSubmissions(token)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border border-[#cbd5e1] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border border-[#cbd5e1] dark:border-[#334155] hover:text-rose-600 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#f1f5f9] dark:bg-[#111827] rounded-lg border border-[#e2e8f0] dark:border-[#1e293b]">
          {(
            [
              ['all', 'All'],
              ['review', 'Review'],
              ['awaiting_payment', 'Awaiting Payment'],
              ['fee_waived', 'Fee Waived'],
              ['published', 'Published'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === val
                  ? 'bg-white dark:bg-[#1e293b] text-[#0f1f38] dark:text-[#f8fafc]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0f1f38]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by ID, title, or requester..."
            className="w-full h-9 pl-8 pr-3 text-xs rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#111827]"
          />
        </div>
      </div>

      {/* Main Split: High-Density Queue Table + Inspector */}
      <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg bg-white dark:bg-[#111827] overflow-hidden">
          <div className="overflow-x-auto max-h-[680px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#f8fafc] dark:bg-[#0a0f1d] text-slate-500 dark:text-slate-400 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <tr>
                  <th className="py-3 px-3 font-semibold">Tracking ID</th>
                  <th className="py-3 px-3 font-semibold">Article Title &amp; Requester</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold text-right">Fee / Disc.</th>
                  <th className="py-3 px-3 font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      No intake requests match your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((item) => {
                    const active = item.id === selectedId;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`cursor-pointer transition-colors ${
                          active
                            ? 'bg-blue-50/70 dark:bg-blue-950/30'
                            : 'hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b]/50'
                        }`}
                      >
                        <td className="py-3 px-3 font-mono-tabular font-semibold text-[#0f1f38] dark:text-[#f8fafc] whitespace-nowrap">
                          {item.id}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#0f1f38] dark:text-[#f8fafc] line-clamp-1">
                            {item.proposedTitle}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.requesterName} · {item.edition.toUpperCase()}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular whitespace-nowrap">
                          <div className="font-semibold text-[#0f1f38] dark:text-[#f8fafc]">
                            {formatMoney(item.finalAmount, item.currency)}
                          </div>
                          {item.discountPercent > 0 && (
                            <div className="text-[11px] text-violet-700 dark:text-violet-300">
                              {item.discountPercent}% off
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <PaymentStatusText status={item.paymentStatus} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Editorial & Billing Inspector */}
        <div className="xl:col-span-5">
          {!selectedRecord ? (
            <div className="p-6 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] text-sm text-slate-500">
              Select a submission from the queue to inspect pricing, payment verification, and MediaWiki publishing.
            </div>
          ) : (
            <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#111827] p-5 space-y-5">
              {/* Top Summary */}
              <div className="pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tabular text-xs font-bold text-[#1d4ed8] dark:text-sky-400">
                    {selectedRecord.id}
                  </span>
                  <Link
                    to={`/submit/track?id=${encodeURIComponent(selectedRecord.id)}`}
                    className="text-xs text-slate-500 hover:text-[#1d4ed8] inline-flex items-center gap-1"
                  >
                    <span>Public Tracker</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <h2 className="mt-1 font-editorial text-xl font-bold text-[#0f1f38] dark:text-[#f8fafc]">
                  {selectedRecord.proposedTitle}
                </h2>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedRecord.summary}
                </p>

                {selectedRecord.referenceUrls.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      Submitted Sources
                    </div>
                    {selectedRecord.referenceUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-[#1d4ed8] dark:text-sky-400 hover:underline truncate"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing & Discount up to 100% */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#0f1f38] dark:text-[#f8fafc]">
                    Pricing &amp; Fee Waiver (0% – 100%)
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditDiscount(100);
                      setEditPaymentStatus('waived');
                      setEditStatus('fee_waived');
                      setEditDiscountReason('100% Editorial / Public-Interest Waiver');
                    }}
                    className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:underline cursor-pointer"
                  >
                    Apply 100% Waiver
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Currency</label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value as 'USD' | 'BDT')}
                      className="w-full h-9 px-2.5 text-xs rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="BDT">BDT (৳)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Base Fee</label>
                    <input
                      type="number"
                      min={0}
                      value={editBaseFee}
                      onChange={(e) => setEditBaseFee(Number(e.target.value))}
                      className="w-full h-9 px-2.5 text-xs font-mono-tabular rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editDiscount}
                      onChange={(e) =>
                        setEditDiscount(Math.min(100, Math.max(0, Number(e.target.value))))
                      }
                      className="w-full h-9 px-2.5 text-xs font-mono-tabular rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                    />
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Number(e.target.value))}
                  aria-label="Discount percentage slider"
                  className="w-full accent-[#1d4ed8]"
                />

                <div className="flex items-center justify-between px-3 py-2 rounded bg-[#f8fafc] dark:bg-[#0a0f1d] border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Calculated Final Due</span>
                  <span className="font-mono-tabular font-bold text-sm text-[#0f1f38] dark:text-[#f8fafc]">
                    {formatMoney(computedFinal, editCurrency)}
                  </span>
                </div>

                <input
                  type="text"
                  value={editDiscountReason}
                  onChange={(e) => setEditDiscountReason(e.target.value)}
                  placeholder="Discount / waiver reason shown on public tracker..."
                  className="w-full h-9 px-3 text-xs rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                />
              </div>

              {/* Manual Payment Verification & Workflow Status */}
              <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Workflow Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as SubmissionStatus)}
                      className="w-full h-9 px-2.5 text-xs rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                    >
                      <option value="review">Under Review</option>
                      <option value="awaiting_payment">Awaiting Payment</option>
                      <option value="fee_waived">Fee Waived</option>
                      <option value="in_editorial">In Editorial Queue</option>
                      <option value="published">Published</option>
                      <option value="declined">Needs Sources</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Manual Payment Check
                    </label>
                    <select
                      value={editPaymentStatus}
                      onChange={(e) =>
                        setEditPaymentStatus(e.target.value as PaymentVerificationStatus)
                      }
                      className="w-full h-9 px-2.5 text-xs rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="proof_submitted">Proof Submitted</option>
                      <option value="verified">Verified</option>
                      <option value="waived">Waived (100%)</option>
                    </select>
                  </div>
                </div>

                {selectedRecord.paymentReference && (
                  <div className="p-2.5 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 text-xs flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold">Requester Proof:</span>{' '}
                      <span className="font-mono-tabular">
                        {selectedRecord.paymentMethod} · {selectedRecord.paymentReference}
                      </span>
                    </div>
                    {editPaymentStatus !== 'verified' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPaymentStatus('verified');
                          if (editStatus === 'awaiting_payment') {
                            setEditStatus('in_editorial');
                          }
                        }}
                        className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer shrink-0"
                      >
                        Mark Verified
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* MediaWiki Publishing & Save Public Link */}
              <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[#0f1f38] dark:text-[#f8fafc]">
                    MediaWiki Publishing Handoff
                  </h3>
                  <a
                    href={`${staffBaseUrl}/index.php?title=${encodeURIComponent(
                      (editPublishedSlug || selectedRecord.proposedTitle).replace(/\s+/g, '_')
                    )}&action=edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#1d4ed8] dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Draft in MediaWiki</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editPublishedSlug}
                    onChange={(e) => setEditPublishedSlug(e.target.value)}
                    placeholder="MediaWiki slug (e.g., A._K._Fazlul_Huq)"
                    className="flex-1 h-9 px-3 text-xs font-mono-tabular rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyArticleSlug}
                    disabled={verifyingSlug}
                    className="h-9 px-3 text-xs font-semibold rounded border border-[#cbd5e1] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b] inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-[#1d4ed8]" />
                    <span>{verifyingSlug ? 'Checking...' : 'Verify Live'}</span>
                  </button>
                </div>

                <input
                  type="url"
                  value={editPublishedUrl}
                  onChange={(e) => setEditPublishedUrl(e.target.value)}
                  placeholder={`${publicBaseUrl}/wiki/...`}
                  className="w-full h-9 px-3 text-xs font-mono-tabular rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                />

                {verifyFeedback && (
                  <div className="text-xs text-[#1d4ed8] dark:text-sky-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{verifyFeedback}</span>
                  </div>
                )}

                <textarea
                  rows={2}
                  value={editStaffNotes}
                  onChange={(e) => setEditStaffNotes(e.target.value)}
                  placeholder="Internal editorial & verification notes..."
                  className="w-full p-2.5 text-xs rounded border border-[#cbd5e1] dark:border-[#334155] bg-white dark:bg-[#0a0f1d]"
                />
              </div>

              {/* Follow-up & Save Actions */}
              <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://wa.me/${selectedRecord.requesterWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                      editStatus === 'published' && editPublishedUrl
                        ? `Hello ${selectedRecord.requesterName}, your Bhikitia article "${selectedRecord.proposedTitle}" (${selectedRecord.id}) is now published: ${editPublishedUrl}`
                        : `Hello ${selectedRecord.requesterName}, update on Bhikitia request ${selectedRecord.id} ("${selectedRecord.proposedTitle}"): Status is ${editStatus}. Final fee: ${formatMoney(computedFinal, editCurrency)} (${editDiscount}% discount). Track here: ${publicBaseUrl}/submit/track?id=${selectedRecord.id}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleSaveChanges(undefined, {
                        channel: 'whatsapp',
                        summary: `Opened WhatsApp follow-up with ${selectedRecord.requesterWhatsapp} (status: ${editStatus}, due: ${formatMoney(computedFinal, editCurrency)}).`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>WhatsApp Requester</span>
                  </a>

                  <a
                    href={`mailto:${selectedRecord.requesterEmail}?subject=${encodeURIComponent(
                      `[${selectedRecord.id}] Bhikitia Editorial Update: ${selectedRecord.proposedTitle}`
                    )}&body=${encodeURIComponent(
                      `Hello ${selectedRecord.requesterName},\n\nTracking ID: ${selectedRecord.id}\nStatus: ${editStatus}\nFinal Fee: ${formatMoney(computedFinal, editCurrency)} (${editDiscount}% discount)\n${
                        editPublishedUrl ? `Published Article URL: ${editPublishedUrl}\n` : ''
                      }\nBest regards,\nBhikitia Editorial Desk`
                    )}`}
                    onClick={() =>
                      handleSaveChanges(undefined, {
                        channel: 'email',
                        summary: `Drafted email follow-up to ${selectedRecord.requesterEmail} (status: ${editStatus}).`,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border border-[#cbd5e1] dark:border-[#334155] hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Email Requester</span>
                  </a>
                </div>

                {saveMessage && (
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {saveMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveChanges()}
                  disabled={saving}
                  className="w-full h-10 inline-flex items-center justify-center gap-2 text-xs font-semibold rounded bg-[#0f1f38] hover:bg-[#1d4ed8] text-white transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : 'Save Pricing, Verification & Public Link'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
