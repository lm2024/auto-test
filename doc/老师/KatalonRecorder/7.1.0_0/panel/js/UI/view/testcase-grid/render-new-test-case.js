import { getSelectedCase, setSelectedCase } from "./selected-case.js";
import { getSelectedSuite } from "./selected-suite.js";
import { cleanSelected, saveOldCase } from "./utils.js";
import { generateTestCaseContextMenu } from "./generate-test-case-context-menu.js";
import { saveData } from "../../services/data-service/save-data.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { renderTestCaseToRecordGrid } from "../records-grid/render-test-case-to-record-grid.js";
import { enableButton } from "../buttons.js";
import { closeConfirm } from "./close-confirm.js";
import { generateAddTags } from "../dynamic-test-suite/add-tag-to-testcase.js";
import { getTagsData } from "../../services/data-service/test-suite-service.js";
import { generateAddTagsDiv } from "../dynamic-test-suite/add-tag-to-testcase.js";
import { commandHistory, selfHealingCommandHistory } from "../../services/records-grid-service/command-history.js";

function generateTestCaseContainerElement(id, tags) {
    const container = document.createElement("p");
    container.setAttribute("id", id);
    container.setAttribute("contextmenu", "menu" + id);
    container.setAttribute("data-tags", tags);
    container.classList.add("test-case-title");
    return container;
}

function generateTestCaseTitle(title) {
    const testCaseTitle = document.createElement("span");
    testCaseTitle.innerHTML = escapeHTML(title);
    return testCaseTitle;
}

function clickHandler(event) {
    event.stopPropagation();

    //Users can undo changes made within a test case only
    if (!this.classList.contains("selectedCase")) {
        commandHistory.reset();
        selfHealingCommandHistory.reset();
    }

    saveOldCase();
    saveData();
    //show testcase grid
    document.getElementsByClassName('dynamic-test-suite')[0].style.display = 'none';
    $('.command-section').show();
    $('.title-testcase').show();

    // use jquery's API to add and remove class property
    cleanSelected();
    this.classList.add("selectedCase");
    this.parentNode.classList.add("selectedSuite");
    $("#profile-section").css("display", "none");
    $("#profileTitle").css("display", "none");
    // $("#command-section")
    //     .css("display", "flex");
    // $("#command-grid").colResizable({ disable: true })
    //     .colResizable({ liveDrag: true, minWidth: 75 });
    clean_panel();
    const testCaseID = this.id;
    const testCase = findTestCaseById(testCaseID);

    const div = generateAddTagsDiv(this.id);
    if ($('.div-add-tag').length > 0) {
        $('.div-add-tag').remove();
    }
    document.getElementsByClassName('title-testcase')[0].append(div);

    let tagList = getTagsData().sort();
    $(`#div-item-add-tag-${this.id}`).find('input').autocomplete({
        source: tagList
    });

    renderTestCaseToRecordGrid(testCase);


    if (testCase.getTestCommandCount() > 0) {
        document.getElementById("records-1").scrollIntoView({
            behavior: 'auto',
            block: 'center',
        });
    }


}

function contextMenuHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    saveOldCase();
    setSelectedCase(this.id);
    let mid = "#" + "menu" + this.id;
    $(".menu").css("left", event.pageX).css("top", event.pageY);
    $(mid).show();
}

function generateTagTestCaseIcon(id) {
    const tagTestcaseDiv = document.createElement("div");
    tagTestcaseDiv.classList.add("test-case-tag");
    tagTestcaseDiv.classList.add("tooltip");
    tagTestcaseDiv.setAttribute("id", "tags-icon-" + id);

    const img = document.createElement("img");
    const span = document.createElement("span");
    span.setAttribute('class', 'tooltiptext');
    span.innerText = "Tag this Test Case";
    span.style = "margin-left: -5px;";

    const tagsArr = findTestCaseById(id).tags;

    if (tagsArr && tagsArr.length > 0) {
        tagTestcaseDiv.setAttribute("style", "visibility: visible;");
        img.src = "/panel/icons/show-tag.svg";
    } else {
        img.src = "/panel/icons/tags.svg";
    }

    tagTestcaseDiv.appendChild(img);
    tagTestcaseDiv.appendChild(span);

    tagTestcaseDiv.addEventListener("click", function(event) {
        event.stopPropagation();
        //create menu
        const toogleTags = generateAddTags(id);
        if ($(`#add-tags-${id}`).length > 0) {
            $(`#add-tags-${id}`).remove();
        } else {
            tagTestcaseDiv.appendChild(toogleTags);
        }

        //listen key event of input
        let menuTag = $(`#add-tags-${id}`);
        menuTag.css("left", event.pageX);
        menuTag.css("top", event.pageY);
        menuTag.show();

        let tagList = getTagsData().sort();
        menuTag.find('input').autocomplete({
            source: tagList
        });

        menuTag.find('input').focus();
    });
    return tagTestcaseDiv;
}

const renderNewTestCase = (title, id, tags) => {
    tags = tags !== undefined ? tags : [];
    const container = generateTestCaseContainerElement(id, tags.toString());
    const testCaseTitle = generateTestCaseTitle(title);
    const tagTestcase = generateTagTestCaseIcon(id);
    container.appendChild(testCaseTitle);

    const selectedTestCase = getSelectedCase();
    if (selectedTestCase) {
        selectedTestCase.parentNode.insertBefore(container, selectedTestCase.nextSibling);
    } else {
        getSelectedSuite().appendChild(container);
    }
    //set added test case and its test suite as selected
    cleanSelected();
    container.classList.add("selectedCase");
    const menu = generateTestCaseContextMenu(id);
    container.parentNode.classList.add("selectedSuite");
    container.appendChild(menu);
    clean_panel();

    //attach event
    container.addEventListener("click", clickHandler);
    container.addEventListener("contextmenu", contextMenuHandler);

    container.appendChild(tagTestcase);
    addContextMenuButton(id, container, menu, 'case');
    closeConfirm(true);
    // enable play button
    enableButton("playback");
}

export { renderNewTestCase }