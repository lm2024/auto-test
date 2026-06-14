import { getSelectedCase } from "../../view/testcase-grid/selected-case.js";
import { getSelectedSuite } from "../../view/testcase-grid/selected-suite.js";
import { findTestCaseById } from "../data-service/test-case-service.js";
import { findTestSuiteById } from "../data-service/test-suite-service.js";

async function setSegmentUser(email) {
  const { segment = {} } = await browser.storage.local.get("segment");
  segment.user = email;
  await browser.storage.local.set({ segment });
}

function getLoggedInUserAPI() {
  return fetch(`${getKatalonEndpoint()}wp-json/restful_api/v1/auth/kr/me`)
    .then((response) => response.json())
    .then((data) => {
      let user;
      if (data.user_info) {
        user = { email: data.user_info };
      } else {
        user = {};
      }
      return Promise.resolve(user);
    })
    .catch((error) => {
      console.log(error);
      return Promise.resolve({});
    });
}

function getKatalonEndpoint() {
  let manifestData = browser.runtime.getManifest();
  return manifestData.homepage_url;
}

function getSegmentEndpoint() {
  let manifestData = browser.runtime.getManifest();
  return manifestData.segment_url;
}

async function trackingSegmentAPI(data) {
  if (!data.properties) {
    data.properties = {};
  }
  data.properties.browser_name = await getBrowserName();
  const browserIds = await getTrackingBrowserIds();
  Object.assign(data.properties, browserIds);

  return browser.storage.local.get("setting").then((settingData) => {
    if (
      settingData.setting.tracking ||
      data.event === "kru_install_application"
    ) {
      let fetchData = {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-type": "application/json; charset=UTF-8" },
      };
      return fetch(
        `${getSegmentEndpoint()}/segment-kr/tracking`,
        fetchData
      ).then((data) => data);
    }
  });
}

async function trackingSegment(event, action) {
  browser.storage.local.get("segment").then(async function (result) {
    if (!result.segment) {
      result = {
        segment: {
          userId: await getAnonymousId(),
          user: "",
        },
      };
      let user = await getLoggedInUserAPI();

      if (user.email) {
        result.segment.user = user.email.email;
      }
      browser.storage.local.set(result);
    }

    let data = {
      userId: "",
      event: event,
    };
    let segment = result.segment;
    let properties = {};

    if (segment.userId) {
      data.userId = segment.userId;
    }

    if (segment.user) {
      properties.user = segment.user;
    } else {
      let user = await getLoggedInUserAPI();
      if (user.email) {
        result.segment.user = user.email.email;
        properties.user = user.email.email;
      }
      browser.storage.local.set(result);
    }

    if (action) {
      for (const key in action) {
        if (Object.hasOwnProperty.call(action, key)) {
          const element = action[key];
          properties[key] = element;
        }
      }
    }
    data.properties = properties;
    return trackingSegmentAPI(data);
  });
}

async function trackingInstallApp() {
  let data = {
    userId: await getAnonymousId(),
    event: "kru_install_application",
    properties: {},
  };
  browser.storage.local.get("segment").then(async function (result) {
    if (!result.segment) {
      result = {
        segment: {
          userId: data.userId,
          user: "",
        },
      };
      let user = await getLoggedInUserAPI();
      if (Object.keys(user).length !== 0) {
        result.segment.user = user.email.email;
        data.properties.user = user.email.email;
      }
      await browser.storage.local.set(result);
      return trackingSegmentAPI(data);
    }
  });
}

function trackingUninstallApp() {
  return trackingSegment("kru_uninstall_application");
}

function trackingCloseApp() {
  return trackingSegment("kru_close_application");
}

function trackingLogin() {
  return trackingSegment("kru_login");
}

function trackingSignin() {
  return trackingSegment("kru_signin_btn_click");
}

function trackingSignup() {
  return trackingSegment("kru_signup");
}

function trackingRecord() {
  return trackingSegment("kru_record");
}

function trackingCreateTestCase(source, testCaseId) {
  let action = {
    source: source,
    test_case_id: testCaseId,
  };
  return trackingSegment("kru_create_test_case", action);
}

function trackingCreateTestSuite(source, testSuiteId, type) {
  let action = {
    source: source,
    test_suite_id: testSuiteId,
  };

  if (type) {
    action.type = type;
  }

  return trackingSegment("kru_create_test_suite", action);
}

function trackingTestCase(type, source, status, isSelfHealing) {
  setTimeout(() => {
    const selectedTestCaseElement = getSelectedCase();
    if (selectedTestCaseElement) {
      const testCaseID = selectedTestCaseElement.id;
      let title = $(getSelectedCase()).children("span").text();
      switch (type) {
        case "create":
          trackingCreateTestCase(source, title);
          break;
        case "open":
          // Temporary disable openTestCase because it also gets fired repeatedly
          // trackingOpenTestCase(title);
          break;
        case "execute":
          trackingExecuteTestCase(title, status, isSelfHealing, testCaseID);
          break;
        default:
          break;
      }
    }
  }, 500);
}

function trackingTestSuite(source) {
  setTimeout(() => {
    if (getSelectedSuite()) {
      let title = $(getSelectedSuite()).find("strong.test-suite-title").text();
      trackingCreateTestSuite(source, title);
    }
  }, 500);
}

function trackingExecuteTestSuites(type, isSelfHealing) {
  const selectedTestSuite = getSelectedSuite();
  const testSuite = findTestSuiteById(selectedTestSuite.id);
  let title = testSuite.name;
  let numSuccessedTestCase = $(".test-case-title.success").length;
  let numFailedTestCase = $(".test-case-title.fail").length;

  switch (type) {
    case "suite":
      trackingExecuteTestSuite(
        title,
        numSuccessedTestCase,
        numFailedTestCase,
        isSelfHealing,
        undefined
      );
      break;
    case "all":
      trackingExecuteAll(
        numSuccessedTestCase,
        numFailedTestCase,
        isSelfHealing,
        undefined
      );
      break;
    case "dynamic":
      trackingExecuteTestSuite(
        title,
        numSuccessedTestCase,
        numFailedTestCase,
        isSelfHealing,
        null,
        "dynamic"
      );
      break;
    default:
      break;
  }
}

function trackingOpenTestCase(testCaseId) {
  let action = {
    test_case_id: testCaseId,
  };
  return trackingSegment("kru_open_test_case", action);
}

function trackingSaveTestCase(source, testCaseId) {
  let action = {
    source: source,
    test_case_id: testCaseId,
  };
  return trackingSegment("kru_save_test_case", action);
}

function trackingSaveTestSuite(source, testSuiteId) {
  let action = {
    source: source,
    test_suite_id: testSuiteId,
  };
  return trackingSegment("kru_save_test_suite", action);
}

function trackingAddTestStep(source) {
  let action = {
    source: source,
  };
  return trackingSegment("kru_add_test_step", action);
}

function trackingDeleteTestStep(source) {
  let action = {
    source: source,
  };
  return trackingSegment("kru_delete_test_step", action);
}

function trackingCopyTestStep(source) {
  let action = {
    source: source,
  };
  return trackingSegment("kru_copy_test_step", action);
}

function trackingPasteTestStep(source) {
  let action = {
    source: source,
  };
  return trackingSegment("kru_paste_test_step", action);
}

function trackingSelectTargetElement() {
  return trackingSegment("kru_select_target_element");
}

function trackingHightlightTargetElement() {
  return trackingSegment("kru_highlight_target_element");
}

function trackingExecuteTestCase(
  testCaseName,
  status,
  isSelfHealing,
  testCaseId
) {
  const testCase = findTestCaseById(testCaseId);
  const isContainLoadVars = testCase.commands.some(
    (command) => command.name === "loadVars"
  );
  let action = {
    test_case_id: testCaseName,
    status: status,
    is_self_healing_triggered: isSelfHealing,
    "data-driven": isContainLoadVars,
  };
  return trackingSegment("kru_execute_test_case", action);
}

function trackingExecuteTestSuite(
  testSuiteId,
  noSuccessedTestCase,
  noFailedTestCase,
  isSelfHealing,
  isConsole,
  type
) {
  let action = {
    test_suite_id: testSuiteId,
    no_successed_test_case: noSuccessedTestCase,
    no_failed_test_case: noFailedTestCase,
    is_self_healing_triggered: isSelfHealing,
    is_console: isConsole,
  };

  if (type) {
    action.type = type;
  }
  return trackingSegment("kru_execute_test_suite", action);
}

function trackingExecuteAll(
  noSuccessedTestCase,
  noFailedTestCase,
  isSelfHealing
) {
  let action = {
    no_successed_test_case: noSuccessedTestCase,
    no_failed_test_case: noFailedTestCase,
    is_self_healing_triggered: isSelfHealing,
  };
  return trackingSegment("kru_execute_all", action);
}

function trackingPause() {
  return trackingSegment("kru_pause");
}

function trackingOpenTestOpsReport() {
  return trackingSegment("kru_open_testops_report");
}

function trackingOpenExport() {
  return trackingSegment("kru_open_export");
}

function trackingExportTestCase(source) {
  let action = {
    source: source,
  };
  return trackingSegment("kru_export_test_case", action);
}

function trackingOpenHelp() {
  return trackingSegment("kru_open_help");
}

function trackingOpenAdjustSpeed() {
  return trackingSegment("kru_open_adjust_speed");
}

function trackingOpenGithub() {
  return trackingSegment("kru_open_github");
}

function trackingOpenSetting() {
  return trackingSegment("kru_open_setting");
}

function trackingOpenExtendedFeatures() {
  return trackingSegment("kru_open_extended_features");
}

function trackingOpenDialyUsage() {
  return trackingSegment("kru_open_daily_usage");
}

function trackingNPSScore(score, review) {
  let action = {
    score: score,
    review: review,
  };
  return trackingSegment("kru_nps_score", action);
}

function trackingNPSWebStrore(browser) {
  let action = {
    browser: browser,
  };
  return trackingSegment("kru_web_store_review_click", action);
}

function trackingOpenedUserManual() {
  return trackingSegment("kru_open_user_manual");
}

function trackingCompletedTutorials(completedTutorials) {
  let action = {
    completedTutorials: completedTutorials,
  };
  return trackingSegment("kru_total_tutorials_completed", action);
}

function trackingReplayGettingStarted() {
  return trackingSegment("kru_replay_getting_started");
}

function trackingCloseUserManualWithoutDoingAnything() {
  return trackingSegment("kru_closed_user_manual_did_nothing");
}

function trackingTickedDoneTutorial(tutorialId) {
  let action = {
    tutorialId: tutorialId,
  };

  return trackingSegment("kru_completed_tutorial", action);
}

function trackingClickedTutorial(tutorialId) {
  let action = {
    tutorialId: tutorialId,
  };

  return trackingSegment("kru_clicked_tutorial", action);
}

function trackingSkippedTheTour() {
  return trackingSegment("kru_skip_the_tour");
}

function trackingCompletedTheTour() {
  return trackingSegment("kru_complete_the_tour");
}

function trackingSkippedStep(stepId) {
  let action = {
    stepId: stepId,
  };
  return trackingSegment("kru_skip_step", action);
}

class Tracker {
  static upload(artifactType, props) {
    const allProps = {
      artifact_type: artifactType,
      ...props,
    };
    return this.track("kru_upload_artifact", allProps);
  }

  static uploadKeyword(triggerPath) {
    return this.upload("keyword-file", { trigger_path: triggerPath });
  }

  static openApplication(props = { num_custom_keyword_files: 0 }) {
    this.track("kru_open_application", props);
  }

  static uiAction(uiPart, action, triggerPath) {
    this.track("kru_ui_action", {
      ui_part: uiPart,
      action,
      trigger_path: triggerPath,
    });
  }

  static promoteSignUpPopupAction(action, triggerPath) {
    this.uiAction("promote-signup-popup", action, triggerPath);
  }

  static track(eventName, props) {
    return trackingSegment(eventName, props);
  }
}

export {
  Tracker,
  trackingInstallApp,
  trackingUninstallApp,
  trackingCloseApp,
  trackingLogin,
  trackingSignin,
  trackingSignup,
  trackingRecord,
  trackingTestCase,
  trackingTestSuite,
  trackingCreateTestCase,
  trackingCreateTestSuite,
  trackingOpenTestCase,
  trackingSaveTestCase,
  trackingSaveTestSuite,
  trackingAddTestStep,
  trackingDeleteTestStep,
  trackingCopyTestStep,
  trackingPasteTestStep,
  trackingSelectTargetElement,
  trackingHightlightTargetElement,
  trackingExecuteTestCase,
  trackingExecuteTestSuite,
  trackingExecuteTestSuites,
  trackingExecuteAll,
  trackingPause,
  trackingOpenTestOpsReport,
  trackingOpenExport,
  trackingExportTestCase,
  trackingOpenHelp,
  trackingOpenAdjustSpeed,
  trackingOpenGithub,
  trackingOpenSetting,
  trackingOpenExtendedFeatures,
  trackingOpenDialyUsage,
  trackingSegment,
  trackingNPSScore,
  trackingNPSWebStrore,
  trackingOpenedUserManual,
  trackingCompletedTutorials,
  trackingReplayGettingStarted,
  trackingTickedDoneTutorial,
  trackingClickedTutorial,
  trackingCloseUserManualWithoutDoingAnything,
  trackingSkippedTheTour,
  trackingCompletedTheTour,
  trackingSkippedStep,
  setSegmentUser,
};
