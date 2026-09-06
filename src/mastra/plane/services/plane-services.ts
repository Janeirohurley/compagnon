/**
 * Plane Services
 *
 * Aggregates the Plane resource services into a single compatible facade.
 */

import type { PlaneClient } from '../client/plane-client';
import type { PlaneConfig } from '../config/plane-config';
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
} from '../domain/types';
import type {
  ListCommentsParams,
  ListCyclesParams,
  ListMembersParams,
  ListModulesParams,
  ListProjectsParams,
  ListRelationsParams,
  ListWorkItemsParams,
  ListWorkspacesParams,
  PlaneService,
} from '../domain/contracts';
import { CommentService } from './comment-service';
import { CycleService } from './cycle-service';
import { MemberService } from './member-service';
import { ModuleService } from './module-service';
import { ProjectService } from './project-service';
import { RelationService } from './relation-service';
import { WorkItemService } from './work-item-service';
import { WorkspaceService } from './workspace-service';

export class PlaneServiceImpl implements PlaneService {
  private readonly workspaceService: WorkspaceService;
  private readonly projectService: ProjectService;
  private readonly workItemService: WorkItemService;
  private readonly commentService: CommentService;
  private readonly cycleService: CycleService;
  private readonly moduleService: ModuleService;
  private readonly memberService: MemberService;
  private readonly relationService: RelationService;

  constructor(client: PlaneClient, config: PlaneConfig) {
    this.workspaceService = new WorkspaceService(client);
    this.projectService = new ProjectService(client, config.getWorkspaceSlug());
    this.workItemService = new WorkItemService(client, config.getWorkspaceSlug());
    this.commentService = new CommentService(client);
    this.cycleService = new CycleService(client);
    this.moduleService = new ModuleService(client);
    this.memberService = new MemberService(client, config.getWorkspaceSlug());
    this.relationService = new RelationService(client);
  }

  async getWorkspace(id: string): Promise<Workspace> {
    return this.workspaceService.get(id);
  }

  async listWorkspaces(params: ListWorkspacesParams = {}): Promise<PaginatedResponse<Workspace>> {
    return this.workspaceService.list(params);
  }

  async getWorkItem(id: string): Promise<WorkItem> {
    return this.workItemService.get(id);
  }

  async createWorkItem(data: Partial<WorkItem>): Promise<WorkItem> {
    return this.workItemService.create(data);
  }

  async updateWorkItem(id: string, data: Partial<WorkItem>): Promise<WorkItem> {
    return this.workItemService.update(id, data);
  }

  async deleteWorkItem(id: string): Promise<void> {
    return this.workItemService.delete(id);
  }

  async listWorkItems(params: ListWorkItemsParams = {}): Promise<PaginatedResponse<WorkItem>> {
    return this.workItemService.list(params);
  }

  async getComment(id: string): Promise<Comment> {
    return this.commentService.list(id).then((result) => result.items[0] ?? Promise.reject(new Error('Comment not found')));
  }

  async createComment(data: Partial<Comment>): Promise<Comment> {
    if (!data.workItemId || !data.content) {
      throw new Error('workItemId and content are required');
    }
    return this.commentService.create(data.workItemId, data.content);
  }

  async updateComment(_id: string, _data: Partial<Comment>): Promise<Comment> {
    throw new Error('Comment update is not supported by the current Plane service contract.');
  }

  async deleteComment(_id: string): Promise<void> {
    throw new Error('Comment deletion is not supported by the current Plane service contract.');
  }

  async listComments(workItemId: string, params: ListCommentsParams = {}): Promise<PaginatedResponse<Comment>> {
    return this.commentService.list(workItemId, params);
  }

  async getProject(id: string): Promise<Project> {
    return this.projectService.get(id);
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    return this.projectService.create(data);
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    return this.projectService.update(id, data);
  }

  async deleteProject(id: string): Promise<void> {
    return this.projectService.delete(id);
  }

  async listProjects(params: ListProjectsParams = {}): Promise<PaginatedResponse<Project>> {
    return this.projectService.list(params);
  }

  async getCycle(id: string): Promise<Cycle> {
    return this.cycleService.get(id);
  }

  async createCycle(data: Partial<Cycle>): Promise<Cycle> {
    if (!data.projectId) throw new Error('projectId is required when creating a cycle');
    return this.cycleService.create(data.projectId, data);
  }

  async updateCycle(id: string, data: Partial<Cycle>): Promise<Cycle> {
    return this.cycleService.update(id, data);
  }

  async deleteCycle(id: string): Promise<void> {
    return this.cycleService.delete(id);
  }

  async listCycles(projectId: string, params: ListCyclesParams = {}): Promise<PaginatedResponse<Cycle>> {
    return this.cycleService.list(projectId, params);
  }

  async getModule(id: string): Promise<Module> {
    return this.moduleService.get(id);
  }

  async createModule(data: Partial<Module>): Promise<Module> {
    if (!data.projectId) throw new Error('projectId is required when creating a module');
    return this.moduleService.create(data.projectId, data);
  }

  async updateModule(id: string, data: Partial<Module>): Promise<Module> {
    return this.moduleService.update(id, data);
  }

  async deleteModule(id: string): Promise<void> {
    return this.moduleService.delete(id);
  }

  async listModules(projectId: string, params: ListModulesParams = {}): Promise<PaginatedResponse<Module>> {
    return this.moduleService.list(projectId, params);
  }

  async getMember(id: string): Promise<Member> {
    return this.memberService.get(id);
  }

  async createMember(_data: Partial<Member>): Promise<Member> {
    throw new Error('Member creation is not part of the current Plane service contract.');
  }

  async updateMember(_id: string, _data: Partial<Member>): Promise<Member> {
    throw new Error('Member update is not supported by the current Plane service contract.');
  }

  async deleteMember(_id: string): Promise<void> {
    throw new Error('Member deletion is not supported by the current Plane service contract.');
  }

  async listMembers(params: ListMembersParams = {}): Promise<PaginatedResponse<Member>> {
    return this.memberService.list(params);
  }

  async getRelation(_id: string): Promise<Relation> {
    throw new Error('Relation lookup by id is not supported by the current Plane service contract.');
  }

  async createRelation(data: Partial<Relation>): Promise<Relation> {
    return this.relationService.create(data);
  }

  async deleteRelation(id: string): Promise<void> {
    return this.relationService.delete(id);
  }

  async listRelations(params: ListRelationsParams = {}): Promise<PaginatedResponse<Relation>> {
    return this.relationService.list(params);
  }

  async resolveAssignee(identifier: string): Promise<Member> {
    return this.memberService.resolve(identifier);
  }

  async resolveWorkItem(identifier: string): Promise<WorkItem> {
    return this.workItemService.resolve(identifier);
  }
}
