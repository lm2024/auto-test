import { getAllTestSuites } from "../../services/data-service/test-suite-service.js";
import { generateTestSuiteContainerElement } from "./generate-test-suite-container-element.js";

const renderTestSuiteTree = async (userChoice) => {
  const testSuiteTreeContainer = document.getElementById("export-to-KS-test-suite-list");
  const testSuites = getAllTestSuites();
  for (const testSuite of testSuites) {
    const testSuiteContainer = await generateTestSuiteContainerElement(testSuite, userChoice);
    testSuiteTreeContainer.appendChild(testSuiteContainer);
  }
  //automatically expand the explorer and display the content of the first test case
  $("#export-to-KS-test-suites-dropdown").click();
  const firstTestSuite = $("#export-to-KS-test-suite-list").children().first();
  $(firstTestSuite).find(".export-to-KS-test-suite-header .dropdown").click();
  $(firstTestSuite).find(".export-to-KS-test-cases-container").children().first().click()

}

export { renderTestSuiteTree }