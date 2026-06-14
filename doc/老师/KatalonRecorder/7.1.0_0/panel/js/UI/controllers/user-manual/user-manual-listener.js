import { initialStates, userManualDialog } from "../../view/dialog/user-manual-dialog.js";
import {
  trackingOpenedUserManual,
  trackingCompletedTutorials
} from "../../services/tracking-service/segment-tracking-service.js";


const trackingUserManualCompletion = async (completedTutorials, totalTutorials) => {
  try {
    trackingCompletedTutorials(completedTutorials);
    if (completedTutorials === totalTutorials) {
      browser.storage.local.set({ tutorialsCompleted: true });
    }
  } catch (error) {
    console.log(error);
  }
}

const updateNotification = async (flag = false) => {
  let data = await browser.storage.local.get("tutorialStates");
  let completion = await browser.storage.local.get("tutorialsCompleted");
  let allTutorialStates = data.tutorialStates ?? initialStates;
  let tutorialStates = allTutorialStates.slice(1, 4);
  let tutorialsCompleted = completion.tutorialsCompleted ?? false;

  /* Begin tracking */
  let totalTutorials = tutorialStates.length;
  let checkedTutorials = tutorialStates.reduce((totalChecked, state) => (
    state ? totalChecked += 1 : totalChecked
  ), 0);

  if (!flag && !tutorialsCompleted) {
    trackingUserManualCompletion(checkedTutorials, totalTutorials);
  }
  /* End tracking */

  totalTutorials = allTutorialStates.length;
  checkedTutorials = allTutorialStates.reduce((totalChecked, state) => (
    state ? totalChecked += 1 : totalChecked
  ), 0);

  if (totalTutorials - checkedTutorials === 0) {
    $("#user-manual-count").remove();
    return;
  }

  if ($("#user-manual-count").length) {
    $("#user-manual-count").html(`<div>${totalTutorials - checkedTutorials}</div>`);
    return;
  }

  let remainingTutorials = $(`<div id='user-manual-count'></div>`).html(`<div>${totalTutorials - checkedTutorials}</div>`);
  $("#user-manual-icon").append($(remainingTutorials));
}

$(document).ready(function () {
  updateNotification(true);

  $("#user-manual").click(function () {
    $("#helpDialog").dialog("close");
    userManualDialog(updateNotification);
    trackingOpenedUserManual();
  })

  $("#user-manual-icon").click(function () {
    userManualDialog(updateNotification);
    trackingOpenedUserManual();
  })
})