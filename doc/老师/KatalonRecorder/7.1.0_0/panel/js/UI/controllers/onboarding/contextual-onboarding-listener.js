import {
  getChangedProperty,
  getTrackingPlayBackData,
  isUserFirstTime
} from "../../services/tracking-service/playback-local-tracking.js";
import { displayTipPanel } from "../../services/onboarding-service/display-tips-panel.js";
import { getTrackingLeftSidePanelData } from "../../services/tracking-service/left-side-panel-tracking.js";
import { getSelectedCase } from "../../view/testcase-grid/selected-case.js";
import { getTrackingPopupData, setTrackingPopupData } from "../../services/tracking-service/popup-tracking.js";


async function displayRecordTips() {
  let data = await getTrackingPlayBackData();
  const popUpTrackingData = await getTrackingPopupData();
  if (isUserFirstTime(data)) {
    let panelDescription = {
      element: "#record",
      content: "Go to the tab you want to automate and click Record to start creating an automation script.",
      placement: "bottom",
      title: "Product Tip",
      animation: false
    }
    displayTipPanel(panelDescription);
  } else if (data.recordNum === 1) {

    // if (data.playTestCaseSuccess === 0){
    //   let panelDescription = {
    //     element: "#playback",
    //     content: "Click Play to execute or click Record to append more steps to the automation script you just created.",
    //     placement: "bottom",
    //     title: "Product Tip",
    //     animation: false
    //   }
    //   displayTipPanel(panelDescription);
    // }
  }
}

async function displayPlayTessCaseFailTips() {
  let data = await getTrackingPlayBackData();
  if (data.playTestCaseFail === 1) {
    // let panelDescription = {
    //   element: "#records-grid .fail",
    //   content: `Take a look at <a target="_blank" href="https://docs.katalon.com/katalon-recorder/docs/faq-and-troubleshooting-instructions.html">our FAQ page.</a>`,
    //   placement: "bottom",
    //   title: "Product Tip",
    //   animation: false
    // }
    // displayTipPanel(panelDescription);
  } else if (data.playTestCaseFail === 2) {
    // let panelDescription = {
    //   element: "#records-grid .fail",
    //   content: `Open a topic on our <a target="_blank" href="https://forum.katalon.com/c/katalon-recorder/">community</a> to ask experts for help.`,
    //   placement: "bottom",
    //   title: "Product Tip",
    //   animation: false
    // }
    // await displayTipPanel(panelDescription);
  }

}

async function displayPlayTessCaseSuccessTips() {
  let data = await getTrackingPlayBackData();
  if (data.playTestCaseSuccess === 1) {
    /*let panelDescription = {
      element: "#template-open .title",
      content: `Congrats! Add templates to help you automate more things.`,
      placement: "right",
      title: "Product Tip",
      animation: false
    }
    await displayTipPanel(panelDescription);*/
    $("#template-open").click();
  }
}

async function displaySaveTestCaseTip() {
  const data = await getTrackingLeftSidePanelData();
  if (data.saveTestCaseNum === 1) {
    const selectedTestCase = getSelectedCase();
    let panelDescription = {
      element: `#${selectedTestCase.id}`,
      content: `Your test case is saved to local storage (due to browser extensions' limitations). To download them to your computer, choose Download Test Suite.`,
      placement: "right",
      title: "Product Tip",
      animation: false
    }
    await displayTipPanel(panelDescription);
  }
}

async function displayAddTestDataTip() {
  const data = await getTrackingLeftSidePanelData();
  if (data.addTestData === 1) {
    let panelDescription = {
      element: `#data0`,
      content: `Right-click on a Test Data and choose <b>Use this in a test case</b>.`,
      placement: "right",
      title: "Product Tip",
      animation: false
    }
    await displayTipPanel(panelDescription);
  }
}

$(document).ready(function () {
  browser.storage.local.get("firstTime").then(result => {
    if (result.firstTime) {
      // displayRecordTips();
    }
  })
  browser.storage.onChanged.addListener(async (changes) => {
    if (Object.keys(changes).includes("playbackTracking")) {
      let oldValue = changes.playbackTracking.oldValue;
      let newValue = changes.playbackTracking.newValue;
      let changeProperty = getChangedProperty(oldValue, newValue);
      switch (changeProperty) {
        case "recordNum":
          await displayRecordTips();
          break;
        case "playTestCaseSuccess":
          await displayPlayTessCaseSuccessTips();
          break;
        case "playTestCaseFail":
          await displayPlayTessCaseFailTips();
          break;
        case "saveTestCase":
          await displaySaveTestCaseTip();
          break;
      }
    }

    if (Object.keys(changes).includes("leftSidePanelTracking")) {
      let oldValue = changes.leftSidePanelTracking.oldValue;
      let newValue = changes.leftSidePanelTracking.newValue;
      let changeProperty = getChangedProperty(oldValue, newValue);
      switch (changeProperty) {
        case "saveTestCaseNum":
          await displaySaveTestCaseTip();
          break;
        case "addTestData":
          await displayAddTestDataTip();
          break;
      }
    }
  });
});
