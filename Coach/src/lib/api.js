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


export function createWorkout({ user_id, title, notes, scheduled_for } = {}) {
  return fetchJSON("/workouts/", {
    method: "POST",
    body: { user_id, title, notes, scheduled_for },
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