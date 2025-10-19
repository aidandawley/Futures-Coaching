// src/lib/api.js
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
      if (data?.detail) {
        message = typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);
      }
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

export function listWorkoutsInRange(userId, start, end) {
  const params = new URLSearchParams({ start, end }).toString();
  return fetchJSON(`/workouts/by_user/${userId}/range?${params}`);
}

export function listWorkoutsOnDay(userId, day) {
  return fetchJSON(`/workouts/by_user/${userId}/on/${day}`);
}


export function createWorkout({ user_id, title, notes, scheduled_for, status } = {}) {
  const body = { user_id, title, notes, scheduled_for };
  if (status) body.status = status;   
  return fetchJSON("/workouts/", {
    method: "POST",
    body,
  });
}

export function getWorkoutDetail(workoutId) {
  return fetchJSON(`/workouts/${workoutId}/detail`);
}

// --- sets CRUD ---
export function listSetsByWorkout(workoutId) {
  return fetchJSON(`/sets/by_workout/${workoutId}`);
}

export function createSet({ workout_id, exercise, reps, weight = null }) {
  // weight is optional; send only if provided
  const body = { workout_id, exercise, reps };
  if (weight !== null && weight !== "" && !Number.isNaN(Number(weight))) {
    body.weight = Number(weight);
  }
  return fetchJSON(`/sets/`, { method: "POST", body });
}

export function updateSet(setId, { exercise, reps, weight }) {
  const body = {};
  if (exercise !== undefined) body.exercise = exercise;
  if (reps !== undefined) body.reps = Number(reps);
  if (weight !== undefined) {
    // allow clearing weight to null
    if (weight === "" || weight === null) body.weight = null;
    else body.weight = Number(weight);
  }
  return fetchJSON(`/sets/${setId}`, { method: "PATCH", body });
}

export function deleteSet(setId) {
  return fetchJSON(`/sets/${setId}`, { method: "DELETE" });
}

export function listWorkoutsInRangeWithSets(userId, start, end) {
  const params = new URLSearchParams({ start, end }).toString();
  return fetchJSON(`/workouts/by_user/${userId}/range_with_sets?${params}`);
}

export function createSetsBulk({ workout_id, exercise, reps, count, weight = null }) {
  const body = { workout_id, exercise, reps, count };
  if (weight !== null && weight !== "" && !Number.isNaN(Number(weight))) {
    body.weight = Number(weight);
  }
  return fetchJSON(`/sets/bulk`, { method: "POST", body });
}

/**
 * chat with the ai
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {number} [userId]  optional
 * @returns {Promise<{role: 'assistant', content: string}>}
 */
export function aiChat(messages, userId) {
  return fetchJSON("/ai/chat", {
    method: "POST",
    body: { messages, user_id: userId ?? 1 },
  });
}

export function aiInterpret(messages, user_id = 1) {
  return fetchJSON(`/ai/plan/interpret`, {
    method: "POST",
    body: { messages, user_id },
  });
}

export function aiQueueTasks(items) {
  return fetchJSON(`/ai/tasks/queue`, {
    method: "POST",
    body: items, // array of tasks
  });
}

export function aiListTasks(user_id, status) {
  const qs = new URLSearchParams({ user_id: String(user_id) });
  if (status) qs.set("status", status);
  return fetchJSON(`/ai/tasks?${qs.toString()}`);
}

export function aiApproveTask(taskId) {
  return fetchJSON(`/ai/tasks/${taskId}/approve`, { method: "POST" });
}

export function aiRejectTask(taskId) {
  return fetchJSON(`/ai/tasks/${taskId}/reject`, { method: "POST" });
}



export async function updateWorkout(id, patch) {
  const numericId = Number(id);
  if (!numericId) throw new Error(`updateWorkout: invalid id "${id}"`);

  // first try without trailing slash
  try {
    return await fetchJSON(`/workouts/${numericId}`, {
      method: "PATCH",
      body: patch,
    });
  } catch (e) {
    // if the server is slash-strict, retry with trailing slash
    if (String(e.message).toLowerCase().includes("404")) {
      return await fetchJSON(`/workouts/${numericId}/`, {
        method: "PATCH",
        body: patch,
      });
    }
    throw e;
  }
}

