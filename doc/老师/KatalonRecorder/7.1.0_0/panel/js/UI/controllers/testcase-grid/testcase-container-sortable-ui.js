import {
    deleteTestSuite,
    findTestSuiteById,
    findTestSuiteIndexByID,
    getTestSuiteCount, insertNewTestSuiteAtIndex
} from "../../services/data-service/test-suite-service.js";

let isUpdated = false;
$(document).ready(function () {
    $("#testCase-container").sortable({
        axis: "y",
        handle: "strong",
        items: ".message",
        scroll: true,
        revert: 300,
        scrollSensitivity: 20,
        start: function (event, ui) {
            ui.placeholder.height(ui.item.height());
            isUpdated = true;
        },
        update: function(event, ui) {
            if (!isUpdated){
                return;
            }
            const draggedTestSuiteElement = ui.item[0];
            let nextTestSuiteElement = $(draggedTestSuiteElement).next();

            const draggedTestSuite = findTestSuiteById(draggedTestSuiteElement.id);
            deleteTestSuite(draggedTestSuite.id);
            let index = getTestSuiteCount();
            if (nextTestSuiteElement.length !== 0) {
                nextTestSuiteElement = nextTestSuiteElement[0];
                index = findTestSuiteIndexByID(nextTestSuiteElement.id);
            }
            insertNewTestSuiteAtIndex(index, draggedTestSuite);
            isUpdated = false;
        }
    });
});