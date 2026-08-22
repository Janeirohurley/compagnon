/**
 * Get the authenticated GitHub user's profile.
 * Uses GITHUB_TOKEN directly via REST API.
 */
export async function getAuthenticatedUser(): Promise<{
  login: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  url: string;
} | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    return {
      login: data.login as string,
      name: data.name as string | null,
      email: data.email as string | null,
      bio: data.bio as string | null,
      publicRepos: data.public_repos as number,
      followers: data.followers as number,
      following: data.following as number,
      url: data.html_url as string,
    };
  } catch {
    return null;
  }
}

/**
 * List all repositories for the authenticated user.
 */
export async function listUserRepositories(options?: {
  type?: "all" | "owner" | "public" | "private" | "forks";
  sort?: "created" | "updated" | "pushed" | "full_name";
  direction?: "asc" | "desc";
  perPage?: number;
  page?: number;
}): Promise<Array<{
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
}> | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  try {
    const params = new URLSearchParams({
      type: options?.type ?? "owner",
      sort: options?.sort ?? "updated",
      direction: options?.direction ?? "desc",
      per_page: String(options?.perPage ?? 30),
      page: String(options?.page ?? 1),
    });

    const response = await fetch(
      `https://api.github.com/user/repos?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as Array<Record<string, unknown>>;
    return data.map((repo) => ({
      name: repo.name as string,
      fullName: repo.full_name as string,
      description: repo.description as string | null,
      private: repo.private as boolean,
      language: repo.language as string | null,
      stars: repo.stargazers_count as number,
      forks: repo.forks_count as number,
      url: repo.html_url as string,
    }));
  } catch {
    return null;
  }
}

// Default export for Mastra fs-agent build process
export default { getAuthenticatedUser, listUserRepositories };
