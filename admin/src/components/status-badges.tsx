'use client';

import { Badge } from '@/components/ui/badge';
import {
  LeadStatus,
  CandidateStatus,
  LEAD_STATUS_LABELS,
  CANDIDATE_STATUS_LABELS,
} from '@/lib/types';

const GREEN_BADGE = 'bg-green-100 text-green-800 border-transparent hover:bg-green-100';

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  switch (status) {
    case 'new':
      return <Badge variant="default">{LEAD_STATUS_LABELS[status]}</Badge>;
    case 'won':
      return <Badge className={GREEN_BADGE}>{LEAD_STATUS_LABELS[status]}</Badge>;
    case 'lost':
      return <Badge variant="destructive">{LEAD_STATUS_LABELS[status]}</Badge>;
    default:
      return <Badge variant="secondary">{LEAD_STATUS_LABELS[status]}</Badge>;
  }
}

export function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  switch (status) {
    case 'active_agent':
      return <Badge className={GREEN_BADGE}>{CANDIDATE_STATUS_LABELS[status]}</Badge>;
    case 'applied':
      return <Badge variant="default">{CANDIDATE_STATUS_LABELS[status]}</Badge>;
    case 'approved':
      return <Badge variant="outline">{CANDIDATE_STATUS_LABELS[status]}</Badge>;
    default:
      return <Badge variant="secondary">{CANDIDATE_STATUS_LABELS[status]}</Badge>;
  }
}
