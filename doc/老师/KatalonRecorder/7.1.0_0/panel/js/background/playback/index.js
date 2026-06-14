import { ExtCommand } from "../window-controller.js";
import { commandFactory } from "./service/command/CommandFactory.js";
import { testSuitContainerOpen } from "../../UI/view/testcase-grid/test-suite-container.js";
import { testSuiteDropdownOpen } from "../../UI/view/testcase-grid/render-new-test-suite.js";
import { getSelectedCase, setSelectedCase } from "../../UI/view/testcase-grid/selected-case.js";

window.isSelecting = false;
window.extCommand = new ExtCommand();
window.currentPlayingFromHereCommandIndex = 0;
window.defaultProfile = null;

window.segmentService = async function () {
    return await
        import('../../UI/services/tracking-service/segment-tracking-service.js');
}


let extensionId;
window.onload = function () {
    browser.windows.getCurrent().then(function(win) {
        extensionId = win.id;
    });
    $("#record").click(function() {
        let command = commandFactory.createCommand("record");
        command.execute();
    });
    $("#playback").click(function () {
        setTimeout(() => {
            let command = commandFactory.createCommand("playTestCase");
            command.execute();
        }, 500);
    });
    $("#stop").click(function () {
        let command = commandFactory.createCommand("stop");
        command.execute();
    });
    $("#pause").click(function () {
        let command = commandFactory.createCommand("pause");
        command.execute();
    });
    $("#resume").click(function () {
        let command = commandFactory.createCommand("resume");
        command.execute();
    });
    $("#playSuite").click(function () {
        setTimeout(() => {
            let command = commandFactory.createCommand("playTestSuite");
            command.execute();
        }, 500);
    });
    $("#playSuites").click(function () {
        setTimeout(() => {
            let command = commandFactory.createCommand("playAll");
            command.execute();
        }, 500);
    });

    $(document).dblclick(function (event) {
        $(event.target).find('.toolbar-btn').hide();
        if ($("#records-grid").find('#command-command').length == 0 && $("#records-grid").find('#command-target').length == 0 && $("#records-grid").find('#command-value').length == 0) {
            let command = commandFactory.createCommand("executeTestStep", event);
            command.execute();
        }
    });

    browser.runtime.onMessage.addListener(function(message, sender, sendRequest) {
        if (message.checkStopInContentScript) {
            if (isRecording) {
                $("#record").click();
                browser.windows.update(extensionId, { focused: true });

                /* In case user presses record without
                *  creating a new test suite */
                let image = $("#testSuiteDropdown").find("img");
                let src = $(image).attr("src");
                if (src.includes("off")) {
                  testSuitContainerOpen();
                }

                /* Display newly recorded test case */
                let newTestCase = getSelectedCase();
                let newTestSuite = newTestCase.parentElement;
                if (newTestSuite) {
                  testSuiteDropdownOpen(newTestSuite.id);
                }
                $(`#${newTestCase.id}`).trigger("click");
            }
        }
    });

};