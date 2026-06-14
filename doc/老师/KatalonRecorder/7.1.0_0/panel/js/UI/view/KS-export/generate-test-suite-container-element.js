import { checkAndDisplayUnsupportedCommandsWarning } from "./check-and-display-unsupported-commands-warning.js";
import { generateTestCasesContainerElement } from "./generate-test-case-container-element.js";
import { updateExportButtonStatus } from "./export-button.js";


async function userChooseTestSuiteHandler(event, userChoice){
  event.stopPropagation();
  const testSuiteID = event.target.parentElement.parentElement.id.substring(19);
  if (event.target.checked === true) {
    const testSuiteContainer = event.target.parentElement.parentElement;
    [...$(testSuiteContainer).find("input")].forEach(element => {
      if ($(element).prop("checked") === false) {
        $(element).click();
      }
    });

    await userChoice.addNewTestSuite(testSuiteID);
  } else {
    const testSuiteContainer = event.target.parentElement.parentElement;
    $(testSuiteContainer).find("input").prop("checked", false);


    await userChoice.removeTestSuite(testSuiteID);
  }
  await checkAndDisplayUnsupportedCommandsWarning(userChoice);
  await updateExportButtonStatus()
}

/*
<div id="export-to-KS-suite-ID1">
    <div class="export-to-KS-test-suite-header">
        <input type="checkbox">
        <div>Basic automation</div>
    </div>

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
</div>
 */
const generateTestSuiteContainerElement = async (testSuite, userChoice) => {
  const container = document.createElement("div");
  container.id = `export-to-KS-suite-${testSuite.id}`;


  const header = document.createElement("div");
  header.classList.add("export-to-KS-test-suite-header");
  header.classList.add("export-item");
  container.appendChild(header);

  /*
    <div id="export-to-KS-data-dropdown" class="dropdown">
                            <img src="/katalon/images/SVG/dropdown-arrow-off.svg">
                        </div>
  */
  const dropdown = document.createElement("div");
  dropdown.classList.add("dropdown");
  header.appendChild(dropdown);
  const img = document.createElement("img");
  img.src = "/katalon/images/SVG/dropdown-arrow-off.svg";
  dropdown.appendChild(img);


  const input = document.createElement("input");
  input.setAttribute("type", "checkbox");
  input.addEventListener("click", function(event){userChooseTestSuiteHandler(event, userChoice)});
  header.appendChild(input);

  const title = document.createElement("div");
  title.innerHTML = testSuite.name;
  header.appendChild(title);

  const testCaseContainer = await generateTestCasesContainerElement(testSuite, userChoice);
  container.appendChild(testCaseContainer);


  dropdown.addEventListener("click", function(event){
    const image = $(this).find("img");
    const src = $(image).attr("src");
    if (src.includes("off")) {
      $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
      $(testCaseContainer).css("display", "block");
    } else {
      $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
      $(testCaseContainer).css("display", "none");
    }
  })

  return container;
}

export { generateTestSuiteContainerElement }