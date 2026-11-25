/** Client for the backend API (plan 007). */

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export interface CreateDebateInput {
  question: string;
  num_agents: number;
  rebuttals: number;
  all_roles?: boolean;
  /** Debater model id from getOptions().debate_models; omit for the default. */
  model?: string;
}

export interface DebateModelOption {
  id: string;
  label: string;
  provider: string;
  note: string;
}

export interface ConfigOptions {
  debate_models: DebateModelOption[];
  default_debate_model: string;
  aggregation_methods: { id: string; label: string; available: boolean }[];
  limits: { max_agents: number; max_rebuttals: number };
}

/** Models and limits the backend offers. Returns null when the API is unreachable. */
export async function getOptions(): Promise<ConfigOptions | null> {
  try {
    const res = await fetch(`${API_URL}/api/config/options`);
    return res.ok ? ((await res.json()) as ConfigOptions) : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
  }
}

/** Starts a live debate and returns its id. Throws ApiError with a readable message. */
export async function createDebate(input: CreateDebateInput): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/debates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError(
      "Can't reach the debate server. Start the backend API, or replay a sample debate below."
    );
  }
  if (!res.ok) {
    let detail = `The server returned ${res.status}.`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg)
        detail = `Check your question: ${body.detail[0].msg}.`;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, res.status);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}
