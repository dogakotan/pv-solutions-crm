import fs from "node:fs";
import { WORKER_CREDENTIALS_PATH } from "./helpers/credentials";
import { teardownWorkerIndex } from "./helpers/worker-provisioning";

const EXTRA_WORKER_INDICES = [1];

/** global-setup.ts'te oluşturulan geçici worker hesaplarını/partner'larını siler. */
export default async function globalTeardown(): Promise<void> {
  for (const index of EXTRA_WORKER_INDICES) {
    try {
      await teardownWorkerIndex(index);
    } catch (err) {
      console.warn(
        `[global-teardown] Worker ${index} temizlenemedi (${err instanceof Error ? err.message : String(err)}).`
      );
    }
  }

  if (fs.existsSync(WORKER_CREDENTIALS_PATH)) fs.unlinkSync(WORKER_CREDENTIALS_PATH);
}
