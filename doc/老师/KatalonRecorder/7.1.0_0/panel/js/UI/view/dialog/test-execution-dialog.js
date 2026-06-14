export async function testExecutionDialog(isPlayingSuite, isPlayingAll, isLastTestCommand) {
  let settingData = await browser.storage.local.get("setting");
  settingData = settingData.setting ?? {};
  let testExecution = settingData.testExecution ?? {};

  // Pause to display the dialog
  let time = 0;
  if (!isLastTestCommand) {
    if (!$("#pause").is(":disabled")) {
      $("#pause").click();
    }
  }

  if (isLastTestCommand && (isPlayingSuite || isPlayingAll)) {
      time = 1000;
      setTimeout(() => {
        if (!$("#pause").is(":disabled")) {
          $("#pause").click();
        }
      }, time);
  }


  // Initialize the dialog HTML
  let dialogHTML = `
    <div class="test-dialog-header">
      <div class="test-dialog-title">Continue this test execution?</div>
      <button id="close-test-dialog" class="close-test-dialog">&times;</button>
    </div>
    <p style="font-size: 14px">You can <span id="test-execution-settings" style="color: #3366FF;">go to Settings</span> to reconfigure this behavior.</p>
    <input type="checkbox" id="hide-execution-dialog" style="font-size: 18px">
    <label for="hide-execution-dialog" style="font-size: 14px">Do not show this message again.</label><br>
    <div style="display: flex; justify-content:right; margin-top:16px;">
        <button id="stop-execution" class="testExecutionBtn" type="button" style="margin-right: 10px;">Stop test execution</button>
        <button id="continue-execution" class="testExecutionBtn" type="button">Continue</button>
    </div>
    <style>
    .test-dialog-header{
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #233145;
    }
    .test-dialog-title{
      font-weight: bold;
      font-size: 20px;
    }
    .close-test-dialog{
      cursor: pointer;
      border: none;
      outline: none;
      background: none;
      font-size: 24px;
      color: #808B9A;
    }
    .testExecutionBtn{
        border-radius: 4px;
        padding: 8px 12px;
        border: none;
        font-size: 16px;
    }
    #test-execution-settings{
      cursor: pointer;
      color: blue;
    }
    #stop-execution{
        color: black;
        background-color: #F0F1F2;
    }
    #stop-execution:hover{
        background-color: #d7dbdb;
    }
    #continue-execution{
        background-color: #276EF1;
        color: white;
    }
    #continue-execution:hover{
        background-color: #1d42af;
    }
  </style>
  `;

  let popup = $('<div id="test-execution-dialog"></div>').css({
    'display': 'none',
    'position': 'fixed',
    'bottom': '10%',
    'right': '41px',
    'z-index': '1',
    'background-color': '#ffffff',
    'width': '360px',
    'height': '144px',
    'box-shadow': '0px 8px 16px 0px rgba(0,0,0,0.25)',
    'padding': '16px 20px',
    'margin-bottom': '-1%',
    'border-radius': '6px',
    'color': 'black'
  }).html(dialogHTML).draggable();

  var settingWindowID;
  function openPanel() {
    browser.storage.local.set({ testExecutionTab: true });
    let height = 740;
    let width = 820;
    browser.windows.create({
      url: browser.runtime.getURL("setting-panel/index.html"),
      type: "popup",
      height: height,
      width: width,
      focused: true,
    }).then(window => settingWindowID = window.id);
  }

  if ($("#test-execution-dialog").length == 0)
    $(".command-sample-section").append(popup);

  $(function () {
    $("#test-execution-settings").on("click", function () {
      if (settingWindowID === undefined) {
        openPanel();
      } else {
        browser.windows.update(settingWindowID, {
          focused: true
        }).catch(function () {
          settingWindowID = undefined;
          openPanel();
        });
      }
    })
  });

  $("#stop-execution").click(async function () {
    testExecution.stopExecution = true;
    testExecution.continueExecution = false;
    settingData.testExecution = testExecution;
    browser.storage.local.set({ setting: settingData });
    if ($("#stop").css("display") != "none") $("#stop").click();
    $("#test-execution-dialog").remove();
  });

  $("#continue-execution").click(async function () {
    testExecution.stopExecution = false;
    testExecution.continueExecution = true;
    settingData.testExecution = testExecution;
    browser.storage.local.set({ setting: settingData });
    if ($("#resume").css("display") != "none") $("#resume").click();
    $("#test-execution-dialog").remove();
  });

  $("#hide-execution-dialog").click(async function () {
    testExecution.hideExecutionDialog = this.checked;
    settingData.testExecution = testExecution;
    browser.storage.local.set({ setting: settingData });
  });

  $("#close-test-dialog").click(function () {
    $("#test-execution-dialog").remove();
  });

  $("#test-execution-dialog").show();
}
