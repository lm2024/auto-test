import { generatePKCE } from "../../../../../utils/generatePKCE.js";

const CLIENT_ID = "katalon-recorder";

export const REDIRECT_URI = `chrome-extension://${chrome.runtime.id}/katalon/authenticated.html`;

const AUTH_BASE_ENDPOINT = "https://login.katalon.com";
const OPENID_CONNECT =
  AUTH_BASE_ENDPOINT + "/realms/katalon/protocol/openid-connect";
const LOGIN_URL = OPENID_CONNECT + "/auth";
const LOGOUT_URL = OPENID_CONNECT + "/logout";
const GET_TOKEN_URL = OPENID_CONNECT + "/token";

export default class AuthService {
  static async getUniversalLoginUrl() {
    const codeChallenge = (await generatePKCE()).code_challenge;
    const url = `${LOGIN_URL}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    return url;
  }

  static async openUniversalLoginUrl() {
    const url = await this.getUniversalLoginUrl();
    await browser.windows.create({
      url: url,
      type: "popup",
      focused: true,
    });
  }

  static async logout() {
    const refreshToken = (await browser.storage.local.get("refreshToken"))
      .refreshToken;
    const formData = new URLSearchParams();
    formData.append("refresh_token", refreshToken);
    formData.append("client_id", CLIENT_ID);
    return fetch(LOGOUT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });
  }

  static async getToken(codeParam) {
    const codeVerifier = (await browser.storage.local.get("codePKCE")).codePKCE
      .code_verifier;

    const formData = new URLSearchParams();
    formData.append("code", codeParam);
    formData.append("grant_type", "authorization_code");
    formData.append("client_id", CLIENT_ID);
    formData.append("redirect_uri", REDIRECT_URI);
    formData.append("code_verifier", codeVerifier);

    return fetch(GET_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });
  }
}
