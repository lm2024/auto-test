/*
 * Copyright 2017 SideeX committers
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

/* recording */

var selfWindowId = -1;
var contentWindowId;
var notificationCount = 0;

var recorder;
var addCommandAuto;
(async function () {
    let recorderModule = await import("./recorder.js");
    recorder = new recorderModule.BackgroundRecorder();
    let addCommandModule = await import("../UI/view/records-grid/add-command.js");
    addCommandAuto = addCommandModule.addCommandAuto;
})();

/* flags */
window.isRecording = false;
window.isPlaying = false;

class Editor {

}

function handleMessage(message, sender, sendResponse) {
    if (message.selectTarget) {
        var target = message.target;
        // show first locator by default
        var locatorString = target[0][0];
        if (locatorString.includes("d-XPath")) locatorString = "auto-located-by-tac";

        // Update toolbar
        const selectedTd = $('.selectedTd');
        const inputTarget = selectedTd.find('#command-target');
        inputTarget.val(locatorString);
        inputTarget.focus();
        selectedTd.find("#selectElementButton").css('background', '#FFFFFF');
        modifyCaseSuite();

        return;
    }
    if (message.cancelSelectTarget) {
        var button = document.getElementById("selectElementButton");
        isSelecting = false;
        // KAT-BEGIN hide button label
        // button.textContent = "Select";
        button.classList.remove("active");
        // KAT-END
        browser.tabs.sendMessage(sender.tab.id, { selectMode: true, selecting: false });
        return;
    }

    if (message.attachRecorderRequest) {
        if (isRecording && !isPlaying) {
            browser.tabs.sendMessage(sender.tab.id, { attachRecorder: true });
        }
        return;
    }
}

browser.runtime.onMessage.addListener(handleMessage);

browser.runtime.onMessage.addListener(function contentWindowIdListener(message) {
    if (message.selfWindowId != undefined && message.commWindowId != undefined) {
        selfWindowId = message.selfWindowId;
        contentWindowId = message.commWindowId;
        extCommand.setContentWindowId(contentWindowId);
        recorder.setOpenedWindow(contentWindowId);
        recorder.setSelfWindowId(selfWindowId);
        browser.runtime.onMessage.removeListener(contentWindowIdListener);
    }
})

function notification(command, target, value) {
    let tempCount = String(notificationCount);
    notificationCount++;
    // In Chrome, notification.create must have "iconUrl" key in notificationOptions
    browser.notifications.create(tempCount, {
        "type": "basic",
        "iconUrl": "/katalon/images/branding_48.png",
        "title": "Command Recorded",
        "message": "command: " + String(command) + "\ntarget: " + tacPreprocess(String(target ? target[0][0] : '')) + "\nvalue: " + String(value)
    });

    setTimeout(function () {
        browser.notifications.clear(tempCount);
    }, 1500);
}

function tacPreprocess(target) {
    if (target.includes("d-XPath")) return "auto-located-by-tac";
    return target;
}