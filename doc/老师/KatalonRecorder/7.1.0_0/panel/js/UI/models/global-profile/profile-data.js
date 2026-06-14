/***
 * Class contains all execution profiles that are loaded when KR is running
 */
class ProfileData {
  /**
   * Create a ProfileData
   * @param {Profile[]} [profiles=[]]
   */
  constructor(profiles = []) {
    this.profiles = profiles;
  }

  /**
   * return how many profiles are currently in the memory
   * @returns {Promise<number>}
   */
  async countProfiles() {
    return this.profiles.length;
  }
}

export { ProfileData }