'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { paAssignmentSchema, PaAssignmentInput } from '@/lib/schemas';
import { User } from '@/lib/types';
import { createPaAssignment } from './actions';

interface PaAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pas: User[];
  managers: User[];
}

export function PaAssignmentDialog({ open, onOpenChange, pas, managers }: PaAssignmentDialogProps) {
  const form = useForm<PaAssignmentInput>({
    resolver: zodResolver(paAssignmentSchema),
    defaultValues: { pa_id: '', manager_id: '' },
  });

  async function onSubmit(data: PaAssignmentInput) {
    const result = await createPaAssignment(data.pa_id, data.manager_id);
    if (result.success) {
      toast.success('Assignment created');
      onOpenChange(false);
      form.reset();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add PA Assignment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="pa_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PA</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select PA" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pas.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manager</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select Manager" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {managers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
