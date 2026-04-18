import * as Crypto from "expo-crypto";
import { eq } from "drizzle-orm";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { appSettings } from "../db/schema";

type DrizzleDB = BaseSQLiteDatabase<"sync", any, any>;

const DEVICE_ID_KEY = "device_id";

let cached: string | null = null;

/**
 * Returns a stable device ID, generating one on first launch.
 * Persisted in the app_settings table so it survives app restarts
 * but is unique per installation.
 */
export function getDeviceId(db: DrizzleDB): string {
  if (cached) return cached;

  const row = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, DEVICE_ID_KEY))
    .get();

  if (row) {
    cached = row.value;
    return cached;
  }

  const id = Crypto.randomUUID();
  db.insert(appSettings).values({ key: DEVICE_ID_KEY, value: id }).run();
  cached = id;
  return id;
}
