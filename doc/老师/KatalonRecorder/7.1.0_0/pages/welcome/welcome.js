import AuthService from "../../panel/js/UI/services/auth-service/auth-service.js";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  await browser.runtime.sendMessage("open-panel");
  await delay(1000); // Wait for KR panel to open
  const loginUrl = await AuthService.getUniversalLoginUrl();
  location.href = loginUrl;
})();
