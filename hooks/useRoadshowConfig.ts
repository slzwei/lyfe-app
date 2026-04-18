/**
 * Hook encapsulating roadshow configuration state for event creation.
 * Manages date range, cost, slots, grace period, and suggested targets.
 */
import { type Dispatch, type SetStateAction, useCallback, useState } from 'react';
import { todayLocalStr } from '@/lib/dateTime';
import type { RoadshowConfig } from '@/types/event';

interface RoadshowConfigState {
    rsStartDate: string;
    setRsStartDate: (v: string) => void;
    rsEndDate: string;
    setRsEndDate: (v: string) => void;
    rsWeeklyCost: string;
    setRsWeeklyCost: (v: string) => void;
    rsSlots: number;
    setRsSlots: Dispatch<SetStateAction<number>>;
    rsGrace: number;
    setRsGrace: Dispatch<SetStateAction<number>>;
    rsSitdowns: number;
    setRsSitdowns: Dispatch<SetStateAction<number>>;
    rsPitches: number;
    setRsPitches: Dispatch<SetStateAction<number>>;
    rsClosed: number;
    setRsClosed: Dispatch<SetStateAction<number>>;
    rsConfigLocked: boolean;
    setRsConfigLocked: (v: boolean) => void;
    populateFromExisting: (config: RoadshowConfig, eventDate: string) => void;
}

export function useRoadshowConfig(): RoadshowConfigState {
    const [rsStartDate, setRsStartDate] = useState(todayLocalStr());
    const [rsEndDate, setRsEndDate] = useState(todayLocalStr());
    const [rsWeeklyCost, setRsWeeklyCost] = useState('');
    const [rsSlots, setRsSlots] = useState(3);
    const [rsGrace, setRsGrace] = useState(15);
    const [rsSitdowns, setRsSitdowns] = useState(5);
    const [rsPitches, setRsPitches] = useState(3);
    const [rsClosed, setRsClosed] = useState(1);
    const [rsConfigLocked, setRsConfigLocked] = useState(false);

    const populateFromExisting = useCallback((config: RoadshowConfig, eventDate: string) => {
        setRsWeeklyCost(String(config.weekly_cost));
        setRsSlots(config.slots_per_day);
        setRsGrace(config.late_grace_minutes);
        setRsSitdowns(config.suggested_sitdowns);
        setRsPitches(config.suggested_pitches);
        setRsClosed(config.suggested_closed);
        setRsStartDate(eventDate);
        setRsEndDate(eventDate);
    }, []);

    return {
        rsStartDate,
        setRsStartDate,
        rsEndDate,
        setRsEndDate,
        rsWeeklyCost,
        setRsWeeklyCost,
        rsSlots,
        setRsSlots,
        rsGrace,
        setRsGrace,
        rsSitdowns,
        setRsSitdowns,
        rsPitches,
        setRsPitches,
        rsClosed,
        setRsClosed,
        rsConfigLocked,
        setRsConfigLocked,
        populateFromExisting,
    };
}
