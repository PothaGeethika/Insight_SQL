/**
 * Simple file-backed user store for Next.js API routes.
 *
 * Uses Node's built-in `fs` with atomic write (write temp → rename) so there
 * are no native compilation requirements. Suitable for early-stage production
 * and can be swapped for a real DB (PostgreSQL / PlanetScale) later.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_DIR = process.env.SQLITE_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "users.json");

// Legacy json-server file path — used for one-time migration only
const LEGACY_DB_PATH = path.join(process.cwd(), "db.json");

export interface DbUser {
  id: number;
  name: string;
  email: string;
  password: string;
  created_at: string;
}

interface UserStore {
  nextId: number;
  users: DbUser[];
}

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function migrateFromLegacy(): UserStore {
  // One-time migration from the old json-server db.json format
  if (!fs.existsSync(LEGACY_DB_PATH)) return { nextId: 1, users: [] };
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY_DB_PATH, "utf8"));
    const rawUsers: Array<{ id: number; name: string; email: string; password: string }> =
      legacy?.users ?? [];
    if (rawUsers.length === 0) return { nextId: 1, users: [] };

    const users: DbUser[] = rawUsers.map((u) => ({
      id: u.id,
      name: u.name || "",
      email: u.email,
      password: u.password,
      created_at: new Date().toISOString(),
    }));
    const maxId = Math.max(...users.map((u) => u.id), 0);
    const store: UserStore = { nextId: maxId + 1, users };
    write(store);
    return store;
  } catch {
    return { nextId: 1, users: [] };
  }
}

function read(): UserStore {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    // First boot — migrate existing users from db.json if present
    return migrateFromLegacy();
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as UserStore;
  } catch {
    return { nextId: 1, users: [] };
  }
}

function write(store: UserStore) {
  ensureDir();
  const tmp = DB_PATH + ".tmp." + crypto.randomBytes(4).toString("hex");
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, DB_PATH);
}

export function findUserByEmail(email: string): DbUser | undefined {
  const { users } = read();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: number): DbUser | undefined {
  const { users } = read();
  return users.find((u) => u.id === id);
}

export function createUser(name: string, email: string, hashedPassword: string): DbUser {
  const store = read();
  const user: DbUser = {
    id: store.nextId,
    name,
    email,
    password: hashedPassword,
    created_at: new Date().toISOString(),
  };
  store.users.push(user);
  store.nextId += 1;
  write(store);
  return user;
}

export function updateUserPassword(id: number, hashedPassword: string): void {
  const store = read();
  const user = store.users.find((u) => u.id === id);
  if (user) {
    user.password = hashedPassword;
    write(store);
  }
}
