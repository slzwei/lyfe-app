'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DetailRow } from '@/components/detail-row';
import { CandidateStatusBadge } from '@/components/status-badges';
import {
  Candidate,
  CandidateActivity,
  CandidateActivityType,
  Interview,
  InterviewStatus,
  CANDIDATE_STATUS_LABELS,
} from '@/lib/types';

const INTERVIEW_STATUS_VARIANT: Record<InterviewStatus, React.ComponentProps<typeof Badge>['variant']> = {
  scheduled: 'default',
  completed: 'secondary',
  cancelled: 'outline',
  rescheduled: 'secondary',
};

const ACTIVITY_TYPE_LABELS: Record<CandidateActivityType, string> = {
  call: 'Call',
  whatsapp: 'WhatsApp',
  note: 'Note',
};

interface CandidateDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate | null;
  interviews: Interview[];
  activities: CandidateActivity[];
}

export function CandidateDetailSheet({ open, onOpenChange, candidate, interviews, activities }: CandidateDetailSheetProps) {
  if (!candidate) return null;

  const sortedActivities = [...activities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>{candidate.name}</SheetTitle>
          <SheetDescription>{candidate.phone}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Candidate Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Status" value={<CandidateStatusBadge status={candidate.status} />} />
              <DetailRow label="Email" value={candidate.email} />
              <DetailRow label="Assigned Manager" value={candidate.assigned_manager_name} />
              <DetailRow label="Created By" value={candidate.created_by_name} />
              <DetailRow label="Created" value={format(new Date(candidate.created_at), 'dd MMM yyyy')} />
            </div>
            {candidate.notes && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Notes</span>
                <p className="text-sm whitespace-pre-wrap rounded-md bg-muted px-3 py-2">{candidate.notes}</p>
              </div>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interviews</h3>
            {interviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No interviews recorded.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {interviews.map((iv) => (
                  <div key={iv.id} className="rounded-md border px-3 py-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Round {iv.round_number}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="capitalize">{iv.type === 'zoom' ? 'Zoom' : 'In Person'}</Badge>
                        <Badge variant={INTERVIEW_STATUS_VARIANT[iv.status]} className="capitalize">{iv.status.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(iv.datetime), 'dd MMM yyyy, h:mm a')}</span>
                    {iv.location && <span className="text-xs text-muted-foreground">Location: {iv.location}</span>}
                    {iv.zoom_link && (
                      <a href={iv.zoom_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate">
                        {iv.zoom_link}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity Timeline</h3>
            {sortedActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {sortedActivities.map((act) => (
                  <div key={act.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1.5" />
                      <div className="flex-1 w-px bg-border mt-1" />
                    </div>
                    <div className="flex flex-col gap-0.5 pb-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{ACTIVITY_TYPE_LABELS[act.type]}</Badge>
                        {act.outcome && <span className="text-xs text-muted-foreground capitalize">{act.outcome}</span>}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {act.user_name && <span className="text-xs text-muted-foreground">by {act.user_name}</span>}
                      {act.note && <p className="text-sm mt-0.5 whitespace-pre-wrap">{act.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
