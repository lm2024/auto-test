import { GenericDialog } from "../dialog/generic-dialog.js";
import {
  loadParserScripts,
  unloadParserScripts
} from "../../services/KS-export-service/katalon-studio-script-service.js";
import { generateKatalonStudioProjectZipFile } from "../../services/KS-export-service/generate-katalon-studio-project-zip-file.js";
import { renderDataFileTree } from "./render-data-file-tree.js";
import { renderTestSuiteTree } from "./render-test-suite-tree.js";
/*
import { renderProfileTree } from "./render-profile-tree.js";
*/
import { displayProgressBar } from "./display-progress-bar.js";
import { UserChoice } from "../../models/KR-export/user-choice.js";
import { trackingExportTestCase, trackingSegment } from "../../services/tracking-service/segment-tracking-service.js";
import { getTestSuiteContainer } from "./generate-test-case-container-element.js";
import {
  checkAndDisplayUnsupportedCommandsWarning,
  checkAndDisplayWarningIconForTestCase
} from "./check-and-display-unsupported-commands-warning.js";
import { generateJavaJunitProjectZipFile } from "../../services/KS-export-service/generate-java-junit-project-zip-file.js";
import { generateJavaTestNGProjectZipFile } from "../../services/KS-export-service/generate-java-testng-project-zip-file.js";
import { generatePythonUnittestProjectZipFile } from "../../services/KS-export-service/generate-python-unitest-project-zip-file.js";
import { generateDefaultProjectZipFile } from "../../services/KS-export-service/generate-default-project-zip-file.js";

class KSExportDialog extends GenericDialog {
  constructor() {
    const htmlString = `<div class="header">
        <div id="export-to-KS-header" class="title">Export to Katalon Studio</div>
         <button class="dialog-close" id="export-KS-close">
              <img src="/katalon/images/SVG/close-icon.svg"/>
          </button>
    </div>
    <div class="content">
        <div style="font-size: 12px;font-weight: 500;margin-bottom: 8px;">
            <span style="color: red">*</span> Select a framework
        </div>
        <div>
            <select style="width: 300px;margin-bottom: 16px; margin-right: 5px;border-radius: 5px;" id="export-to-KS-select-script-language" class="select-script-language">
              <option value="katalon" selected>Katalon Studio</option>
              <option value="java-wd-testng">Java (WebDriver + TestNG)</option>
              <option value="java-wd-junit">Java (WebDriver + JUnit)</option>
              <option value="java-rc-junit">Java (WebDriver-backed Remote Control + JUnit)</option>
              <option value="python2-wd-unittest">Python 2 (WebDriver + unittest)</option>
              <option value="cs-wd-mstest">C# (WebDriver + MSTest)</option>
              <option value="cs-wd-nunit">C# (WebDriver + NUnit)</option>
              <option value="python-appdynamics">Python (AppDynamics)</option>
              <option value="robot">Robot Framework</option>
              <option value="ruby-wd-rspec">Ruby (WebDriver + RSpec)</option>
              <option value="xml">XML</option>
              <option value="new-formatter-dynatrace">JSON (Dynatrace Synthetics)</option>
              <option value="new-formatter-nrsynthetics">Node (New Relic Synthetics)</option>
              <option value="new-formatter-protractorts">Protractor (Typescript)</option>
              <option value="new-formatter-webdriver">WebDriver.io</option>
              <option value="new-formatter-sample">Sample for new formatters</option>
              <option value="new-formatter-puppeteer">Puppeteer</option>
              <option value="new-formatter-puppeteer_w_comment">Puppeteer w Comments</option>
              <option value="new-formatter-puppeteer_json">JSON (puppeteer)</option>
           </select> 
           <input id="export-to-KS-driver-path" type="text" placeholder="Input the path to WebDriver" style="margin-right: 5px;" disabled/>
           <button id="export-to-KS-apply-driver-path" class="disable">Apply</button>
        </div>
       
        <div id="export-to-KS-message">The following test artifacts will be exported as a functional project for the selected language and framework.</div>

        <div id="export-to-KS-warning">
            <img src="/katalon/images/SVG/export-warning-icon.svg" />
            <span>Some selected test cases contain unsupported commands</span>
        </div>
        <div id="export-to-KS-main-panel">
            <div id="export-to-KS-tree" >
                <div id="export-to-KS-test-suites">
                    <div class="header">
                        <div id="export-to-KS-test-suites-dropdown" class="dropdown">
                            <img src="/katalon/images/SVG/dropdown-arrow-off.svg">
                        </div>
                         <span>Test suites</span>
                    </div>
                    <div id="export-to-KS-test-suite-list"></div>
                </div>
                <div id="export-to-KS-data">
                    <div class="header">
                        <div id="export-to-KS-data-dropdown" class="dropdown">
                            <img src="/katalon/images/SVG/dropdown-arrow-off.svg">
                        </div>
                        <span>Data files</span>
                    </div>
                    <div id="export-to-KS-data-list"></div>
                </div>
            </div>
            <div id="export-to-KS-preview-panel">
                <div id="export-to-KS-test-case-preview-other">Preview for this artifact is not available</div>
                <div id="export-to-KS-test-case-preview-panel">
                    <div class="tab-panel">
                        <div class="tab" id="export-to-KS-preview-KR-tab">Katalon Recorder</div>
                        <div class="tab selected" id="export-to-KS-preview-KS-tab">Katalon Studio</div>
                    </div>
                    <div id="export-to-KS-KR-preview">
                        <table id="export-to-KS-command-grid" class="tablesorter" cellspacing="0">
                          <thead class="fixed">
                          <tr>
                            <th style="width: 23%">Command</th>
                            <th style="width: 52%">Target</th>
                            <th style="width: 25%">Value</th>
                          </tr>
                          </thead>
                          <tbody id="export-to-KS-records-grid">
                              
                          </tbody>
                        </table>
                    </div>
                    <div id="export-to-KS-KS-preview">
                        <textarea id="export-to-KS-script" class="txt-script">scripts</textarea>    
                    </div>
                </div>
                
            </div>
        </div>
    </div>
    <div class="footer">
        <div id="export-progress">
            <progress id="export-progress-bar" value="32" max="100"></progress> 
            <span id="export-progress-bar-label">32%</span>
            <div id="export-progress-bar-message">5 test artifact are being export</div>
        </div>
        <button id="export-to-KS-cancel">Cancel</button>
        <button id="export-to-KS-export" class="disable">Export</button>
    </div>`;
    super({
      id: "export-to-KS-dialog",
      html: htmlString,
      height: $(window).height(),
      width: $(window).width(),
      draggable: false,
    });
    this.userChoice = new UserChoice();
  }

  async render() {
    await loadParserScripts("katalon");
    await super.render();
    await this.attachEvent();
    await Promise.all([renderDataFileTree(this.userChoice),
    renderTestSuiteTree(this.userChoice),
      /*renderProfileTree(this.userChoice)*/]);
    await checkAndDisplayWarningIconForTestCase(this.userChoice);
  }

  async attachEvent() {
    const self = this;

    $("#export-to-KS-preview-KR-tab").click(async function (event) {
      $("#export-to-KS-preview-KR-tab").addClass("selected");
      $("#export-to-KS-preview-KS-tab").removeClass("selected");
      $("#export-to-KS-KS-preview").css("display", "none");
      $("#export-to-KS-KR-preview").css("display", "block");

    });

    $("#export-to-KS-preview-KS-tab").click(async function (event) {
      $("#export-to-KS-preview-KR-tab").removeClass("selected");
      $("#export-to-KS-preview-KS-tab").addClass("selected");
      $("#export-to-KS-KS-preview").css("display", "block");
      $("#export-to-KS-KR-preview").css("display", "none");
      $("#export-to-KS-KS-preview").find(".CodeMirror-sizer")[0].scrollIntoView({ block: "end" })
      const $textarea = $("#export-to-KS-script");
      const codeMirror = $textarea.data('cm');
      if (codeMirror) {
        codeMirror.refresh();
      }
    });

    $("#export-to-KS-cancel").click(async function () {
      await self.close();
    });

    $("#export-to-KS-export").click(async function () {
      if ($(this).hasClass("disable")) {
        return;
      }
      const languageId = $("#export-to-KS-select-script-language").val();
      let zipFile;
      let projectTitle;
      let blob;
      switch (languageId) {
        case "katalon":
          projectTitle = "KR Exported Studio Project";
          zipFile = await generateKatalonStudioProjectZipFile(self.userChoice, projectTitle);
          trackingSegment("kru_export_to_ks", {
            num_test_suites: self.userChoice.testSuites.length,
            num_test_cases: await self.userChoice.getTestCaseCount(),
            num_data_files: self.userChoice.dataFiles.length,
            num_profiles: self.userChoice.profiles.length
          });
          break;
        case "java-wd-junit":
          projectTitle = "KR-exported-java-junit-maven-project";
          zipFile = await generateJavaJunitProjectZipFile(self.userChoice, projectTitle);
          break;
        case "java-wd-testng":
          projectTitle = "KR-exported-java-testNG-maven-project";
          zipFile = await generateJavaTestNGProjectZipFile(self.userChoice, projectTitle);
          break;
        case "python2-wd-unittest":
          projectTitle = "KR-exported-python-unitest-project";
          zipFile = await generatePythonUnittestProjectZipFile(self.userChoice, projectTitle);
          break;
        default:
          projectTitle = "KR-exported"
          zipFile = await generateDefaultProjectZipFile(self.userChoice, projectTitle);
      }
      blob = await zipFile.generateAsync({ type: "blob" });
      await displayProgressBar(self.userChoice);
      saveAs(blob, `${projectTitle}.zip`);
      trackingExportTestCase(languageId);

    });

    $("#export-to-KS-profiles-dropdown").click(function (event) {
      const image = $(this).find("img");
      const src = $(image).attr("src");
      if (src.includes("off")) {
        $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
        $("#export-to-KS-profiles-list").css("display", "block");
      } else {
        $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
        $("#export-to-KS-profiles-list").css("display", "none");
      }
    });

    $("#export-to-KS-test-suites-dropdown").click(function (event) {
      const image = $(this).find("img");
      const src = $(image).attr("src");
      if (src.includes("off")) {
        $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
        $("#export-to-KS-test-suite-list").css("display", "block");
      } else {
        $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
        $("#export-to-KS-test-suite-list").css("display", "none");
      }
    });

    $("#export-to-KS-data-dropdown").click(function (event) {
      const image = $(this).find("img");
      const src = $(image).attr("src");
      if (src.includes("off")) {
        $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
        $("#export-to-KS-data-list").css("display", "block");
      } else {
        $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
        $("#export-to-KS-data-list").css("display", "none");
      }
    });

    $("#export-to-KS-select-script-language").change(async function (event) {
      await unloadParserScripts();
      const languageId = $("#export-to-KS-select-script-language").val();
      await loadParserScripts(languageId);
      //set title for popup
      const language = $("#export-to-KS-select-script-language option:selected").text();
      $("#export-to-KS-header").html(`Export to ${language}`);
      $("#export-to-KS-preview-KS-tab").html(`${language}`);

      //automatically expand the explorer
      if ($("#export-to-KS-test-suites-dropdown img")[0].src.includes("dropdown-arrow-off")) {
        $("#export-to-KS-test-suites-dropdown").click();
      }
      const selectedTestCase = $("#export-to-KS-test-suite-list .selected")[0];
      if (selectedTestCase) {
        const testSuiteContainer = await getTestSuiteContainer(selectedTestCase);
        const dropdownImage = $(testSuiteContainer).find(".dropdown img")[0];
        if (dropdownImage.src.includes("dropdown-arrow-off")) {
          $(testSuiteContainer).find(".dropdown").click();
        }
        $(selectedTestCase).click();
      } else {
        //display the content of the first test case
        const firstTestSuite = $("#export-to-KS-test-suite-list").children().first();
        $(firstTestSuite).find(".export-to-KS-test-suite-header .dropdown").click();
        $(firstTestSuite).find(".export-to-KS-test-cases-container").children().first().click()
      }
      //check for unsupported command
      await checkAndDisplayWarningIconForTestCase(self.userChoice);
      await checkAndDisplayUnsupportedCommandsWarning(self.userChoice);
      //enable driver path
      if (window.options.driverPath !== undefined) {
        $("#export-to-KS-driver-path").prop("disabled", false);
        $("#export-to-KS-apply-driver-path").removeClass("disable").click();
      } else {
        $("#export-to-KS-driver-path").prop("disabled", true);
        $("#export-to-KS-apply-driver-path").addClass("disable");
      }
    });
    $("#export-to-KS-apply-driver-path").click(function (event) {
      if ($(this).hasClass("disable")) return;
      window.options.driverPath = $("#export-to-KS-driver-path").val();
      $("#export-to-KS-test-suite-list .selected").click();
    })
  }

  async close() {
    await super.close();
    await unloadParserScripts();
  }

}

export { KSExportDialog }