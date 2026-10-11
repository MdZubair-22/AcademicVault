import assert from "node:assert/strict";
import test from "node:test";

const META_KEY = "academicvault.local.tables.v2";
const AUTH_KEY = "academicvault.local.auth.v1";

class MemoryStorage {
  values = new Map();
  getItem(key) {
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    this.values.set(key, value);
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

globalThis.localStorage = new MemoryStorage();
const { localSupabase, setLocalAuthUser } = await import(
  "../src/lib/localSupabase.ts"
);

test("insert followed by select and single inserts and returns the new row", async () => {
  setLocalAuthUser({ id: "native-upload-test-user", email: "test@example.test" });

  try {
    const { data, error } = await localSupabase
      .from("documents")
      .insert({ title: "Native upload test" })
      .select("id")
      .single();

    assert.equal(error, null);
    assert.ok(data?.id);
    assert.equal(data.title, "Native upload test");

    const { data: rows, error: queryError } = await localSupabase
      .from("documents")
      .select("id,title");

    assert.equal(queryError, null);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, data.id);
  } finally {
    setLocalAuthUser(null);
    localStorage.removeItem(META_KEY);
    localStorage.removeItem(AUTH_KEY);
  }
});

test("update followed by select remains an update", async () => {
  setLocalAuthUser({ id: "native-upload-test-user", email: "test@example.test" });

  try {
    const { data: inserted } = await localSupabase
      .from("documents")
      .insert({ title: "Before update" });

    const { data, error } = await localSupabase
      .from("documents")
      .update({ title: "After update" })
      .eq("id", inserted.id)
      .select("id")
      .single();

    assert.equal(error, null);
    assert.equal(data.id, inserted.id);
    assert.equal(data.title, "After update");
  } finally {
    setLocalAuthUser(null);
    localStorage.removeItem(META_KEY);
    localStorage.removeItem(AUTH_KEY);
  }
});
