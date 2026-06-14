import { setIsChange } from "../setting-panel.js";

class TestExecutionTab {
  // Implements ISettingTab
  constructor(containerElement) {
    this.containerElement = containerElement;
  }

  async initialize() {
    $("#stop-execution").click(function () {
      setIsChange(true);
    });
    $("#continue-execution").click(function () {
      setIsChange(true);
    });
  }

  async getContent() {
    let settingData = await browser.storage.local.get("setting");
    settingData = settingData.setting ?? {};
    let testExecution = settingData.testExecution ?? {};

    const stopExecution = testExecution.stopExecution ? "checked" : "";
    const continueExecution = testExecution.continueExecution ? "checked" : "";

    return `
        <div id="test-execution-setting" style="display: none">
            <h1>Test execution upon test failure</h1>
            <p>Choose your preference when having a test failure:</p>
            <div>
                <input type="radio" id="stop-execution" name="test_failure_reference" value="pause" ${stopExecution}>
                <label for="pause">Stop test execution</label><br>
                <input type="radio" id="continue-execution" name="test_failure_reference" value="continue" ${continueExecution}>
                <label for="continue":>Continue test execution</label><br>
            </div>
        </div>
        `;
  }

  async saveData() {
    const stopExecution = $("#stop-execution").prop("checked");
    const continueExecution = $("#continue-execution").prop("checked");
    let settingData = await browser.storage.local.get("setting");
    settingData = settingData.setting ?? {};
    let testExecution = settingData.testExecution ?? {};
    testExecution.stopExecution = stopExecution;
    testExecution.continueExecution = continueExecution;

    settingData.testExecution = testExecution;
    browser.storage.local.set({ setting: settingData });
  }

  display() {
    for (let child of $(this.containerElement).children()) {
      $(child).hide();
    }
    $("#test-execution-setting").show();
  }
}

export { TestExecutionTab }