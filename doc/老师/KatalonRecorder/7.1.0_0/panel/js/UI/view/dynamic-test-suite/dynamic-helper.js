import { createTestSuite, } from "../../services/data-service/test-suite-service.js";
import { renderNewTestSuite } from "../testcase-grid/render-new-test-suite.js";
import { trackingCreateTestSuite } from "../../services/tracking-service/segment-tracking-service.js";

function createNewDynamicTestSuite(query) {
    $("#dynamic-dropdown").find("img").attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
    $("#testCase-filter").css("display", "block");

    const newTitle = "Dynamic Test Suite";
    const newTestSuite = createTestSuite(newTitle, 'dynamic');

    if (query){
        newTestSuite.query = query;
    }

    renderNewTestSuite(newTitle, newTestSuite.id, newTestSuite.status);
    trackingCreateTestSuite('UI', newTitle, 'dynamic');

    $(`#${newTestSuite.id}`).click();
}

export { createNewDynamicTestSuite }