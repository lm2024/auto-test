import { sampleData } from "../../services/sample-project-service/sample-data.js";
import {
  addSampleData,
  sampleDataTrackingService
} from "../../services/sample-project-service/sample-project-service.js"
import { testSuitContainerOpen } from "../../view/testcase-grid/test-suite-container.js";
import { renderNewTestSuite, testSuiteDropdownOpen } from "../../view/testcase-grid/render-new-test-suite.js";
import { renderNewTestCase } from "../../view/testcase-grid/render-new-test-case.js";

import {GenericDialog} from "../../view/dialog/generic-dialog.js";

function generateDialogHTML() {
  return sampleData.reduce((html, data, index) => {
    return html + `<div id="sample-${index}" style="text-align: center">
                        <h3>${data.projectName}</h3>
                        <p>${data.description}</p>
                    </div>`
  }, "");
}
$(document).ready(function () {

  $("#sample-project").click(function(){
    $("#helpDialog").dialog("close");
    $("#template-open").click();
  })

  $("#template-open").click(async function () {
    const html = `
  <div>Get started with sample projects. You can add them later through the Actions section. </div>
  <div id="old-sample-project-content">
  ${generateDialogHTML()}
</div>
    `;
    const dialog = new GenericDialog({
      id: "old-sample-project",
      title: "Add sample project",
      message: html,
      buttons: [
        {
          id: "old-sample-project-add",
          text: "Add"
        }
      ],
      width: 700,
      height: 450,

    });
    await dialog.render();
    $("#old-sample-project-content div").click(function () {
      if ($(this).hasClass("selected")) {
        $(this).removeClass("selected");
      } else {
        $(this).addClass("selected");
      }
      if ($("#old-sample-project-content .selected").length > 0){
        $("#old-sample-project-add").removeClass("disable");
      } else {
        $("#old-sample-project-add").addClass("disable");
      }
    });


    $("#old-sample-project-add").addClass("disable").click(function(){
      if ($(this).hasClass("disable")) {
        return;
      }
      testSuitContainerOpen();
      const selectedIDs = [...$("#old-sample-project-content .selected")]
          .map(element => parseInt(element.id.substring(7)));
      const sampleTestSuites = addSampleData(sampleData, selectedIDs);
      for (const testSuite of sampleTestSuites){
        renderNewTestSuite(testSuite.name, testSuite.id);
        for (const testCase of testSuite.testCases){
          renderNewTestCase(testCase.name, testCase.id);
        }
      }
      testSuiteDropdownOpen(sampleTestSuites[sampleTestSuites.length-1].id);
      $(`#${sampleTestSuites[sampleTestSuites.length-1].testCases[0].id}`).click()
      sampleDataTrackingService(sampleData, selectedIDs);

      dialog.close();
    })
  })
})