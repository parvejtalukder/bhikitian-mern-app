import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileEdit,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { PaymentVerificationStatus, SubmissionStatus } from '../types/index.ts';

const STATUS_META: Record<
  SubmissionStatus,
  {
    label: string;
    classes: string;
    Icon: typeof Clock;
  }
> = {
  review: {
    label: 'Under Review',
    classes:
      'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd] dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    Icon: Clock,
  },
  awaiting_payment: {
    label: 'Awaiting Payment',
    classes:
      'bg-[#fef3c7] text-[#92400e] border-[#fde68a] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    Icon: CreditCard,
  },
  fee_waived: {
    label: 'Fee Waived',
    classes:
      'bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe] dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    Icon: Sparkles,
  },
  in_editorial: {
    label: 'In Editorial Queue',
    classes:
      'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd] dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    Icon: FileEdit,
  },
  published: {
    label: 'Published',
    classes:
      'bg-[#dcfce7] text-[#15803d] border-[#bbf7d0] dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    Icon: CheckCircle2,
  },
  declined: {
    label: 'Needs Sources',
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    Icon: XCircle,
  },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const meta = STATUS_META[status] || STATUS_META.review;
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] uppercase whitespace-nowrap shrink-0 ${meta.classes}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

const PAYMENT_LABELS: Record<PaymentVerificationStatus, { label: string; classes: string }> = {
  unpaid: {
    label: 'Unpaid',
    classes: 'text-slate-600 dark:text-slate-400',
  },
  proof_submitted: {
    label: 'Proof Submitted',
    classes: 'text-amber-700 dark:text-amber-300 font-semibold',
  },
  verified: {
    label: 'Verified',
    classes: 'text-emerald-700 dark:text-emerald-300 font-semibold',
  },
  waived: {
    label: '100% Waived',
    classes: 'text-violet-700 dark:text-violet-300 font-semibold',
  },
};

export function PaymentStatusText({ status }: { status: PaymentVerificationStatus }) {
  const meta = PAYMENT_LABELS[status] || PAYMENT_LABELS.unpaid;
  return <span className={`text-xs ${meta.classes}`}>{meta.label}</span>;
}
