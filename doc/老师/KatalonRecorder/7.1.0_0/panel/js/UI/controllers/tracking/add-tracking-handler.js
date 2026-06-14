import {
  Tracker,
  trackingTestCase,
  trackingTestSuite,
  trackingAddTestStep,
  trackingDeleteTestStep,
  trackingCopyTestStep,
  trackingPasteTestStep,
  trackingSelectTargetElement,
  trackingHightlightTargetElement,
  trackingPause,
  trackingOpenTestOpsReport,
  trackingOpenExport,
  trackingOpenHelp,
  trackingOpenAdjustSpeed,
  trackingOpenGithub,
  trackingOpenSetting,
  trackingOpenExtendedFeatures,
  trackingOpenDialyUsage,
  trackingSignin,
} from "../../services/tracking-service/segment-tracking-service.js";

let isUI = false;
$(() => {
  browser.storage.local.get("extensions").then(function (result) {
    extensions = result.extensions;
    if (!extensions) {
      extensions = {};
    }
    Tracker.openApplication({
      num_custom_keyword_files: Object.keys(extensions).length,
    });
  });

  $("#grid-add-btn").on("click", function () {
    trackingAddTestStep("UI");
    isUI = true;
  });

  $("#grid-delete-btn").on("click", function () {
    trackingDeleteTestStep("UI");
    isUI = true;
  });

  $("#grid-copy-btn").on("click", function () {
    trackingCopyTestStep("UI");
    isUI = true;
  });

  $("#grid-paste-btn").on("click", function () {
    trackingPasteTestStep("UI");
    isUI = true;
  });

  $("#grid-add").click(() => {
    if (!isUI) {
      trackingAddTestStep("context");
    }
    isUI = false;
  });

  $("#grid-delete").click(() => {
    if (!isUI) {
      trackingDeleteTestStep("context");
    }
    isUI = false;
  });

  $("#grid-copy").click(() => {
    if (!isUI) {
      trackingCopyTestStep("context");
    }
    isUI = false;
  });

  $("#grid-paste").click(() => {
    if (!isUI) {
      trackingPasteTestStep("context");
    }
    isUI = false;
  });

  $("#selectElementButton").click(() => {
    if (!isUI) {
      trackingSelectTargetElement();
    }
    isUI = false;
  });

  $("#showElementButton").click(() => {
    trackingHightlightTargetElement();
  });

  $("#pause").click(() => {
    trackingPause();
  });

  $("#add-testCase").click(function () {
    trackingTestCase("create", "UI");
  });
  $("#add-testSuite").click(function () {
    trackingTestSuite("UI");
  });

  $("#export").click(function () {
    trackingOpenExport();
  });

  $("#help.sub_btn").click(() => {
    trackingOpenHelp();
  });

  $("#speed").click(() => {
    trackingOpenAdjustSpeed();
  });

  $("#settings").click(() => {
    trackingOpenSetting();
  });

  $("#github").click(() => {
    trackingOpenGithub();
  });

  $("#extended-features").click(() => {
    trackingOpenExtendedFeatures();
  });

  $("#dailyUsage").click(() => {
    trackingOpenDialyUsage();
  });

  $("#login-button").click(() => {
    trackingSignin();
  });
});

$(document).on("click mousedown", "p,span", function (event) {
  setTimeout(() => {
    if (
      $(event.target).is(".selectedCase") ||
      $(event.target).parent().is(".selectedCase")
    ) {
      trackingTestCase("open");
    }
  }, 500);
});

$("#ka-upload-log").click(function () {
  trackingOpenTestOpsReport();
});

$("#ka-upload").click(function () {
  if (!$("#ka-upload").hasClass("disable")) {
    trackingOpenTestOpsReport();
  }
});

const port = browser.runtime.connect();
