import {readCsv, readJson} from "../../services/data-file-service/data-file-services.js";
import { resetDataList, testDataContainerOpen } from "../../view/data-file/data-file-view.js";
import { setTrackingLeftSidePanelData } from "../../services/tracking-service/left-side-panel-tracking.js";

$(function() {
    browser.storage.local.get('dataFiles').then(function(result) {
        window.dataFiles = result.dataFiles;
        if (!window.dataFiles) {
            window.dataFiles = {};
        }
        resetDataList();
    });
    document.getElementById("load-data-file-hidden").addEventListener("change", function(event) {
        event.stopPropagation();
        for (var i = 0; i < this.files.length; i++) {
            if (this.files[i].name.endsWith(".csv")) {
                readCsv(this.files[i]);
            } else {
                readJson(this.files[i]);
            }
        }
        testDataContainerOpen();
        this.value = null;
        setTrackingLeftSidePanelData("addTestData");
    }, false);
});



