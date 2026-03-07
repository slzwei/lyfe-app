'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { User, ROLE_LABELS } from '@/lib/types';
import { updateReportsTo } from './actions';
import { toast } from 'sonner';

interface HierarchyTreeProps {
  users: User[];
}

interface TreeNode {
  user: User;
  children: TreeNode[];
}

function buildTree(users: User[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  users.forEach((u) => map.set(u.id, { user: u, children: [] }));

  users.forEach((u) => {
    const node = map.get(u.id)!;
    if (u.reports_to && map.has(u.reports_to)) {
      map.get(u.reports_to)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function TreeItem({ node, users, depth }: { node: TreeNode; users: User[]; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasChildren = node.children.length > 0;

  async function handleChange(value: string) {
    setSaving(true);
    const result = await updateReportsTo(node.user.id, value === '__none__' ? null : value);
    setSaving(false);
    setEditing(false);
    if (result.success) {
      toast.success('Updated reporting line');
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50" style={{ paddingLeft: `${depth * 24 + 8}px` }}>
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className="font-medium text-sm">{node.user.full_name}</span>
        <Badge variant="secondary" className="text-xs">{ROLE_LABELS[node.user.role]}</Badge>
        {!node.user.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
        {editing ? (
          <Select onValueChange={handleChange} defaultValue={node.user.reports_to || '__none__'} disabled={saving}>
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No manager</SelectItem>
              {users.filter((u) => u.id !== node.user.id).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name} ({ROLE_LABELS[u.role]})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {expanded && node.children.map((child) => (
        <TreeItem key={child.user.id} node={child} users={users} depth={depth + 1} />
      ))}
    </div>
  );
}

export function HierarchyTree({ users }: HierarchyTreeProps) {
  const tree = buildTree(users);

  return (
    <div className="rounded-md border p-2">
      {tree.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">No users found.</p>
      ) : (
        tree.map((node) => <TreeItem key={node.user.id} node={node} users={users} depth={0} />)
      )}
    </div>
  );
}
