/**
 * Class represent a profile's variable that currently loaded when KR is running
 */
class ProfileVariable {
  /**
   * Create a ProfileVariable
   * @param {string} name
   * @param {string} value
   */
  constructor(name = "", value = "") {
    this.name = name;
    this.value = value;
  }
}

export { ProfileVariable }