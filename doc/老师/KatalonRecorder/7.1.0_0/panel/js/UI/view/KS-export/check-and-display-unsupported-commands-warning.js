import {checkUnsupportedCommands} from "../../services/KS-export-service/check-unsupported-commands.js";
import {findTestCaseById} from "../../services/data-service/test-case-service.js";

const checkAndDisplayUnsupportedCommandsWarning = async (userChoice) => {
  const numOfUnsupportedTestCases = await userChoice.getNumUnsupportedTestCase();
  const message = `${numOfUnsupportedTestCases} selected Test Case contain incompatible commands`
  if (numOfUnsupportedTestCases > 0) {
    $("#export-to-KS-warning").css("display", "flex").find("span").html(message);
  } else {
    $("#export-to-KS-warning").css("display", "none");
  }
}

const checkAndDisplayWarningIconForTestCase = async (userChoice) => {
  const selectedTestCaseElementIds = [...$("#export-to-KS-test-suite-list input")]
      .map(element => element.parentElement.id)
      .filter(id => id.includes("export-to-KS-case"));
  for (const elementId of selectedTestCaseElementIds) {
    //element id has format "export-to-KS-case-<id>"
    const testCaseId = elementId.substring(18);
    const hasUnsupportedCommand = await checkUnsupportedCommands(findTestCaseById(testCaseId));
    const userChoiceTestCase = await userChoice.getTestCaseById(testCaseId);
    if (userChoiceTestCase !== null){
      userChoiceTestCase.hasUnsupportedCommand = hasUnsupportedCommand;
    }
    $(`#${elementId}`).find(".warning").remove();
    if (hasUnsupportedCommand && $(`#${elementId}`).find(".warning").length === 0){
      const img = document.createElement('img');
      img.src = "/katalon/images/SVG/export-warning-icon.svg";
      img.classList.add("warning");
      $(`#${elementId}`).append(img);
    }
  }
}
export { checkAndDisplayUnsupportedCommandsWarning, checkAndDisplayWarningIconForTestCase }