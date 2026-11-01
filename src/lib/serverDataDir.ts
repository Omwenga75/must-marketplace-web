import fs from "fs";
import path from "path";
import os from "os";

const REPO_DATA_DIR = path.join(process.cwd(), "data");

/**
 * Returns the writable data directory.
 * In local dev, returns process.cwd()/data.
 * On Vercel / serverless where process.cwd() is read-only (EROFS),
 * seeds and uses os.tmpdir()/must_marketplace_data.
 */
export function getServerDataDir(): string {
  try {
    if (!fs.existsSync(REPO_DATA_DIR)) {
      fs.mkdirSync(REPO_DATA_DIR, { recursive: true });
    }
    const testFile = path.join(REPO_DATA_DIR, ".write_test");
    fs.writeFileSync(testFile, "1", "utf8");
    fs.unlinkSync(testFile);
    return REPO_DATA_DIR;
  } catch {
    const tmpDataDir = path.join(os.tmpdir(), "must_marketplace_data");
    if (!fs.existsSync(tmpDataDir)) {
      try {
        fs.mkdirSync(tmpDataDir, { recursive: true });
      } catch {}
    }
    const files = [
      "products.json",
      "users.json",
      "conversations.json",
      "messages.json",
      "deleted_products.json",
      "deleted_users.json",
    ];
    files.forEach((f) => {
      const src = path.join(REPO_DATA_DIR, f);
      const dest = path.join(tmpDataDir, f);
      if (!fs.existsSync(dest) && fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, dest);
        } catch {}
      }
    });
    return tmpDataDir;
  }
}

export function getServerFilePath(fileName: string): string {
  return path.join(getServerDataDir(), fileName);
}
