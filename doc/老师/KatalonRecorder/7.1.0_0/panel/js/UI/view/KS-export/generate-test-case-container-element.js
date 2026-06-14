import { checkUnsupportedCommands } from "../../services/KS-export-service/check-unsupported-commands.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { checkAndDisplayUnsupportedCommandsWarning } from "./check-and-display-unsupported-commands-warning.js";
import { generateExportedScript } from "../../services/KS-export-service/generate-exported-script.js";
import { renderKSScript } from "./render-KS-script.js";
import { renderKRGrid } from "./render-KR-grid.js";
import { updateExportButtonStatus } from "./export-button.js";

async function getTestCaseContainer(element){
  const testCaseRegex = /export-to-KS-case-/;
  while (!testCaseRegex.test(element.id)){
    element = element.parentElement;
  }
  return element;
}

const getTestSuiteContainer = async (element) => {
  const testCaseRegex = /export-to-KS-suite-/;
  while (!testCaseRegex.test(element.id)){
    element = element.parentElement;
  }
  return element;
}

async function userChooseTestCaseHandler(event, userChoice){
  event.stopPropagation();
  const testCaseContainer = await getTestCaseContainer(event.target);
  const testSuiteContainer = await getTestSuiteContainer(event.target);

  //test case element's ID has format export-to-KS-case-{UUID}
  const testCaseID = testCaseContainer.id.substring(18);
  //test suite element's ID has format export-to-KS-suite-{UUID}
  const testSuiteID = testSuiteContainer.id.substring(19);

  if (event.target.checked) {
    const hasUnsupportedCommand = await checkUnsupportedCommands(findTestCaseById(testCaseID));
    const userChoiceTestCase = await userChoice.addNewTestCase(testSuiteID, testCaseID);
    userChoiceTestCase.hasUnsupportedCommand = hasUnsupportedCommand;
    //tick on test suite contain test case
    $(testSuiteContainer).find(".export-to-KS-test-suite-header input").prop("checked", true);
    //if test case needs a data file, automatically click on the data file
    const UIDataFileList = [...$("#export-to-KS-data div div")];
    const KRTestCase = findTestCaseById(testCaseID);
    for (const command of KRTestCase.commands){
      if (command.name === "loadVars"){
        const dataFileName = command.defaultTarget;
        UIDataFileList
          .filter(element => element.innerHTML === dataFileName)
          .map(element => element.previousSibling)
          .forEach(element => {
            if ($(element).prop("checked") === false) {
              $(element).click();
            }
          });
      }
    }

  } else {
    await userChoice.removeTestCase(testCaseID);
    const userChoiceTestSuite = await userChoice.findTestSuiteById(testSuiteID);
    if (userChoiceTestSuite === undefined){
      $(testSuiteContainer).find(".export-to-KS-test-suite-header input").prop("checked", false);
    }
  }
  await checkAndDisplayUnsupportedCommandsWarning(userChoice);
  await updateExportButtonStatus()
}

async function testCaseTitleClickHandler(event){
  event.stopPropagation();
  $("#export-to-KS-test-case-preview-panel").css("display", "flex");
  $("#export-to-KS-test-case-preview-other").css("display", "none");
  const testCaseContainer = await getTestCaseContainer(event.target);
  $("#export-to-KS-test-suite-list .selected").removeClass("selected");
  testCaseContainer.classList.add("selected");
  const testCaseID = testCaseContainer.id.substring(18);
  const testCase = findTestCaseById(testCaseID);
  const outputScript = await generateExportedScript(testCase);

  await renderKSScript(outputScript);
  await renderKRGrid(testCase);
  $("#export-to-KS-KS-preview").find(".CodeMirror-sizer")[0].scrollIntoView({block: "end"})
}

/*
<div id="export-to-KS-case-ID2">
    <input type="checkbox">
    <div>Basic automation</div>
</div>
 */
async function generateTestCaseContainerElement(testCase, userChoice){
  const container = document.createElement("div");
  container.id = `export-to-KS-case-${testCase.id}`;
  container.classList.add("export-item")
  container.addEventListener("click", testCaseTitleClickHandler);

  const input = document.createElement("input");
  input.setAttribute("type", "checkbox");
  input.addEventListener("click", function(event){userChooseTestCaseHandler(event, userChoice)});
  container.appendChild(input);

  const title = document.createElement("div");
  title.innerHTML = testCase.name;
  container.appendChild(title);

  return container;
}

/*
<div class="export-to-KS-test-cases-container">
    <div id="export-to-KS-case-ID1">
        <input type="checkbox">
        <div>Basic automation</div>
    </div>
    <div id="export-to-KS-case-ID2">
        <input type="checkbox">
        <div>Basic automation</div>
    </div>
</div>
 */
const generateTestCasesContainerElement = async (testSuite, userChoice) => {
  const testCasesContainer = document.createElement("div");
  testCasesContainer.classList.add("export-to-KS-test-cases-container");

  for (const testCase of testSuite.testCases) {
    const testCaseContainer = await generateTestCaseContainerElement(testCase, userChoice);
    testCasesContainer.appendChild(testCaseContainer);
  }

  return testCasesContainer;
}

export { generateTestCasesContainerElement, getTestSuiteContainer }