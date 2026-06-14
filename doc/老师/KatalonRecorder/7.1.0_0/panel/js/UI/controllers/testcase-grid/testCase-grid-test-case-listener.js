// import { checkLoginOrSignupUserForCreateTestCase } from "../../../../../content-marketing/panel/login-inapp.js";
import { deleteTestCase } from "../../services/data-service/test-case-service.js";
import { getSelectedSuite } from "../../view/testCase-grid/selected-suite.js";
import {
  createTestSuite,
  findTestSuiteById,
} from "../../services/data-service/test-suite-service.js";
import {
  renderNewTestSuite,
  testSuiteDropdownOpen,
} from "../../view/testcase-grid/render-new-test-suite.js";
import { renderNewTestCase } from "../../view/testcase-grid/render-new-test-case.js";
import { getSelectedCase } from "../../view/testCase-grid/selected-case.js";
import { displayConfirmCloseDialog } from "../../view/testcase-grid/display-confirm-close-suite-dialog.js";
import { disableButton } from "../../view/buttons.js";
import { downloadSuite } from "../../services/html-service/download-suite.js";
import { TestCase } from "../../models/test-model/test-case.js";
import {
  UsageKey,
  isNewDay,
  usageWatcher,
} from "../../services/tracking-service/UsageWatcher.js";
import { userService } from "../../services/user-services/UserService.js";
import { popupPromoteSignup } from "../../../../../content-marketing/panel/popup-promote-signup.js";

async function trackingCheckLogin() {
  let data = await browser.storage.local.get("checkLoginData");
  data.checkLoginData.testCreated++;
  await browser.storage.local.set(data);
}

function removeTestCase(testCaseContainerElement) {
  testCaseContainerElement.parentNode.removeChild(testCaseContainerElement);
  clean_panel();
  const testCaseID = testCaseContainerElement.id;
  deleteTestCase(testCaseID);
}

$(document).ready(function () {
  $("#add-testCase").click(async function () {
    const testCaseTitle = prompt(
      "Please enter the Test Case's name",
      "Untitled Test Case"
    );
    if (testCaseTitle) {
      /*** Comment out for KR-522 ***/
      // make sure user login and sign up after threshold before making new test case
      // if (!(await checkLoginOrSignupUserForCreateTestCase())) {
      //   return;
      // }
      /*** Comment out for KR-522 ***/

      trackingCheckLogin();
      let selectedTestSuite = getSelectedSuite();
      let testSuite;
      if (!selectedTestSuite) {
        //if there are no test suits, create new one
        testSuite = createTestSuite("Untitled Test Suite");
        renderNewTestSuite("Untitled Test Suite", testSuite.id);
      } else {
        //get test suite data object from in-memory data object
        const testSuiteID = selectedTestSuite.id;
        testSuite = findTestSuiteById(testSuiteID);
      }
      //find corrected index to insert test case
      let index = testSuite.getTestCaseCount();
      const selectedTestCaseElement = getSelectedCase();
      if (selectedTestCaseElement) {
        index = testSuite.findTestCaseIndexByID(selectedTestCaseElement.id) + 1;
      }
      const testCase = new TestCase(testCaseTitle);
      testSuite.insertNewTestCase(index, testCase);

      renderNewTestCase(testCaseTitle, testCase.id);
      testSuiteDropdownOpen(testSuite.id);

      const user = await userService.getLoginInfo();
      if (!user.hasLoggedIn) {
        const createTestCaseUsage = await usageWatcher.countCreatingTestCase();
        const promoteSignUpUsage = await usageWatcher.loadUsageRecord(
          UsageKey.PROMOTE_SIGN_UP
        );
        if (
          createTestCaseUsage.count >= 2 &&
          isNewDay(promoteSignUpUsage.lastTime)
        ) {
          popupPromoteSignup("create-second-test-case");
        }
      }
    }
  });

  $("#delete-testCase").click(async function () {
    const selectedCase = getSelectedCase();
    const selectedSuite = getSelectedSuite();
    if (selectedCase) {
      let html = `<div style="color:red">This action will remove your test case or changes made to your test case permanently, you can open it again only if a copy is available on your computer.</div>
            </br>
            <div>Save this test case to your computer?</div>`;
      let userAnswer = await displayConfirmCloseDialog(html);
      if (userAnswer === "true")
        downloadSuite(selectedSuite, function () {
          removeTestCase(selectedCase);
        });
      else removeTestCase(selectedCase);
      // disable play button when there are no test cases left.
      const testSuiteID = selectedSuite.id;
      const testSuite = findTestSuiteById(testSuiteID);
      if (testSuite.getTestCaseCount() === 0) {
        disableButton("playback");
      }
    }
  });
});
