// Project store tests (feature-projects).
//
// Covers the workspace-scoped CRUD of the compagnon_projects table: isolation
// between workspaces, defaults (slug, status), updates and deletion.
import { describe, it, expect, beforeAll } from 'vitest';
import { unlinkSync } from 'node:fs';

const DB = '/tmp/compagnon-project-store-test.db';
for (const suffix of ['', '-wal', '-shm']) {
  try {
    unlinkSync(`${DB}${suffix}`);
  } catch {
    // file does not exist yet
  }
}
process.env.TURSO_DATABASE_URL = `file:${DB}`;
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

let listProjects: typeof import('../project-store')['listProjects'];
let getProject: typeof import('../project-store')['getProject'];
let createProject: typeof import('../project-store')['createProject'];
let updateProject: typeof import('../project-store')['updateProject'];
let removeProject: typeof import('../project-store')['removeProject'];

describe('Project store', () => {
  beforeAll(async () => {
    ({ listProjects, getProject, createProject, updateProject, removeProject } = await import(
      '../project-store'
    ));
  });

  it('creates a project with defaults for its workspace', async () => {
    const project = await createProject({ workspaceId: 'ws-a', name: 'My Backend API' });

    expect(project.id).toBeDefined();
    expect(project.workspaceId).toBe('ws-a');
    expect(project.slug).toBe('my-backend-api');
    expect(project.description).toBe('');
    expect(project.projectPath).toBe('');
    expect(project.status).toBe('active');
    expect(project.createdAt).toBeDefined();
    expect(project.updatedAt).toBe(project.createdAt);
  });

  it('isolates projects between workspaces', async () => {
    const inA = await createProject({ workspaceId: 'ws-iso-a', name: 'Frontend', slug: 'frontend' });
    await createProject({ workspaceId: 'ws-iso-b', name: 'Mobile App' });

    const wsA = await listProjects('ws-iso-a');
    const wsB = await listProjects('ws-iso-b');

    expect(wsA.some((p) => p.id === inA.id)).toBe(true);
    expect(wsA).toHaveLength(1);
    expect(wsB.some((p) => p.id === inA.id)).toBe(false);
    expect(wsB).toHaveLength(1);
  });

  it('slugs a project deterministically and cannot be called into another workspace', async () => {
    const created = await createProject({
      workspaceId: 'ws-a',
      name: 'Project One',
      slug: 'project-one',
      description: 'A custom desc',
      projectPath: '/home/dev/project-one',
    });

    const fetched = await getProject(created.id);
    expect(fetched).toMatchObject({
      workspaceId: 'ws-a',
      name: 'Project One',
      slug: 'project-one',
      description: 'A custom desc',
      projectPath: '/home/dev/project-one',
    });
  });

  it('updates fields and bumps updatedAt, keeping the rest intact', async () => {
    const created = await createProject({ workspaceId: 'ws-a', name: 'To Update' });
    const updated = await updateProject(created.id, {
      name: 'Renamed',
      status: 'paused',
      projectPath: '/srv/app',
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Renamed');
    expect(updated?.status).toBe('paused');
    expect(updated?.projectPath).toBe('/srv/app');
    expect(updated?.workspaceId).toBe('ws-a');
    expect(updated?.slug).toBe('to-update');
    expect(updated?.updatedAt).not.toBe(created.updatedAt);
  });

  it('returns null when updating or fetching an unknown project', async () => {
    expect(await updateProject('does-not-exist', { name: 'x' })).toBeNull();
    expect(await getProject('does-not-exist')).toBeNull();
  });

  it('deletes a project and reports false for a missing id', async () => {
    const created = await createProject({ workspaceId: 'ws-b', name: 'To Delete' });
    expect(await removeProject(created.id)).toBe(true);
    expect(await getProject(created.id)).toBeNull();
    expect(await removeProject(created.id)).toBe(false);
  });
});