import { getCheckLoginData } from "./login-inapp.js";
import { popupPlaySuiteQuotaAndCreateDynamicTestSuite } from "./popup-play-suite-quota.js";
import { getTrackingLeftSidePanelData } from "../../panel/js/UI/services/tracking-service/left-side-panel-tracking.js";

export async function checkLoginOrSignupUserForCreateDynamicTestSuite() {
  const createDynamicThreshold = 0;
  const loginData = (await getCheckLoginData()).checkLoginData;
  const onboardingChoice = (
    await browser.storage.local.get("onBoardingUserChoice")
  ).onBoardingUserChoice;
  const leftSidePanelData = await getTrackingLeftSidePanelData();

  if (
    !loginData?.isActived &&
    leftSidePanelData.addDynamicTestSuite >= createDynamicThreshold &&
    onboardingChoice?.use_case?.includes("Kickstart test automation")
  ) {
    popupPlaySuiteQuotaAndCreateDynamicTestSuite();
    return false;
  }
  return true;
}