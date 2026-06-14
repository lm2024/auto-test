import { getSelectedSuite } from "./selected-suite.js";
import { getSelectedCase } from "./selected-case.js";
import {
  initAllSuite,
  playTestSuiteAction,
} from "../../../background/playback/service/actions/play/play-actions.js";
import { saveData } from "../../services/data-service/save-data.js";
import { removeDirtyMarks } from "./remove-dirty-mark.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { testSuiteDropdownOpen } from "./render-new-test-suite.js";
import { findTestSuiteById } from "../../services/data-service/test-suite-service.js";
import { TestCommand } from "../../models/test-model/test-command.js";
import { renderNewTestCase } from "./render-new-test-case.js";
import { TestCase } from "../../models/test-model/test-case.js";
import { setTrackingLeftSidePanelData } from "../../services/tracking-service/left-side-panel-tracking.js";
import { getDefaultProfile } from "../../services/global-profile-service/profile-data-service.js";
import {
  UsageKey,
  isNewDay,
  usageWatcher,
} from "../../services/tracking-service/UsageWatcher.js";
import { popupPromoteSignup } from "../../../../../content-marketing/panel/popup-promote-signup.js";
import { userService } from "../../services/user-services/UserService.js";
// import { checkLoginOrSignupUserForPlayTestSuite } from "../../../../../content-marketing/panel/popup-play-suite-quota.js";

function generateRemoveTestCaseContextItem() {
  const remove_case = document.createElement("li");
  remove_case.setAttribute("style", "border-top: 1px solid #E8EBED;");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.setAttribute("style", "color: #B41400;");
  a.textContent = "Delete test case";
  remove_case.appendChild(a);
  remove_case.addEventListener(
    "click",
    function (event) {
      event.stopPropagation();
      document.getElementById("delete-testCase").click();
    },
    false
  );
  return remove_case;
}

function generateRenameTestCaseContextItem() {
  const rename_case = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Rename test case";
  rename_case.appendChild(a);
  rename_case.addEventListener(
    "click",
    function (event) {
      event.stopPropagation();
      let s_case = getSelectedCase();
      const testCaseID = s_case.id;
      const testCase = findTestCaseById(testCaseID);
      let n_title = prompt("Please enter the Test Case's name", testCase.name);
      if (n_title) {
        // get text node
        s_case.childNodes[0].textContent = n_title;
        const testCaseID = s_case.id;
        const testCase = findTestCaseById(testCaseID);
        testCase.name = n_title;
      }
    },
    false
  );
  return rename_case;
}

function generatePlayCaseFromHereContextItem() {
  const play_case_from_here = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Play from here";
  play_case_from_here.appendChild(a);
  play_case_from_here.addEventListener(
    "click",
    async function () {
      /*** Comment out for KR-520 ***/
      // const result = await checkLoginOrSignupUserForPlayTestSuite();
      // if (!result){
      //     return;
      // }
      /*** Comment out for KR-520 ***/

      saveData();
      emptyNode(document.getElementById("logcontainer"));
      document.getElementById("result-runs").textContent = "0";
      document.getElementById("result-failures").textContent = "0";
      recorder.detach();
      initAllSuite();
      //focus on window when playing test suite
      if (contentWindowId) {
        browser.windows.update(contentWindowId, { focused: true });
      }
      declaredVars = {};
      window.defaultProfile = await getDefaultProfile();
      for (const variable of defaultProfile.variables) {
        declaredVars[`GlobalVariable.${variable.name}`] = variable.value;
      }
      clearScreenshotContainer();

      let cases = getSelectedSuite().getElementsByTagName("p");
      let i = 0;
      while (i < cases.length) {
        let s_case = getSelectedCase();
        if (cases[i].id === s_case.id) {
          break;
        }
        i++;
      }
      playTestSuiteAction(i, false);
    },
    false
  );
  return play_case_from_here;
}

function generateSaveCaseContextItem() {
  const save_case = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Save test case";
  save_case.appendChild(a);
  save_case.addEventListener(
    "click",
    async function (event) {
      event.stopPropagation();
      saveData();
      removeDirtyMarks("context");
      setTrackingLeftSidePanelData("saveTestCase");

      const user = await userService.getLoginInfo();
      if (!user.hasLoggedIn) {
        await usageWatcher.countSavingTestCase();
        const promoteSignUpUsage = await usageWatcher.loadUsageRecord(
          UsageKey.PROMOTE_SIGN_UP
        );
        if (isNewDay(promoteSignUpUsage.lastTime)) {
          popupPromoteSignup("save-first-test-case");
        }
      }
    },
    false
  );
  return save_case;
}

function generateDuplicateTestCaseItem() {
  const duplicate_test_case = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Duplicate test case";
  duplicate_test_case.appendChild(a);
  duplicate_test_case.addEventListener(
    "click",
    async function (event) {
      const s_case = getSelectedCase();
      const s_suite = getSelectedSuite();
      const testSuite = findTestSuiteById(s_suite.id);
      const oldTestCase = findTestCaseById(s_case.id);
      if (testSuite && oldTestCase) {
        const newTitle = oldTestCase.name + " copy";
        //find corrected index to insert test case
        let index = testSuite.getTestCaseCount();
        index = testSuite.findTestCaseIndexByID(oldTestCase.id) + 1;
        //insert new test case
        const newTestCase = new TestCase().setTestCase({
          name: newTitle,
          commands: [],
          tags: oldTestCase.tags ? oldTestCase.tags : [],
        });

        for (const command of oldTestCase.commands) {
          newTestCase.commands.push(new TestCommand().setTestCommand(command));
        }

        testSuite.insertNewTestCase(index, newTestCase);
        //render UI
        renderNewTestCase(newTestCase.name, newTestCase.id, newTestCase.tags);
        const selectedTesSuite = getSelectedSuite();
        testSuiteDropdownOpen(selectedTesSuite.id);
      }
    },
    false
  );
  return duplicate_test_case;
}

const generateTestCaseContextMenu = (id) => {
  const menu = document.createElement("div");
  menu.setAttribute("class", "menu");
  menu.setAttribute("id", "menu" + id);
  const ul = document.createElement("ul");
  const play_case_from_here = generatePlayCaseFromHereContextItem();
  const rename_case = generateRenameTestCaseContextItem();
  const save_case = generateSaveCaseContextItem();
  const remove_case = generateRemoveTestCaseContextItem();
  const duplicated_case = generateDuplicateTestCaseItem();

  ul.appendChild(play_case_from_here);
  ul.appendChild(rename_case);
  ul.appendChild(save_case);
  ul.appendChild(duplicated_case);
  ul.appendChild(remove_case);

  menu.appendChild(ul);
  return menu;
};

export { generateTestCaseContextMenu };
