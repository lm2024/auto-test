import {GenericDialog} from "../../view/dialog/generic-dialog.js";

function testDataInfoEvent(){
  const html = `
    <div class="container">
      <div class="body">
        <div class="title">How to use Test Data?</div>
        <div class="content">
          <ul>
            <li>Add a data file to your workspace.</li>
            <li>Right click on a data file, choose <b>Use this in a test case</b>.</li>
          </ul>
        </div>
        <div class="support">
          <div class="title">
            <img src="/katalon/images/SVG/file-check-icon.svg"/>
            <div>
              Supported formats:
            </div> 
          </div>
          <div class="support-tab-container">
            <div>CSV</div>
            <div>JSON</div>
          </div>
        </div>
      </div>
      <div class="footer">
        <a href="https://docs.katalon.com/katalon-recorder/docs/data-driven-execution.html#perform-data-driven-testing" target="_blank">More details</a>
      </div>
    </div>
  `
  const dialog = new GenericDialog({
    modal: false,
    html: html,
    id: "test-data-info-dialog",
    height: 208,
    width: 300,
    draggable: false,
    appendTo: "#test-data-info",
  });
  $("#test-data-info").mouseover(async function(event){
    if (dialog.isOpen){
      return;
    }
    await dialog.render();
    const iconPosition = $("#test-data-info").position();
    dialog.dialog.parent().css("left", iconPosition.left + 36).css("top", iconPosition.top - 12);
  }).mouseleave(async function (){
    if (dialog.isOpen){
      await dialog.close();
    }
  })

}

function testSuitsInfoEvent(){
  const html = `
    <div class="container">
      <div class="body">
        <div class="title">What is a test suite?</div>
        <div class="content">
        <p>
          A test suite lets you group similar test cases together.
        </p>
        </div>
      </div>
    </div>
  `
  const dialog = new GenericDialog({
    modal: false,
    html: html,
    id: "test-suites-info-dialog",
    height: 100,
    width: 300,
    draggable: false,
    appendTo: "#test-suites-info"
  });

  $("#test-suites-info").mouseover(async function(event){
    if (dialog.isOpen){
      return;
    }
    await dialog.render();
    const iconPosition = $("#test-suites-info").position();
    dialog.dialog.parent().css("left", iconPosition.left + 36).css("top", iconPosition.top - 8);
  }).mouseleave(async function (){
    if (dialog.isOpen){
      await dialog.close();
    }
  });
}

function testDynamicTestSuiteInfoEvent(){
  const html = `
    <div class="container">
      <div class="body">
        <div class="title">What is a dynamic test suite?</div>
        <div class="content">
        <p>
          A dynamic test suite lets you execute test cases with certain tags dynamically.
        </p>
        </div>
      </div>
      <div class="footer">
        <a href="https://docs.katalon.com/katalon-recorder/docs/dynamic-test-suite.html" target="_blank">More details</a>
      </div>
    </div>
  `
  const dialog = new GenericDialog({
    modal: false,
    html: html,
    id: "dynamic-test-suites-info-dialog",
    height: 130,
    width: 300,
    draggable: false,
    appendTo: "#dynamic-test-suite-info"
  });
  $("#dynamic-test-suite-info").mouseover(async function(event){
    if (dialog.isOpen){
      return;
    }
    await dialog.render();
    const iconPosition = $("#dynamic-test-suite-info").position();
    dialog.dialog.parent().css("left", iconPosition.left + 38).css("top", iconPosition.top - 10);
  }).mouseleave(async function (){
    if (dialog.isOpen){
      await dialog.close();
    }
  });
}

function extensionScriptInfoEvent(){
  const html = `
    <div class="container">
      <div class="body">
        <div class="title">What is an extension script?</div>
        <div class="content">
        <p>
          An extension script allows you to add custom commands and locator methods to Katalon Recorder.
        </p>
        </div>
      </div>
      <div class="footer">
        <a href="https://docs.katalon.com/katalon-recorder/docs/extension-scripts-aka-user-extensionsjs-for-custom-locator-builders-and-actions.html" target="_blank">More details</a>
      </div>
    </div>
  `
  const dialog = new GenericDialog({
    modal: false,
    html: html,
    id: "extension-script-info-dialog",
    height: 140,
    width: 300,
    draggable: false,
    appendTo: "#extension-script-info"
  });
  $("#extension-script-info").mouseover(async function(event){
    if (dialog.isOpen){
      return;
    }
    await dialog.render();
    const iconPosition = $("#extension-script-info").position();
    dialog.dialog.parent().css("left", iconPosition.left + 36).css("top", iconPosition.top - 12);
  }).mouseleave(async function (){
    if (dialog.isOpen){
      await dialog.close();
    }
  });
}

function profilesInfoEvent(){
  const html = `
  <div class="container">
    <div class="body">
      <div class="title">How to use Global Variables?</div>
      <div class="content">
        <ul>
          <li>Create a new profile in your workspace.</li>
          <li>Add global variables in the profile.</li>
          <li>Right click on a profile, choose <b>Use this in a test case</b>.</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <a href="https://docs.katalon.com/katalon-recorder/docs/global-variables.html" target="_blank">More details</a>
    </div>
  </div>
`
  const dialog = new GenericDialog({
    modal: false,
    html: html,
    id: "profiles-info-dialog",
    height: 170,
    width: 300,
    draggable: false,
    appendTo: "#profiles-info"
  });
  $("#profiles-info").mouseover(async function(event){
    if (dialog.isOpen){
      return;
    }
    await dialog.render();
    const iconPosition = $("#profiles-info").position();
    dialog.dialog.parent().css("left", iconPosition.left + 36).css("top", iconPosition.top - 13);
  }).mouseleave(async function (){
    if (dialog.isOpen){
      await dialog.close();
    }
  });
}


$(document).ready(function () {
  $("#testDataDropdown").click(function () {
    const image = $(this).find("img");
    const src = $(image).attr("src");
    if (src.includes("off")) {
      $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
      $("#data-files-list").css("display", "flex");
    } else {
      $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
      $("#data-files-list").css("display", "none");
    }
  });

  $("#testDataPlus").click(function () {
    $("#load-data-file-hidden").click();
  });

  $("#extensionDropdown").click(function () {
    const image = $(this).find("img");
    const src = $(image).attr("src");
    if (src.includes("off")) {
      $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
      $("#extensions-list").css("display", "flex");
    } else {
      $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
      $("#extensions-list").css("display", "none");
    }
  });

  $('#extensionScriptPlus').click(function () {
    $("#load-extension-hidden").click();
  });

  $("#github").click(function () {
    window.open('https://github.com/katalon-studio/katalon-recorder');
  })
  testDataInfoEvent();
  testSuitsInfoEvent();
  testDynamicTestSuiteInfoEvent();
  extensionScriptInfoEvent();
  profilesInfoEvent();

});