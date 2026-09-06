export interface Workspace {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status?: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface WorkItem {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority?: string;
  assigneeId?: string;
  projectId: string;
  parentId?: string;
  estimate?: number;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  labels?: string[];
}

export interface Comment {
  id: string;
  workItemId: string;
  content: string;
  htmlContent?: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  attachments?: unknown[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';
  workspaceId: string;
  leadId?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Cycle {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'closed' | 'upcoming';
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  parentId?: string;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'admin' | 'member' | 'viewer';
  workspaceId: string;
}

export interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'blocks' | 'relates_to' | 'duplicates' | 'is_blocked_by';
  createdAt: string;
}
