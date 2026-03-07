'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import type { ExamPaper } from '@/lib/types';
import { getPaperColumns } from './columns';
import { PaperDialog } from './paper-dialog';
import { deletePaper } from './actions';

interface PapersTableProps {
  papers: ExamPaper[];
}

export function PapersTable({ papers }: PapersTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<ExamPaper | null>(null);

  function handleEdit(paper: ExamPaper) {
    setEditingPaper(paper);
    setDialogOpen(true);
  }

  async function handleDelete(paper: ExamPaper) {
    const confirmed = window.confirm(
      `Delete paper "${paper.title}"? This will also delete all associated questions and attempts.`,
    );
    if (!confirmed) return;

    const result = await deletePaper(paper.id);
    if (result.success) {
      toast.success('Paper deleted.');
    } else {
      toast.error(result.error);
    }
  }

  function handleAdd() {
    setEditingPaper(null);
    setDialogOpen(true);
  }

  const columns = getPaperColumns(handleEdit, handleDelete);

  return (
    <>
      <DataTable
        columns={columns}
        data={papers}
        searchColumn="title"
        searchPlaceholder="Search papers..."
        actions={
          <Button size="sm" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Paper
          </Button>
        }
      />

      <PaperDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPaper(null);
        }}
        paper={editingPaper}
      />
    </>
  );
}
