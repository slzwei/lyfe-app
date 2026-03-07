'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AgencyEvent, EVENT_TYPE_LABELS } from '@/lib/types';

export interface RoadshowData {
  config: {
    weekly_cost: number;
    slots_per_day: number;
    expected_start_time: string;
    suggested_sitdowns: number;
    suggested_pitches: number;
    suggested_closed: number;
  } | null;
  attendance: {
    full_name: string;
    checked_in_at: string;
    is_late: boolean;
    pledged_sitdowns: number;
    pledged_pitches: number;
    pledged_closed: number;
  }[];
  activities: {
    full_name: string;
    type: string;
    afyc_amount: number | null;
    logged_at: string;
  }[];
}

interface EventDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AgencyEvent | null;
  attendees: { full_name: string; attendee_role: string }[];
  roadshowData?: RoadshowData;
}

export function EventDetailSheet({ open, onOpenChange, event, attendees, roadshowData }: EventDetailSheetProps) {
  if (!event) return null;

  const isRoadshow = event.event_type === 'roadshow';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{event.title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Type</p>
              <Badge variant="outline">{EVENT_TYPE_LABELS[event.event_type]}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p>{format(new Date(event.event_date), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Time</p>
              <p>{event.start_time}{event.end_time ? ` - ${event.end_time}` : ''}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Location</p>
              <p>{event.location || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Creator</p>
              <p>{event.creator_name || '-'}</p>
            </div>
          </div>

          {event.description && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{event.description}</p>
              </div>
            </>
          )}

          <Separator />
          <div>
            <h4 className="text-sm font-semibold mb-2">Attendees ({attendees.length})</h4>
            {attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendees</p>
            ) : (
              <div className="space-y-1">
                {attendees.map((a, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{a.full_name}</span>
                    <Badge variant="secondary" className="text-xs">{a.attendee_role}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isRoadshow && roadshowData && (
            <>
              <Separator />
              <RoadshowStats data={roadshowData} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoadshowStats({ data }: { data: RoadshowData }) {
  const { config, attendance, activities } = data;

  const sitdowns = activities.filter((a) => a.type === 'sitdown').length;
  const pitches = activities.filter((a) => a.type === 'pitch').length;
  const closed = activities.filter((a) => a.type === 'case_closed').length;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">Roadshow Details</h4>

      {config && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Weekly Cost</p>
            <p>${Number(config.weekly_cost).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Slots/Day</p>
            <p>{config.slots_per_day}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Targets (S/P/C)</p>
            <p>{config.suggested_sitdowns}/{config.suggested_pitches}/{config.suggested_closed}</p>
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium mb-1">Activity Summary</p>
        <div className="flex gap-4 text-sm">
          <span>Sitdowns: <strong>{sitdowns}</strong></span>
          <span>Pitches: <strong>{pitches}</strong></span>
          <span>Closed: <strong>{closed}</strong></span>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">Attendance ({attendance.length})</p>
        {attendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-ins</p>
        ) : (
          <div className="space-y-1">
            {attendance.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{a.full_name}</span>
                <div className="flex items-center gap-2">
                  {a.is_late && <Badge variant="destructive" className="text-xs">Late</Badge>}
                  <span className="text-muted-foreground text-xs">
                    S:{a.pledged_sitdowns} P:{a.pledged_pitches} C:{a.pledged_closed}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
