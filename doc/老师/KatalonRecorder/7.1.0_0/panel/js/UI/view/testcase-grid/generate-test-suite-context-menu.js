import { getSelectedSuite } from "./selected-suite.js";
import {
  findTestSuiteById, findTestSuiteIndexByID,
  getTestSuiteCount, insertNewTestSuiteAtIndex
} from "../../services/data-service/test-suite-service.js";
import { closeConfirm } from "./close-confirm.js";
import { createTestCase } from "../../services/data-service/test-case-service.js";
import { TestCommand } from "../../models/test-model/test-command.js";
import { renderNewTestSuite } from "./render-new-test-suite.js";
import { renderNewTestCase } from "./render-new-test-case.js";
import { saveData } from "../../services/data-service/save-data.js";
import { downloadSuite } from "../../services/html-service/download-suite.js";
import { TestSuite } from "../../models/test-model/test-suite.js";
import { TestCase } from "../../models/test-model/test-case.js";


function generateDownloadTestSuiteContextItem(){
  const download_suite = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Download test suite";
  download_suite.appendChild(a);
  download_suite.addEventListener("click", function (event) {
    event.stopPropagation();
    const selectedTestSuite = getSelectedSuite();
    downloadSuite(selectedTestSuite);
  }, false);
  return download_suite;
}

function generateSaveTestSuiteContextItem() {
  const save_suite = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Save test suite";
  save_suite.appendChild(a);
  save_suite.addEventListener("click", function (event) {
    event.stopPropagation();
    saveData();
    const selectedTestSuite = getSelectedSuite();
    [...selectedTestSuite.getElementsByTagName("p")].forEach(testCase => {
      $(testCase).removeClass("modified");

    });
    selectedTestSuite.getElementsByClassName("modified")[0]?.classList.remove("modified");
  }, false);
  return save_suite;
}

function generateRemoveSuiteContextItem() {
  const remove_suite = document.createElement("li");
  remove_suite.setAttribute("style", "border-top: 1px solid #E8EBED;");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.setAttribute("style", "color: #B41400;");
  a.textContent = "Delete test suite";
  remove_suite.appendChild(a);
  remove_suite.addEventListener("click", function (event) {
    event.stopPropagation();
    document.getElementById("close-testSuite").click();
  }, false);
  return remove_suite;
}

function generateCloseAllSuiteContextItem() {
  const close_all_suite = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.setAttribute("style", "color: #B41400;");
  a.textContent = "Delete all test suites";
  close_all_suite.appendChild(a);
  close_all_suite.addEventListener("click", function (event) {
    event.stopPropagation();
    document.getElementById("close-all-testSuites").click();
  }, false);
  return close_all_suite;
}

function generateDuplicateTestSuiteContextItem() {
  const duplicate_test_suite = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Duplicate test suite";
  duplicate_test_suite.appendChild(a);
  duplicate_test_suite.addEventListener("click", async function () {
    const s_suite = getSelectedSuite();
    const oldTestSuite = findTestSuiteById(s_suite.id);
    if (oldTestSuite) {
      const newTitle = oldTestSuite.name + " copy";
      //find corrected index to insert test case
      let index = getTestSuiteCount();
      if (s_suite) {
          index = findTestSuiteIndexByID(s_suite.id) + 1;
      }
      //insert new test suite
      const newTestSuite = new TestSuite().setTestSuite({
        name : newTitle,
        status : oldTestSuite.status,
        query : oldTestSuite.query,
      });

      newTestSuite.testCases = [];

      insertNewTestSuiteAtIndex(index, newTestSuite);
      renderNewTestSuite(newTitle, newTestSuite.id, newTestSuite.status); 

      if (oldTestSuite.status === 'dynamic') {
        newTestSuite.testCases = [];
      }else{
        for (const oldTestCase of oldTestSuite.testCases) {
          const newTestCase = new TestCase().setTestCase({
            name: oldTestCase.name,
            commands: oldTestCase.commands,
            tags: oldTestCase.tags? oldTestCase.tags:[]
          });
          newTestSuite.testCases.push(newTestCase);
          renderNewTestCase(newTestCase.name,newTestCase.id,newTestCase.tags);
        }
      }
    }
  }, false);
  return duplicate_test_suite;
}

function generateRenameTestSuiteContextItem() {
  const rename_suite = document.createElement("li");
  const a = document.createElement("a");
  a.setAttribute("href", "#");
  a.textContent = "Rename test suite";
  rename_suite.appendChild(a);
  rename_suite.addEventListener("click", function (event) {
    event.stopPropagation();
    let s_suite = getSelectedSuite();
    const testSuiteID = s_suite.id;
    let n_title = prompt("Please enter the Test Suite's name", testSuiteID.name);
    if (n_title) {
      // get text node
      s_suite.getElementsByTagName("STRONG")[0].textContent = n_title;
      $(s_suite).find("strong").addClass("modified");
      closeConfirm(true);

      const testSuiteID = s_suite.id;
      const testSuite = findTestSuiteById(testSuiteID);
      testSuite.name = n_title;
    }
  }, false);
  return rename_suite;
}


const generateTestSuiteContextMenu = (id) => {
  const menu = document.createElement("div");
  menu.setAttribute("class", "menu");
  menu.setAttribute("id", "menu" + id);
  const ul = document.createElement("ul");
  const download_suite = generateDownloadTestSuiteContextItem();
  const rename_suite = generateRenameTestSuiteContextItem();
  const save_suite = generateSaveTestSuiteContextItem();
  const remove_suite = generateRemoveSuiteContextItem();
  const close_all_suite = generateCloseAllSuiteContextItem();
  const duplicate_test_suite = generateDuplicateTestSuiteContextItem();

  ul.appendChild(download_suite);
  ul.appendChild(rename_suite);
  ul.appendChild(save_suite);
  ul.appendChild(duplicate_test_suite);
  ul.appendChild(remove_suite);
  ul.appendChild(close_all_suite);

  menu.appendChild(ul);
  return menu;
}

export { generateTestSuiteContextMenu }