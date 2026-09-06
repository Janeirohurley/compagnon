import type { PaginatedResponse } from '../client/plane-pagination';
import type {
  Comment,
  Cycle,
  Member,
  Module,
  Project,
  Relation,
  WorkItem,
  Workspace,
} from './types';

export interface PlaneService {
  getWorkspace(id: string): Promise<Workspace>;
  listWorkspaces(params?: ListWorkspacesParams): Promise<PaginatedResponse<Workspace>>;

  getWorkItem(id: string): Promise<WorkItem>;
  createWorkItem(data: Partial<WorkItem>): Promise<WorkItem>;
  updateWorkItem(id: string, data: Partial<WorkItem>): Promise<WorkItem>;
  deleteWorkItem(id: string): Promise<void>;
  listWorkItems(params?: ListWorkItemsParams): Promise<PaginatedResponse<WorkItem>>;

  getComment(id: string): Promise<Comment>;
  createComment(data: Partial<Comment>): Promise<Comment>;
  updateComment(id: string, data: Partial<Comment>): Promise<Comment>;
  deleteComment(id: string): Promise<void>;
  listComments(workItemId: string, params?: ListCommentsParams): Promise<PaginatedResponse<Comment>>;

  getProject(id: string): Promise<Project>;
  createProject(data: Partial<Project>): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  listProjects(params?: ListProjectsParams): Promise<PaginatedResponse<Project>>;

  getCycle(id: string): Promise<Cycle>;
  createCycle(data: Partial<Cycle>): Promise<Cycle>;
  updateCycle(id: string, data: Partial<Cycle>): Promise<Cycle>;
  deleteCycle(id: string): Promise<void>;
  listCycles(projectId: string, params?: ListCyclesParams): Promise<PaginatedResponse<Cycle>>;

  getModule(id: string): Promise<Module>;
  createModule(data: Partial<Module>): Promise<Module>;
  updateModule(id: string, data: Partial<Module>): Promise<Module>;
  deleteModule(id: string): Promise<void>;
  listModules(projectId: string, params?: ListModulesParams): Promise<PaginatedResponse<Module>>;

  getMember(id: string): Promise<Member>;
  createMember(data: Partial<Member>): Promise<Member>;
  updateMember(id: string, data: Partial<Member>): Promise<Member>;
  deleteMember(id: string): Promise<void>;
  listMembers(params?: ListMembersParams): Promise<PaginatedResponse<Member>>;

  getRelation(id: string): Promise<Relation>;
  createRelation(data: Partial<Relation>): Promise<Relation>;
  deleteRelation(id: string): Promise<void>;
  listRelations(params?: ListRelationsParams): Promise<PaginatedResponse<Relation>>;

  resolveAssignee(identifier: string): Promise<Member>;
  resolveWorkItem(identifier: string): Promise<WorkItem>;
}

export interface ListWorkspacesParams {
  search?: string;
  cursor?: string;
  page?: number;
  perPage?: number;
}

export interface ListWorkItemsParams {
  projectId?: string;
  assigneeId?: string;
  status?: string;
  priority?: string;
  search?: string;
  labels?: string[];
  cursor?: string;
  page?: number;
  perPage?: number;
}

export interface ListCommentsParams {
  cursor?: string;
  page?: number;
  perPage?: number;
}

export interface ListProjectsParams {
  workspaceId?: string;
  status?: string;
  search?: string;
  cursor?: string;
  page?: number;
  perPage?: number;
}

export interface ListCyclesParams {
  projectId?: string;
  status?: string;
  cursor?: string;
  page?: number;
  perPage?: number;
}

export interface ListModulesParams {
  projectId?: string;
  parentId?: string;
  status?: string;
  cursor?: string;
  page?: number;
  perPage?: number;
}

export interface ListMembersParams {
  workspaceId?: string;
  role?: string;
  search?: string;
  cursor?: string;
  page?: number;
  perPage?: number;
}

export interface ListRelationsParams {
  sourceId?: string;
  targetId?: string;
  type?: string;
  cursor?: string;
  page?: number;
  perPage?: number;
}
