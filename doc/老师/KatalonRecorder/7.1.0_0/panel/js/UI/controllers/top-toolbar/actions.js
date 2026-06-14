import { findTestSuiteById } from "../../services/data-service/test-suite-service.js";
import { getSelectedSuite } from "../../view/testcase-grid/selected-suite.js";
import { getCheckLoginData } from "../../../../../content-marketing/panel/login-inapp.js";
import {
  setSegmentUser,
  trackingLogin,
} from "../../services/tracking-service/segment-tracking-service.js";
import {
  setHubspotUser,
  trackingHubspotLogin,
} from "../../services/tracking-service/hubspot-tracking-service.js";
import AuthService, {
  REDIRECT_URI,
} from "../../services/auth-service/auth-service.js";

async function logout() {
  let result = await browser.storage.local.get("segment");
  let checkedResult = await browser.storage.local.get("checkLoginData");
  if (result.segment.user && checkedResult.checkLoginData.isActived) {
    await setSegmentUser("");
    await setHubspotUser("");

    checkedResult.checkLoginData.user = "";
    checkedResult.checkLoginData.isActived = false;
    checkedResult.checkLoginData.hasLoggedIn = false;
    browser.storage.local.set(checkedResult);

    $("#login-user").hide();
    $("#login-button").show();

    // logout from keycloak
    AuthService.logout()
      .then(() => {
        // logout from TestOps
        return fetch(testOpsUrls.logoutFromTestOps, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
      })
      .then(() => {
        updateTestOpsLoginToken();
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        browser.storage.local.remove("refreshToken");
      });
  }
}

async function setUserAfterLogin(accessToken) {
  const newValue = jwtJsDecode.decode(accessToken);
  const { email } = newValue.payload;
  const result = await getCheckLoginData();
  let checkLoginData = result.checkLoginData;
  checkLoginData.isActived = true;
  checkLoginData.hasLoggedIn = true;
  checkLoginData.user = email;
  await browser.storage.local.set(result);

  await setSegmentUser(email);
  await trackingLogin();
  await setHubspotUser(email);
  await trackingHubspotLogin();
}

$(() => {
  let setLoginTokenTimeout;

  $("#play").click(function (e) {
    const selectedTestSuite = getSelectedSuite();
    const testSuite = findTestSuiteById(selectedTestSuite.id);
    if (testSuite.status && testSuite.status === "dynamic") {
      $("#playSuite").click();
    } else {
      $("#playback").click();
    }
  });

  $("#btn-drd-play").click(() => {
    $("#dropdown-play")
      .css({
        "min-width": "140px",
        top: "35px",
        right: "-40px",
      })
      .toggle();
  });

  // $('#playback').click(function(e) {
  //     $('#dropdown-play').hide();
  // });

  $("#playSuite").click(function (e) {
    $("#dropdown-play").hide();
  });

  $("#playSuites").click(function (e) {
    $("#dropdown-play").hide();
  });

  // check sign in status on startup
  browser.storage.local.get("segment").then(async (result) => {
    let checkedResult = await browser.storage.local.get("checkLoginData");

    if (result.segment?.user && checkedResult.checkLoginData?.isActived) {
      $("#login-user").show();
      $("#login-button").hide();
      $("#logout-info").html(result.segment.user);
    }
  });

  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (Object.keys(changes).includes("checkLoginData")) {
      if (
        changes.checkLoginData.newValue.user &&
        changes.checkLoginData.newValue.isActived
      ) {
        const user = changes.checkLoginData.newValue.user;
        $("#login-user").show();
        $("#login-button").hide();
        $("#logout-info").html(user);
      }
    }
  });

  $("#login-button").click(async () => {
    await AuthService.openUniversalLoginUrl();
  });

  $("#login-user").click(() => {
    $("#logout-dropdown").toggle();
  });

  $("#logout-user").click(() => {
    // Clear timeout on signing out manually
    clearTimeout(setLoginTokenTimeout);

    logout();
    $("#logout-dropdown").toggle();
  });

  chrome.tabs.onUpdated.addListener(async function (tabId, changeInfo, tab) {
    if (tab.url.startsWith(REDIRECT_URI) && changeInfo.status === "loading") {
      const gotUrl = new URLSearchParams(tab.url);
      const codeParam = gotUrl.get("code");
      if (!codeParam) {
        return;
      }
      AuthService.getToken(codeParam)
        .then((response) => response.json())
        .then(async (data) => {
          const accessToken = data.access_token;
          await setUserAfterLogin(accessToken);
          const refreshToken = data.refresh_token;
          await browser.storage.local.set({ refreshToken });
          await chrome.tabs.remove(tabId);
          await browser.runtime.sendMessage("focus-panel");
          await browser.storage.local.remove("codePKCE");
          updateTestOpsLoginToken(accessToken);
          await browser.runtime.sendMessage("notify-logged-in");
        })
        .catch((error) => {
          console.error(error);
        });
    }
  });
});
