import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

export const sshCommandTool = createTool({
  id: 'ssh_command',
  description: 'Run a command on a remote machine over SSH using local SSH config, keys, or a password from an environment variable.',
  inputSchema: z.object({
    host: z.string().describe('SSH host or host alias from ~/.ssh/config.'),
    user: z.string().optional().describe('SSH username. Optional when using an SSH config alias.'),
    port: z.number().int().positive().optional().describe('SSH port. Defaults to 22 or SSH config.'),
    command: z.string().describe('Command to run on the remote machine.'),
    passwordEnvVar: z
      .string()
      .optional()
      .describe('Environment variable containing the SSH password. Defaults to SSH_PASSWORD when provided.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    stdout: z.string(),
    stderr: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ host, user, port, command, passwordEnvVar }) => {
    if (host.startsWith('-') || user?.startsWith('-')) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        error: 'Invalid SSH host or user.',
      };
    }

    const destination = user ? `${user}@${host}` : host;
    const sshArgs = [
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=accept-new',
    ];

    const passwordVariable = passwordEnvVar || 'SSH_PASSWORD';
    const password = process.env[passwordVariable];

    if (password) {
      sshArgs[1] = 'BatchMode=no';
      sshArgs.push('-o', 'PreferredAuthentications=password');
    }

    if (port) {
      sshArgs.push('-p', String(port));
    }

    sshArgs.push(destination, command);

    const executable = password ? 'sshpass' : 'ssh';
    const args = password ? ['-e', 'ssh', ...sshArgs] : sshArgs;
    const env = password ? { ...process.env, SSHPASS: password } : process.env;

    try {
      const { stdout, stderr } = await execFileAsync(executable, args, {
        env,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });

      return { success: true, stdout, stderr };
    } catch (error) {
      const err = error as { message?: string; stdout?: string; stderr?: string };

      return {
        success: false,
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        error: err.message || 'SSH command failed.',
      };
    }
  },
});
