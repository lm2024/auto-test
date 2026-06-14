import { getTrackingPlayBackData } from "../../panel/js/UI/services/tracking-service/playback-local-tracking.js";
import { getCheckLoginData, setLoginOrSignup } from "./login-inapp.js";

export function popupPlaySuiteQuotaAndCreateDynamicTestSuite() {
    let popup = $("#playSuiteQuotaDialog");
    if (popup.length) {
        $(popup).show().effect("shake");
        return;
    }

    let dialogHTML = `
    <div style="text-align:center; font-size: 15px;"><strong>Is it time to gain more confidence?</strong></div>
    </br>
    <span>
    Sign up for a <b>free</b> Katalon account to get access to unlimited test suite executions and the ability to execute test cases dynamically with tags.
    </span>
    <style>
        .playSuiteQuotaBtn{
            border-radius: 5px;
            padding: 5px;
            border: none;
            color: black
        }
        #playSuiteQuota-later:hover{
            background-color: #d7dbdb;
        }
        #playSuiteQuota-okay{
            background-color: #3366FF;
            color: white;
            border-radius: 5px;
        }
        #playSuiteQuota-okay:hover{
            background-color: #1d42af;
        }
    </style>
    <div style="margin-top:10px; text-align: right">
        <button id="playSuiteQuota-later" class="playSuiteQuotaBtn" type="button" style="margin-right: 10px"><u>Maybe later</u></button>
        <button id="playSuiteQuota-okay" class="playSuiteQuotaBtn" type="button">Automate more</button>
    </div>`;

    popup = $('<div id="playSuiteQuotaDialog"></div>').css({
        'position': 'absolute',
        'display': 'none',
        'bottom': '50px',
        'z-index': '1',
        'background-color': '#f1f1f1',
        'max-width': '300px',
        'box-shadow': '0px 8px 16px 0px rgba(0,0,0,0.2)',
        'padding': '10px',
        'margin-bottom': '-1%',
        'right': '0',
        'color': "black"

    }).html(dialogHTML);
    $("body").append(popup);

    $("#playSuiteQuota-later").click(function() {
        $(popup).hide();
    });

    $("#playSuiteQuota-okay").click(function() {
        setLoginOrSignup();
        $(popup).hide();
    });
    $(popup).show().effect("shake")

}

export async function checkLoginOrSignupUserForPlayTestSuite() {
  const playTestSuiteThreshold = 1;
  const loginData = (await getCheckLoginData()).checkLoginData;
  const onboardingChoice = (
    await browser.storage.local.get("onBoardingUserChoice")
  ).onBoardingUserChoice;

  const playbackData = await getTrackingPlayBackData();
  if (
    !loginData?.isActived &&
    playbackData.playSuite >= playTestSuiteThreshold &&
    onboardingChoice?.use_case?.includes("Kickstart test automation")
  ) {
    popupPlaySuiteQuotaAndCreateDynamicTestSuite();
    return false;
  }
  return true;
}