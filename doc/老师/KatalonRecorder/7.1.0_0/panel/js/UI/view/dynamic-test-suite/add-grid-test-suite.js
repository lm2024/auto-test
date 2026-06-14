import { createTestSuite, } from "../../services/data-service/test-suite-service.js";
import { testSuitContainerOpen } from "../testcase-grid/test-suite-container.js";
import { renderNewTestSuite } from "../testcase-grid/render-new-test-suite.js";
import { trackingCreateTestSuite } from "../../services/tracking-service/segment-tracking-service.js";

function addNewNormalTestSuite() {
    const normalTestSuite = document.createElement("li");
    const a = document.createElement("a");
    a.setAttribute("href", "#");
    a.textContent = "New Normal Test Suite";
    normalTestSuite.appendChild(a);
    normalTestSuite.addEventListener("click", async function(event) {
        document.getElementById("add-testSuite").click();
        testSuitContainerOpen();
    }, false);
    return normalTestSuite;
}

function addNewDynamicTestSuite() {
    const dynamic_test_suite = document.createElement("li");
    const a = document.createElement("a");
    a.setAttribute("href", "#");
    a.textContent = "New Dynamic Test Suite";
    dynamic_test_suite.appendChild(a);
    dynamic_test_suite.addEventListener("click", async function(event) {
        const newTitle = "Dynamic Test Suite";
        const newTestSuite = createTestSuite(newTitle, 'dynamic');
        renderNewTestSuite(newTitle, newTestSuite.id, newTestSuite.status);
        trackingCreateTestSuite('UI', newTitle, 'dynamic')
    }, false);
    return dynamic_test_suite;
}

const generateAddTestSuiteContextMenu = () => {
    const menu = document.createElement("div");
    menu.setAttribute("class", "menu");
    menu.setAttribute("id", "add-testsuite");
    const ul = document.createElement("ul");
    const addNormalTestSuite = addNewNormalTestSuite();
    const addDynamicTestSuite = addNewDynamicTestSuite();

    ul.appendChild(addNormalTestSuite);
    ul.appendChild(addDynamicTestSuite);

    menu.appendChild(ul);
    return menu;
}

export { generateAddTestSuiteContextMenu }