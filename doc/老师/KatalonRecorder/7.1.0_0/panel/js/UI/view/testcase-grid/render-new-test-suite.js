import { getSelectedSuite, setSelectedSuite } from "./selected-suite.js";
import { cleanSelected, saveOldCase } from "./utils.js";
import { generateTestSuiteContextMenu } from "./generate-test-suite-context-menu.js";
import { makeCaseSortable } from "./make-case-sortable.js";
import { enableButton, disableButton } from "../buttons.js";
import { generateDetailDynamicTestSuite } from "../dynamic-test-suite/detail-test-suite.js";
import { findTestSuiteById } from "../../services/data-service/test-suite-service.js";
import { commandHistory, selfHealingCommandHistory } from "../../services/records-grid-service/command-history.js";
import { getSelectedCase } from "./selected-case.js";

function generateSuiteTitleElement(title) {
    const text = document.createElement("strong");
    text.classList.add("test-suite-title");
    text.innerHTML = escapeHTML(title);
    return text;
}

function testSuiteDropdownOpen(testSuiteID) {
    const testSuiteContainer = $(`#${testSuiteID}`)[0];
    const dropdownIcon = testSuiteContainer
        .getElementsByClassName("dropdown")[0]
        .getElementsByTagName("img")[0];
    $(dropdownIcon).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
    [...$(testSuiteContainer).find("p")].forEach(element => {
        $(element).css("display", "flex");
    });
}

function testSuiteDropdownClose(testSuiteID) {
    const testSuiteContainer = $(`#${testSuiteID}`)[0];
    const dropdownIcon = testSuiteContainer
        .getElementsByClassName("dropdown")[0]
        .getElementsByTagName("img")[0];
    $(dropdownIcon).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
    [...$(testSuiteContainer).find("p")].forEach(element => {
        $(element).css("display", "none");
    });
}


function testSuiteDropdownHandler(event) {
    const image = $(this).find("img");
    const src = $(image).attr("src");
    const id = this.parentNode.parentNode.id;
    if (src.includes("off")) {
        testSuiteDropdownOpen(id);
    } else {
        testSuiteDropdownClose(id);
    }
}

function generateDropdownIcon(status) {
    const dropdown = document.createElement("div");
    dropdown.classList.add("dropdown");

    let icon = document.createElement("img");
    if (status && status === 'dynamic') {
        // icon.setAttribute("src", "");
        return document.createDocumentFragment();
    } else {
        dropdown.addEventListener("click", testSuiteDropdownHandler);
        icon.setAttribute("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
    }

    dropdown.appendChild(icon);
    return dropdown;
}

function generateTestSuiteIcon() {
    const testSuiteIconDiv = document.createElement("div");
    testSuiteIconDiv.classList.add("testSuiteIcon");
    const icon = document.createElement("img");
    icon.setAttribute("src", "/katalon/images/SVG/paper-icon.svg");
    testSuiteIconDiv.appendChild(icon);
    return testSuiteIconDiv
}

function generateAddTestCaseIcon(id) {
    const testCasePlusDiv = document.createElement("div");
    testCasePlusDiv.setAttribute("class","test-case-plus tooltip");
    
    const img = document.createElement("img");
    img.src = "/katalon/images/SVG/add-icon.svg";
    const span = document.createElement("span");
    span.classList.add("tooltiptext");
    span.innerText = "Create a new Test Case";
    
    testCasePlusDiv.appendChild(img);
    testCasePlusDiv.appendChild(span);

    testCasePlusDiv.addEventListener("click", function(event) {
        event.stopPropagation();
        setSelectedSuite(id);
        setTimeout(() => {
            $('#add-testCase').click();
        }, 200);
    });
    return testCasePlusDiv;
}

function generateTestSuiteHeader() {
    const header = document.createElement("div");
    header.classList.add("test-suite-header");
    return header;
}

function generateTestSuiteContainerElement(id) {
    const container = document.createElement("div");
    container.setAttribute("id", id);
    container.setAttribute("contextmenu", "menu" + id);
    container.setAttribute("class", "message");
    return container;
}

function clickHandler(event) {
    //Users can undo changes made within a test case only
    //if user click on the current selected test suite and the current selected test case is also the first test case
    //in that test suite -> do not reset command history
    if (!this.classList.contains("selectedSuite") || getSelectedCase()?.id !== this.getElementsByTagName("p")[0]?.id){
        commandHistory.reset();
        selfHealingCommandHistory.reset();
    }

    const testSuite = findTestSuiteById(this.id);
    const div_dynamic = document.getElementsByClassName('dynamic-test-suite')[0];
    if (testSuite.status === 'dynamic') {
        event.stopPropagation();
        saveOldCase();
        cleanSelected();
        this.classList.add("selectedSuite");

        if ($('#detail-dynamic').length > 0) {
            $('#detail-dynamic').remove();
        }
        const detail_div = generateDetailDynamicTestSuite(this.id);
        div_dynamic.appendChild(detail_div);

        div_dynamic.style.display = 'block';
        $('.command-section').hide();
        $('.title-testcase').hide();
        $("#profile-section").hide();
        $("#profileTitle").hide();
    } else {
        div_dynamic.style.display = 'none';;
        $('.command-section').show();
        $('.title-testcase').show();
        $("#profile-section").hide();
        $("#profileTitle").hide();
        $(".command-section").css("min-height", "30%");
        if (this.getElementsByTagName("p").length !== 0) {
            this.getElementsByTagName("p")[0].click();
        } else {
            event.stopPropagation();
            saveOldCase();
            cleanSelected();
            this.classList.add("selectedSuite");

            const testCaseList = this.getElementsByTagName("p");
            if (testCaseList.length > 0) {
                $(testCaseList[0]).click();
            }
        }
    }


}

function contextMenuHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    saveOldCase();
    setSelectedSuite(this.id);
    let mid = "#" + "menu" + this.id;
    $(".menu").css("left", event.pageX).css("top", event.pageY);
    $(mid).show();
}


const renderNewTestSuite = (title, id, status) => {
    const dropdown = generateDropdownIcon(status);
    const testSuiteIcon = generateTestSuiteIcon();
    const suiteTitle = generateSuiteTitleElement(title);
    const addTestCase = generateAddTestCaseIcon(id);
    const header = generateTestSuiteHeader();

    header.appendChild(dropdown);
    header.appendChild(testSuiteIcon);
    header.appendChild(suiteTitle);
    if (!(status && status === 'dynamic')) {
        header.appendChild(addTestCase);
    }

    const container = generateTestSuiteContainerElement(id);
    container.append(header);

    //append new test suite container to testCase-grid
    if (status && status === 'dynamic') {
        document.getElementById("testCase-filter").appendChild(container);
    } else {
        let selectedTestSuite = getSelectedSuite();
        if (selectedTestSuite) {
            const testSuite = findTestSuiteById(selectedTestSuite.id);
            if (testSuite.status === status) {
                selectedTestSuite.parentNode.insertBefore(container, selectedTestSuite.nextSibling);
            } else {
                if (status === 'dynamic') {
                    document.getElementById("testCase-filter").appendChild(container);
                } else {
                    document.getElementById("testCase-grid").appendChild(container);
                }
            }
        } else {
            document.getElementById("testCase-grid").appendChild(container);
        }
    }
    //set added test suite as selected
    cleanSelected();
    container.classList.add("selectedSuite");
    const menu = generateTestSuiteContextMenu(id);
    container.appendChild(menu);
    // attach event
    container.addEventListener("click", clickHandler);
    container.addEventListener("contextmenu", contextMenuHandler);


    makeCaseSortable(container);
    //add context menu button
    addContextMenuButton(id, header, menu, 'suite');
    // enable play button
    enableButton("playSuites");
    enableButton("playSuite");
}


export { renderNewTestSuite, testSuiteDropdownOpen }