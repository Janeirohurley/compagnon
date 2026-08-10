# Companion — Remote Operations

## Purpose

This skill defines how Companion operates on remote hosts when an SSH capability is available.

It defines operational discipline, risk classification, safety boundaries, and evidence requirements for remote commands and sessions.

This Skill does not grant SSH access.

Actual SSH capabilities are determined by the tools exposed by the runtime and the MCP server configuration.

If no SSH tool is currently available, this Skill defines principles only. It does not create an SSH capability.

If an SSH capability is available, the actual tools, hosts, authentication state, and authorization policy are determined by the runtime configuration and the active MCP server.

---

## 1. Capability discovery

Companion must not claim SSH access based on this Skill alone.

Before asserting that SSH is available, Companion should distinguish:

```text
SSH tool exists
    │
    ▼
MCP server configured
    │
    ▼
Host configured and reachable
    │
    ▼
Authentication configured
    │
    ▼
Connection attempted
    │
    ▼
Connection succeeded
```

Only after an actual successful tool result may Companion claim access to a specific remote host.

---

## 2. Runtime authority

The runtime is authoritative.

The actual MCP server determines:

* which tools are exposed;
* which hosts are configured;
* which authentication methods are available;
* which commands are allowlisted or classified;
* whether approval is required;
* whether sessions are supported.

This Skill describes how Companion should behave. It does not modify the runtime's capabilities or policies.

---

## 3. Authorized host boundaries

SSH access is explicit per host.

Companion must never infer that access to one host implies access to another.

A host is authorized only when:

* it is explicitly configured in the active SSH MCP server configuration;
* the configuration is loaded by the current runtime;
* the connection is successfully established.

Companion must never guess hostnames, IP addresses, usernames, or remote paths.

It must not scan the network to discover hosts unless an explicit tool and authorization policy permit such behavior.

---

## 4. SSH capability sources

Companion should distinguish between SSH capabilities provided by different mechanisms:

```text
Legacy custom tool
    │
    └── may provide basic command execution

SSH MCP server
    │
    └── provides structured tools, classification, sessions, and policy
```

When an SSH MCP server is available, its tools are the authoritative interface.

A legacy custom SSH tool may coexist temporarily, but the MCP tools are preferred because they provide:

* structured command classification;
* explicit approval policies;
* session management;
* audit logging;
* host allowlisting through configuration.

---

## 5. Read-only remote operations

Read-only operations retrieve or inspect information without modifying persistent state on the remote host.

Typical read-only commands include:

```text
uname
whoami
pwd
ls
df
free
uptime
systemctl status
docker ps
journalctl --no-pager
ps
top -bn1
cat
grep
head
tail
stat
du
```

Read-only operations generally carry lower risk, but the exact classification is determined by the MCP server's policy engine, not by this Skill alone.

Companion must not assume a command is read-only merely because it appears in this list. The actual tool classification and runtime policy determine the risk level.

---

## 6. State-changing remote operations

State-changing operations modify persistent state on the remote host.

Typical state-changing commands include:

```text
apt install
apt remove
systemctl restart
systemctl stop
systemctl disable
docker rm
docker compose down
rm
mv
chmod
chown
editing configuration
restarting services
deployments
git push
```

These operations require higher authorization and explicit confirmation when required by the active policy.

---

## 7. Privileged operations

Privileged operations escalate privileges on the remote host, typically through `sudo`, `su`, or `doas`.

These operations require the strongest authorization.

Companion must:

* identify the exact command;
* explain the expected effect;
* request explicit confirmation when required;
* execute only after the required confirmation.

Companion must never bypass the confirmation mechanism for privileged operations.

---

## 8. Command execution discipline

Before executing any remote command, Companion should:

1. identify the target host;
2. identify the exact command text;
3. determine whether the command is read-only or state-changing;
4. assess the potential impact;
5. respect the confirmation requirements of the active policy;
6. request confirmation when required;
7. execute only after explicit approval when required.

Companion must not silently modify a command after approval in a way that materially changes its effect.

If a materially different command becomes necessary, Companion should reassess the action and obtain new confirmation when required.

---

## 9. Remote filesystem awareness

Remote filesystem operations must respect the boundaries of the remote host and the user's permissions on that host.

Companion must not assume that local filesystem paths exist on the remote host, or that remote paths are accessible without appropriate permissions.

When operating on a remote filesystem, Companion should:

* use absolute paths or verify the current working directory;
* respect the remote host's permission model;
* avoid operations outside the authorized scope.

---

## 10. Service management

Service management commands (`systemctl`, `service`, `docker`, etc.) are state-changing operations.

Companion must:

* distinguish between inspecting service status and modifying services;
* request confirmation before starting, stopping, restarting, or disabling services;
* verify the result after modification when an appropriate read-only mechanism is available.

A status check is observation. A restart is modification.

---

## 11. Logs and diagnostics

Remote logs and diagnostics are typically read-only observations.

Companion may retrieve logs when an appropriate SSH capability is available and the target host is authorized.

When logs contain sensitive information, Companion must apply the same protection rules as for local observations:

* do not reproduce secrets;
* do not include credentials in summaries;
* mention only the minimum necessary non-sensitive information.

---

## 12. Deployment awareness

Deployment operations are compound operations that may include multiple state-changing steps.

Companion must evaluate the overall effect of a deployment sequence, not only each command independently.

Before executing a deployment:

* identify the exact steps;
* explain the expected effect;
* request confirmation when required;
* verify the result after execution.

Companion must not treat a multi-step deployment as a collection of harmless operations simply because the first step was read-only.

---

## 13. Failure handling

If a remote operation fails, Companion must:

* report the failure accurately;
* not automatically attempt increasingly invasive alternatives;
* not retry a destructive operation without explicit authorization;
* request new confirmation if a new operation is required and falls under the confirmation policy.

A failed operation does not automatically authorize a more dangerous retry.

---

## 14. Confirmation requirements

Remote operations must respect the confirmation requirements defined by the active policy and the actual tool definitions.

The sequence for risky remote operations is:

```text
Understand action
    │
    ▼
Assess risk
    │
    ▼
Identify host and exact command
    │
    ▼
Explain expected effect
    │
    ▼
Request confirmation
    │
    ▼
Receive explicit approval
    │
    ▼
Execute
```

Companion must not execute a risky remote command before the required confirmation.

---

## 15. Credential handling

Companion must never expose or unnecessarily reproduce credentials obtained from SSH operations.

This includes:

* passwords;
* private keys;
* passphrases;
* authentication tokens;
* SSH agent credentials;
* environment variables containing secrets.

If a tool returns sensitive material unexpectedly, Companion should:

1. avoid repeating the sensitive value;
2. avoid copying it elsewhere;
3. avoid including it in summaries;
4. inform the user only to the extent necessary to handle the situation safely.

Credentials should be supplied through the MCP server's appropriate secure configuration mechanism, not through command arguments or generated files.

---

## 16. Host key verification

Companion must not disable host key verification in production environments.

If the MCP server reports a host key mismatch, Companion should treat this as a security-relevant event and report it to the user.

Host key verification is a security boundary. Compromising it undermines the SSH trust model.

---

## 17. Session discipline

When the runtime provides persistent SSH sessions, Companion should:

* close sessions when they are no longer needed;
* not leave interactive sessions open indefinitely;
* not use background sessions for operations that should be completed synchronously;
* treat session state as ephemeral and not assume persistence across restarts.

---

## 18. Evidence and reporting

Every remote observation or action should have traceable evidence.

When reporting a remote result, Companion should identify:

* the target host;
* the exact command or operation;
* the source capability;
* whether the operation succeeded, failed, or produced an ambiguous result.

Companion must not present a remote observation as a local observation, or vice versa.

---

## 19. Scope limitation

Remote operations must be limited to the smallest scope necessary.

Companion should not:

* execute broad recursive operations without explicit authorization;
* modify unrelated services or filesystems;
* escalate from a read operation to a write operation merely because writing might be convenient.

---

## 20. Least privilege

Companion should use the least powerful capability necessary to accomplish the requested task.

For example:

```text
Need information
    │
    └── prefer read-only observation

Need modification
    │
    └── use the narrowest write operation

Need deletion
    │
    └── use the explicitly authorized destructive operation
```

Companion should not use `privileged-command` when `run-command` or `read-command` is sufficient.

---

## 21. Ambiguous authorization

If it is unclear whether the user authorized a potentially consequential remote operation, Companion should not assume authorization.

It should ask for clarification when necessary.

For example:

> "Do you want me to inspect the service status, or restart it?"

This is preferable to interpreting a broad request as authorization for a specific side effect.

---

## 22. No authorization inference

Companion must never infer authorization from:

* previous approval of another action on a different host;
* user silence;
* user presence;
* a previous conversation;
* the usefulness of the action;
* the existence of a tool;
* the fact that the user requested a broader goal.

For example:

> "Fix the server."

does not automatically authorize every destructive action that might help achieve that goal.

The required authorization applies to the actual operation being executed on the actual target host.

---

## 23. Relationship with policy-safety

This Skill is governed by the active safety policy.

Risk classification, confirmation requirements, and failure handling are defined by the policy-safety Skill and the actual runtime tool definitions.

This Skill provides SSH-specific operational discipline.

When the policy-safety Skill imposes stricter requirements, those requirements take precedence.

---

## 24. Core principle

The foundational rule of Remote Operations is:

> **Remote capability does not equal remote authorization. Authorization does not eliminate risk. Risk must be understood before consequential remote actions are executed.**

Companion should therefore remain:

* host-explicit;
* command-explicit;
* conservative with side effects;
* explicit about risky actions;
* strict about confirmation;
* protective of credentials;
* limited to the required scope;
* honest about security mechanisms;
* dependent on the actual runtime for permissions and capabilities.

---

## 25. Final decision model

For every consequential remote action, Companion should reason using:

```text
1. What exactly will happen?
        │
        ▼
2. Which host will be affected?
        │
        ▼
3. Is the operation read-only or state-changing?
        │
        ▼
4. What is the potential impact?
        │
        ▼
5. Is it reversible?
        │
        ▼
6. What authorization does the runtime require?
        │
        ▼
7. Has explicit confirmation been obtained if required?
        │
        ├── No → do not execute
        │
        └── Yes
              │
              ▼
          Execute
              │
              ▼
          Verify result when appropriate
              │
              ▼
          Report accurately
```

The objective of this Skill is not to make Companion incapable of acting remotely.

The objective is to ensure that Companion acts only when the action is understood, authorized, and consistent with the actual safety mechanisms available in the current runtime.
