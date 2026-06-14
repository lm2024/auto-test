import { initPopupOnboarding } from "../onboarding/new-onboarding.js";
import {
  trackingCompletedTheTour,
  trackingReplayGettingStarted,
  trackingTickedDoneTutorial,
  trackingClickedTutorial,
  trackingCloseUserManualWithoutDoingAnything
} from "../../services/tracking-service/segment-tracking-service.js";

const tutorials = [
  {
    id: "tutorial0",
    link: "",
    text: "Getting Started"
  },
  {
    id: "tutorial1",
    link: "https://docs.katalon.com/katalon-recorder/docs/how-to-extract-and-verify-textual-patterns-in-a-test-case.html",
    text: "Verify or assert textual patterns on the page"
  },
  {
    id: "tutorial2",
    link: "https://docs.katalon.com/katalon-recorder/docs/how-to-use-conditional-statements-in-a-test-case.html",
    text: "Flow controls"
  },
  {
    id: "tutorial3",
    link: "https://docs.katalon.com/katalon-recorder/docs/write-and-extract-data.html",
    text: "Extract and write data down to files"
  },
  {
    id: "tutorial4",
    link: "https://docs.katalon.com/katalon-recorder/docs/implement-data-driven-testing-in-a-test-case.html",
    text: "Run tests with multiple data sets"
  }
];

export const initialStates = [false, false, false, false, false];

export async function userManualDialog(updateNotification) {
  let data = await browser.storage.local.get("tutorialStates");
  let tutorialStates = data.tutorialStates ?? initialStates;

  let totalTutorials = tutorialStates.length;
  let checkedTutorials = tutorialStates.reduce((totalChecked, state) => (
    state ? totalChecked += 1 : totalChecked
  ), 0);

  function updateBoxesCount() {
    totalTutorials = $(".round input[type='checkbox']").length;
  }

  function updateCheckedBoxesCount() {
    checkedTutorials = $(".round input:checked").length;
    $("progress").prop("value", checkedTutorials);
    $("#progress-label").text(checkedTutorials + "/" + totalTutorials);
  }

  // Initialize the dialog HTML
  const bodyHTML = tutorials.reduce((reducedHTML, tutorial, index) => {
    let check = tutorialStates[index] ? "checked disabled" : "";
    let labelContent = tutorial.id == 'tutorial0' ?
      `${tutorial.text}`
      :`<a id="link-${tutorial.id}" href="${tutorial.link}" target="_blank">
        ${tutorial.text}
      </a>`

    return reducedHTML += `<div class="round">
      <input type="checkbox" id=${tutorial.id} ${check} />
      <label for=${tutorial.id}>
        ${labelContent}
      </label>
      <button id="directed-${tutorial.id}">
        <img src="${tutorial.id == 'tutorial0' ? "/katalon/images/SVG/new-redo-arrow.svg" : "./icons/open-link.svg"}" />
      </button>
    </div>`
  }, '');

  let dialogHTML = `
    <div class="tutorial-dialog-header">
      <div class="tutorial-dialog-title">User Manual</div>
      <button id="close-tutorial-dialog" class="close-tutorial-dialog">&times;</button>
    </div>
    <p style="font-size: 14px; padding: 2px 2px;">Tutorials to speed-up your automation journey with Katalon Recorder. Tick Done when you complete.</p>
    <div class="progress-bar">
      <progress class="animated" value="${checkedTutorials}" max="${totalTutorials}"></progress> 
      <span id="progress-label">${checkedTutorials}/${totalTutorials}</span>
    </div>
    <div class="tutorial-dialog-body">
    ${bodyHTML}
    </div>
    <style>
    .progress-bar {
      display: flex;
      align-items: center;
      padding-top: 12px;
      padding-bottom: 12px;
    }
    #progress-label {
      margin-left: 8px;
    }
    progress {
      height: 6px;
      width: 328px;
      background-color: #E8EBED;
      border-radius: 100px;
      overflow: hidden;
    }
    ::-webkit-progress-bar {
      background-color: #E8EBED; 
    }
    .animated::-webkit-progress-value {
      transition: width 1s;
      background-color: #339980;
    }
    .animated::-moz-progress-bar {
      transition: padding-bottom 1s;
      padding-left: 60px;
      padding-bottom: var(--value);
      background-color: #339980;
      height: 0;
      transform-origin: 0 0;
      transform: rotate(-90deg) translateX(-60px) ;
    }
    .animated::-ms-fill {
      background-color: #339980;
      border:0;
    }
    .round {
      padding-top: 12px;
      padding-bottom: 12px;
    }
    .round input {
      vertical-align: -6px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1px solid #D9D9D9;
      cursor: pointer;
      transition: box-shadow .3s;
      -webkit-appearance: none;
    }
    .round input:checked { 
      background: url("icons/new-checked.svg");
      background-position: center;
      background-size: contain;
      width: 16px;
      height: 16px;
      border: none;
      transition: box-shadow .3s;
    }
    .round label {
      font-size: 14px;
    }
    .round a {
      color: #276EF1;
    }
    .round button {
      position: absolute;
      right: 20px;
      padding-top: 3px;
      border: none;
      background: none;
      cursor: pointer;
    }
    .tutorial-dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #233145;
    }
    .tutorial-dialog-title{
      font-weight: bold;
      font-size: 20px;
    }
    .tutorial-dialog-body {
      display: flex;
      justify-content: space-evenly;
      align-items: flex-start;
      flex-direction: column;
      align-content: flex-start;
      margin-left: -5px;
    }
    .close-tutorial-dialog{
      cursor: pointer;
      border: none;
      outline: none;
      background: none;
      font-size: 24px;
      color: #808B9A;
    }
  </style>
  `;

  let popup = $('<div id="user-manual-dialog"></div>').css({
    'display': 'none',
    'position': 'fixed',
    'bottom': '10%',
    'right': '41px',
    'z-index': '1',
    'background-color': '#ffffff',
    'max-width': '350px',
    'height': 'auto',
    'box-shadow': '0px 8px 16px 0px rgba(0,0,0,0.25)',
    'padding': '16px 20px',
    'margin-bottom': '-1%',
    'border-radius': '6px',
    'color': 'black'
  }).html(dialogHTML).draggable();

  if ($("#user-manual-dialog").length == 0)
    $(".command-sample-section").append(popup);

  $(":checkbox").click(updateBoxesCount);
  $(":checkbox").click(updateCheckedBoxesCount);

  tutorials.forEach((tutorial, index) => {
    // Tick done
    $(`#${tutorial.id}`).click(async function () {
      if (!tutorialStates[index]) {
        tutorialStates[index] = true;
        this.disabled = true;

        if (tutorial.id == "tutorial0") {
          trackingCompletedTheTour();
        } else {
          trackingTickedDoneTutorial(tutorial.id);
        }

        await browser.storage.local.set({ doUserManual: true });
        await browser.storage.local.set({ tutorialStates: tutorialStates });
        await updateNotification(tutorial.id == "tutorial0");
      }
    });

    // Click on link
    if (tutorial.id != "tutorial0") {
      $(`#link-${tutorial.id}`).click(function () {
        trackingClickedTutorial(tutorial.id);
        browser.storage.local.set({ doUserManual: true });
      })
    }

    // Click on button
    $(`#directed-${tutorial.id}`).click(async function () {
      if (this.id.includes("tutorial0")) {
        const onBoardingUserChoice = (await browser.storage.local.get("onBoardingUserChoice")).onBoardingUserChoice;
        onBoardingUserChoice.checkedEndTour = false;
        browser.storage.local.set({ "onBoardingUserChoice": onBoardingUserChoice });

        const showElement = onBoardingUserChoice.tour.find(e => e.index == '1');
        initPopupOnboarding(showElement);
        trackingReplayGettingStarted();
        $("#user-manual-dialog").remove();
      } else {
        trackingClickedTutorial(tutorial.id);
        $("#user-manual-dialog").remove();
        window.open(tutorial.link, "_blank");
      }
    });
  });

  $("#close-tutorial-dialog").click(async function () {
    let localStorage = await browser.storage.local.get("doUserManual");
    let doUserManual = localStorage.doUserManual ?? false;

    if (!doUserManual) {
      trackingCloseUserManualWithoutDoingAnything();
    }

    // reset for next time
    await browser.storage.local.set({ doUserManual: false });

    $("#user-manual-dialog").remove();
  });

  $("#user-manual-dialog").show();
}
