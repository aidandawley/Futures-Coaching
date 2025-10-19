import { fetchJSON } from "./api";

export function createUser(username) {
  // simple shape to match your UserCreate schema
  return fetchJSON("/users/", {
    method: "POST",
    body: { username },
  });
}

export function ensureUser(username) {
  return fetchJSON("/users/ensure", {
    method: "POST",
    body: { username },
  });
}

export function listUsers() {
  return fetchJSON("/users/");
}

/* get a single user by id */
export function getUser(userId) {
  return fetchJSON(`/users/${userId}`);
}


const LS_KEY = "fc_user_id";

export async function getOrCreateClientUser(defaultUsername = "guest") {
  // read any previously stored id
  const cached = window.localStorage.getItem(LS_KEY);
  if (cached) {
    const id = Number(cached);
    if (Number.isFinite(id) && id > 0) {
      return id; 
    }
  }

  // ensure a username
  const uniqueUsername = `${defaultUsername}-${Math.random().toString(36).slice(2, 8)}`;

  // ask backend to ensure the user exists, then store id
  const user = await ensureUser(uniqueUsername);
  window.localStorage.setItem(LS_KEY, String(user.id));
  return user.id;
}
