/**
 * @typedef { {
 *  key: string,
 *  count: number,
 *  lastTime: number
 * } } UsageRecord
 */

export function isNewDay(time = 0) {
  return new Date(time).toDateString() !== new Date().toDateString();
}

export const UsageKey = {
  SAVE_TEST_CASE: "save-test-case",
  CREATE_TEST_CASE: "create-test-case",
  PROMOTE_SIGN_UP: "promote-sign-up",
};

export class UsageWatcher {
  async loadUsage() {
    return (await browser.storage.local.get("usage"))?.usage || {};
  }

  async saveUsage(usage) {
    await browser.storage.local.set({ usage });
  }

  /**
   * @returns {Promise<UsageRecord>}
   */
  async loadUsageRecord(key) {
    const usage = await this.loadUsage();
    return (
      usage[key] || {
        key,
        count: 0,
        lastTime: 0,
      }
    );
  }

  async saveUsageRecord(record) {
    const usage = await this.loadUsage();
    usage[record.key] = record;
    await this.saveUsage(usage);
  }

  async countForRecord(key) {
    const record = await this.loadUsageRecord(key);
    record.count++;
    record.lastTime = Date.now();
    await this.saveUsageRecord(record);
    return record;
  }

  // ---

  async countPromoteSignUp() {
    return this.countForRecord(UsageKey.PROMOTE_SIGN_UP);
  }

  async countSavingTestCase() {
    return this.countForRecord(UsageKey.SAVE_TEST_CASE);
  }

  async countCreatingTestCase() {
    return this.countForRecord(UsageKey.CREATE_TEST_CASE);
  }
}

export const usageWatcher = new UsageWatcher();
