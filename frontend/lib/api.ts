/** Client for the backend API (plan 007). */

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export interface CreateDebateInput {
  question: string;
  num_agents: number;
  rebuttals: number;
  all_roles?: boolean;
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
