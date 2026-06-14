/**
 * @typedef {{
 *  hasLoggedIn: boolean,
 *  isActived: boolean,
 *  user: string
 * }} LoginInfo
 */

export class UserService {
  /**
   *
   * @returns {Promise<LoginInfo>}
   */
  async getLoginInfo() {
    return (
      (await browser.storage.local.get("checkLoginData")).checkLoginData || {
        hasLoggedIn: false,
        isActived: false,
        user: "",
      }
    );
  }
}

export const userService = new UserService();
