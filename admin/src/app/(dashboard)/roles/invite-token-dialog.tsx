'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { inviteTokenSchema, InviteTokenInput } from '@/lib/schemas';
import { User } from '@/lib/types';
import { createInviteToken } from './actions';

interface InviteTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managers: User[];
}

export function InviteTokenDialog({ open, onOpenChange, managers }: InviteTokenDialogProps) {
  const defaultExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const form = useForm<InviteTokenInput>({
    resolver: zodResolver(inviteTokenSchema),
    defaultValues: {
      intended_role: 'candidate',
      assigned_manager_id: null,
      expires_at: defaultExpiry,
    },
  });

  async function onSubmit(data: InviteTokenInput) {
    const result = await createInviteToken({
      intended_role: data.intended_role,
      assigned_manager_id: data.assigned_manager_id,
      expires_at: new Date(data.expires_at).toISOString(),
    });
    if (result.success) {
      toast.success('Invite token created');
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
          <DialogTitle>Create Invite Token</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="intended_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="candidate">Candidate</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assigned_manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Manager (optional)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === '__none__' ? null : v)} value={field.value || '__none__'}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expires_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expires At</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating...' : 'Create Token'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
