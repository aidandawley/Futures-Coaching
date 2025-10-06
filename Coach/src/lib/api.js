const BASE_URL = "http://127.0.0.1:8000";

export async function fetchJSON(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.detail) message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {}
    throw new Error(message);
  }

  return await res.json();
}

export function ping() {
  return fetchJSON("/");
}

export function listWorkoutsByUser(userId) {
    return fetchJSON(`/workouts/by_user/${userId}/with_sets`);
  }

export function createWorkout({ user_id, title, notes }) {
  return fetchJSON("/workouts/", {
    method: "POST",
    body: { user_id, title, notes },
  });
}