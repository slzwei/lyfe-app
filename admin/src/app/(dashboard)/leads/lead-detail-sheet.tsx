'use client';

import { formatDistanceToNow, format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { DetailRow } from '@/components/detail-row';
import { LeadStatusBadge } from '@/components/status-badges';
import {
  Lead,
  LeadActivity,
  LEAD_SOURCE_LABELS,
  PRODUCT_INTEREST_LABELS,
} from '@/lib/types';

interface LeadDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  activities: LeadActivity[];
}

export function LeadDetailSheet({ open, onOpenChange, lead, activities }: LeadDetailSheetProps) {
  const leadActivities = lead
    ? [...activities]
        .filter((a) => a.lead_id === lead.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>{lead.full_name}</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Phone" value={lead.phone ?? '—'} />
                <DetailRow label="Email" value={lead.email ?? '—'} />
                <DetailRow
                  label="Source"
                  value={lead.source ? <Badge variant="outline">{LEAD_SOURCE_LABELS[lead.source]}</Badge> : '—'}
                />
                <DetailRow label="Status" value={<LeadStatusBadge status={lead.status} />} />
                <DetailRow
                  label="Product Interest"
                  value={lead.product_interest ? <Badge variant="outline">{PRODUCT_INTEREST_LABELS[lead.product_interest]}</Badge> : '—'}
                />
                <DetailRow label="Assigned To" value={lead.assigned_to_name ?? '—'} />
              </div>

              {lead.notes && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</span>
                  <p className="text-sm whitespace-pre-line rounded-md bg-muted px-3 py-2">{lead.notes}</p>
                </div>
              )}

              <DetailRow label="Created" value={format(new Date(lead.created_at), 'dd MMM yyyy')} />

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Activity Timeline</h3>
                {leadActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {leadActivities.map((activity) => (
                      <div key={activity.id} className="flex flex-col gap-1 border-l-2 border-muted pl-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{activity.type.replace(/_/g, ' ')}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {activity.description && <p className="text-sm">{activity.description}</p>}
                        {activity.user_name && <span className="text-xs text-muted-foreground">by {activity.user_name}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
