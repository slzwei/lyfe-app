'use client';

import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { LeadDetailSheet } from './lead-detail-sheet';
import { getColumns } from './columns';
import {
  Lead,
  LeadActivity,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  PRODUCT_INTERESTS,
  PRODUCT_INTEREST_LABELS,
} from '@/lib/types';

interface LeadsClientProps {
  leads: Lead[];
  activities: LeadActivity[];
}

const facetedFilters = [
  {
    columnId: 'status',
    title: 'Status',
    options: LEAD_STATUSES.map((s) => ({ label: LEAD_STATUS_LABELS[s], value: s })),
  },
  {
    columnId: 'source',
    title: 'Source',
    options: LEAD_SOURCES.map((s) => ({ label: LEAD_SOURCE_LABELS[s], value: s })),
  },
  {
    columnId: 'product_interest',
    title: 'Product',
    options: PRODUCT_INTERESTS.map((p) => ({ label: PRODUCT_INTEREST_LABELS[p], value: p })),
  },
];

export function LeadsClient({ leads, activities }: LeadsClientProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const columns = getColumns();

  return (
    <>
      <DataTable
        columns={columns}
        data={leads}
        searchColumn="full_name"
        searchPlaceholder="Search by name..."
        facetedFilters={facetedFilters}
        onRowClick={(lead) => {
          setSelectedLead(lead);
          setSheetOpen(true);
        }}
      />
      <LeadDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        lead={selectedLead}
        activities={activities}
      />
    </>
  );
}
