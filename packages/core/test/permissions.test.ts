import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PERMISSIONS, defaultPermissions } from "../src/index";

const migrations = resolve(dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations");

describe("permissions", () => {
  it("match the keys the database accepts", () => {
    const sql = readFileSync(resolve(migrations, "0002_family_accounts.sql"), "utf8");
    const keys = /select array\[([^\]]+)\]/.exec(sql)![1]!.split(",").map((k) => k.trim().replace(/'/g, ""));
    expect(keys).toEqual(PERMISSIONS.map((p) => p.key));
  });

  it("match the defaults stored for new students", () => {
    const sql = readFileSync(resolve(migrations, "0001_init.sql"), "utf8");
    const json = /permissions\s+jsonb not null default '(\{[^']+\})'/.exec(sql)![1]!;
    expect(JSON.parse(json)).toEqual(defaultPermissions());
  });
});
