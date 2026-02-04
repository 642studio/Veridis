import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type Role = "lite" | "dev" | "god";

export type UserRecord = {
  telegramUserId: string;
  name?: string;
  origin?: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type InviteCodeRecord = {
  code: string;
  roleGrant: "dev"; // v0: only dev codes
  expiresAt: string; // ISO
  createdAt: string; // ISO
  createdByTelegramUserId: string;
  usedAt?: string;
  usedByTelegramUserId?: string;
};

type AuthzStore = {
  users: Record<string, UserRecord>; // key: telegramUserId
  inviteCodes: Record<string, InviteCodeRecord>; // key: code
};

const DEFAULT_STORE: AuthzStore = { users: {}, inviteCodes: {} };

function nowIso(): string {
  return new Date().toISOString();
}

function parseIdsEnv(value?: string): Set<string> {
  const ids = new Set<string>();
  for (const part of (value ?? "").split(",")) {
    const v = part.trim();
    if (v) ids.add(v);
  }
  return ids;
}

const GOD_IDS = parseIdsEnv(process.env.VERIDIS_GOD_TELEGRAM_IDS);

function base32Code(bytesLen = 6): string {
  // 6 bytes -> 48 bits -> ~10 base32 chars; we truncate to 8 for usability.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const buf = randomBytes(bytesLen);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      const idx = (value >> (bits - 5)) & 31;
      bits -= 5;
      out += alphabet[idx] ?? "A";
    }
  }
  if (bits > 0) {
    const idx = (value << (5 - bits)) & 31;
    out += alphabet[idx] ?? "A";
  }
  return out.slice(0, 8);
}

async function atomicWriteJson(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

export class AuthzService {
  private storePath: string;
  private store: AuthzStore = { ...DEFAULT_STORE };
  private loaded = false;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AuthzStore>;
      this.store = {
        users: parsed.users ?? {},
        inviteCodes: parsed.inviteCodes ?? {},
      };
    } catch {
      // Initialize empty store
      this.store = { ...DEFAULT_STORE };
      await atomicWriteJson(this.storePath, JSON.stringify(this.store, null, 2));
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await atomicWriteJson(this.storePath, JSON.stringify(this.store, null, 2));
  }

  getRole(telegramUserId: string): Role {
    // Environment allowlist overrides store.
    if (GOD_IDS.has(telegramUserId)) return "god";
    return this.store.users[telegramUserId]?.role ?? "lite";
  }

  getUser(telegramUserId: string): UserRecord | null {
    return this.store.users[telegramUserId] ?? null;
  }

  async onboard(input: { telegramUserId: string; name?: string; origin?: string }): Promise<UserRecord> {
    await this.load();
    const id = String(input.telegramUserId).trim();
    const existing = this.store.users[id];

    const role: Role = GOD_IDS.has(id) ? "god" : existing?.role ?? "lite";

    const record: UserRecord = {
      telegramUserId: id,
      name: input.name?.trim() || existing?.name,
      origin: input.origin?.trim() || existing?.origin,
      role,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    this.store.users[id] = record;
    await this.persist();
    return record;
  }

  async createInviteCode(input: { createdByTelegramUserId: string; ttlHours?: number }): Promise<InviteCodeRecord> {
    await this.load();

    const creator = String(input.createdByTelegramUserId).trim();
    const role = this.getRole(creator);
    if (role !== "god") {
      throw new Error("forbidden: only god can create invite codes");
    }

    const ttl = Number.isFinite(input.ttlHours) ? Number(input.ttlHours) : 12;
    const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();

    let code = `DEV-${base32Code()}`;
    // ensure uniqueness
    for (let i = 0; i < 5 && this.store.inviteCodes[code]; i++) {
      code = `DEV-${base32Code()}`;
    }

    const rec: InviteCodeRecord = {
      code,
      roleGrant: "dev",
      expiresAt,
      createdAt: nowIso(),
      createdByTelegramUserId: creator,
    };

    this.store.inviteCodes[code] = rec;
    await this.persist();
    return rec;
  }

  async redeemInviteCode(input: { telegramUserId: string; code: string }): Promise<UserRecord> {
    await this.load();

    const id = String(input.telegramUserId).trim();
    const code = String(input.code).trim().toUpperCase();
    const rec = this.store.inviteCodes[code];
    if (!rec) throw new Error("invalid_code");

    if (rec.usedAt) throw new Error("code_already_used");

    const exp = new Date(rec.expiresAt);
    if (Number.isNaN(exp.valueOf()) || exp.valueOf() < Date.now()) {
      throw new Error("code_expired");
    }

    rec.usedAt = nowIso();
    rec.usedByTelegramUserId = id;

    const existing = this.store.users[id];
    const role: Role = GOD_IDS.has(id) ? "god" : "dev";

    const user: UserRecord = {
      telegramUserId: id,
      name: existing?.name,
      origin: existing?.origin,
      role,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    this.store.users[id] = user;
    this.store.inviteCodes[code] = rec;
    await this.persist();
    return user;
  }

  checkAction(input: { telegramUserId: string; action: string }): { allowed: boolean; role: Role } {
    const role = this.getRole(String(input.telegramUserId).trim());
    const action = String(input.action).trim();

    // v0 policy:
    // - lite: chat.qa.public, submit.idea
    // - dev: + video.pipeline.run, files.rw.videogen, files.rw.brain
    // - god: allow all (no-root boundary enforced outside core)

    if (role === "god") return { allowed: true, role };

    const liteAllow = new Set(["chat.qa.public", "submit.idea"]);
    const devAllow = new Set([
      ...liteAllow,
      "video.pipeline.run",
      "files.rw.videogen",
      "files.rw.brain",
      "n8n.workflows.run",
      "n8n.workflows.list",
    ]);

    if (role === "dev") return { allowed: devAllow.has(action), role };
    return { allowed: liteAllow.has(action), role };
  }
}
