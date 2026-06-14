// import { loadData } from "../UI/services/data-service/load-data.js";
// import {
//     deleteAllTestSuite,
//     getTestSuiteCount,
//     getTextSuiteByIndex
// } from "../UI/services/data-service/test-suite-service.js";
// import { displayNewTestSuite } from "../UI/view/testcase-grid/display-new-test-suite.js";
// import { testSuitContainerOpen } from "../UI/view/testcase-grid/test-suite-container.js";

// backup data will like: {"data": {...}, ...}
function readBackupData(f) {
    var reader = new FileReader();
    reader.readAsText(f);
    reader.onload = function() {
        var backupData = JSON.parse(reader.result);
        restoreBackupData(backupData);
    }
}

function restoreBackupData(backupData) {
    browser.storage.local.clear().then(function() {
        browser.storage.local.set(backupData).then( function() {
            const html = `<div class="header">
                    <div class="title">Restore Data</div>
                      <button id="feedback-close">
                          <img src="/katalon/images/SVG/close-icon.svg"/>
                      </button>
                </div>
                <div class="content">
                    <div class="message">
                        <span>Please re-open Katalon Recorder to see your backup data</span>
                    </div>
                </div>
                <div class="footer">
                    <button id="restore-okay-btn">OK</button>
                </div>`
            $("<div id='restore-warning-dialog'></div>")
              .html(html)
              .dialog({
                  autoOpen: true,
                  dialogClass: 'feedbackDialog',
                  resizable: true,
                  height: "164",
                  width: "400",
                  modal: true,
                  draggable: false,
                  open: function(){
                      $('.ui-widget-overlay').addClass("dim-overlay");
                  },
              }).parent()
              .draggable();
            $("#restore-okay-btn").click(function(){
                reload();
            })
        });
    });
}

function reload() {
    $(window).off('beforeunload');
    window.close()
}

function refreshStatusBar() {
    $.ajax({
        url: testOpsUrls.getUserInfo,
        type: 'GET',
        success: function(data) {
            if (data.email) {
                showBackupEnabledStatus();
                if (document.getElementById("logcontainer").childElementCount === 0){
                    $("#ka-upload").addClass("disable");
                }
            } else {
                showBackupDisabledStatus();
            }
        },
        error: function() {
            showBackupDisabledStatus();
        },
    });
}

$(function() {
    var backupRestoreInput = $('#backup-restore-hidden');
    $('#backup-restore-btn').click(function() {
        backupRestoreInput.click();
    });
    $('#backup-refresh-btn').click(function() {
        refreshStatusBar();
    });
    backupRestoreInput.change(function(event) {
        if (this.files.length === 1) {
            readBackupData(this.files[0]);
        }
        this.value = null;
    });
});

$(refreshStatusBar);
