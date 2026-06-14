import { findTestCaseById, getTag } from "../../services/data-service/test-case-service.js";
import { generateItemTagWithoutButton, createTableDynamicTestSuite, generateFilterTags } from "./detail-test-suite.js";
import { trackingAddTag, trackingRemoveTag } from "../../services/tracking-service/dynamic-testsuite-tracking.js";
import { createNewDynamicTestSuite } from "./dynamic-helper.js";

let idTestCase;

function loadButtonTags() {
    if ($(`#button-tags${idTestCase}`).length > 0) {
        $(`#button-tags${idTestCase}`).remove();
        const buttonTag = generateButtonsTags();
        $("#add-tags-" + idTestCase).prepend(buttonTag);
    }

    if ($(`#div-button-tags${idTestCase}`).length > 0) {
        $(`#div-button-tags${idTestCase}`).remove();
        const buttonTag = addDivTagList();
        $("#div-item-add-tag-" + idTestCase).append(buttonTag);
    }
}

function addTagIntoTestcase(valueInput) {
    const testcaseObj = findTestCaseById(idTestCase);
    let tags = $(`#${idTestCase}`).attr('data-tags');
    let tagsString = valueInput.indexOf(',') > -1 ? valueInput.split(',') : [valueInput];
    tagsString = tagsString.filter(e => e !== "");

    if (tags) {
        let tagMap = tags.indexOf(',') > -1 ? tags.split(',') : [tags];
        for (const tag of tagsString) {
            if (tagMap.every(e => e !== tag)) {
                tagMap.push(tag);
            }
        }
        testcaseObj.tags = tagMap;
        tags = tagMap.join(',');
    } else {
        testcaseObj.tags = tagsString;
        tags = tagsString.toString();
        //show icon tag
        const iconTag = document.getElementById("tags-icon-" + idTestCase);
        iconTag.setAttribute("style", "visibility: visible;");
        iconTag.getElementsByTagName('img')[0].src = "/panel/icons/show-tag.svg";
    }

    loadButtonTags();

    $(`#${idTestCase}`).attr("data-tags", tags);
    trackingAddTag();
}

function getTagsCount(tagName) {
  return $(`[data-tags*=${tagName}]`);
}

function quickDynamicDialog(query) {
    const div = document.createElement("div");
    div.setAttribute("id", "quick-actions");

    const filter = generateFilterTags(query, "New Dynamic Test Suite with Selection");
    const table = createTableDynamicTestSuite(query);

    const button = document.createElement("div");
    button.setAttribute("id", "button-quick-actions");
    button.setAttribute("style", "display: flex; margin-top: 20px; flex-direction: row; align-self: flex-end;");

    const span1 = document.createElement("span");
    span1.innerHTML="Cancel";
    span1.setAttribute("style", "background: #F0F1F2;border-radius: 4px;padding: 5px 10px;font-family: Roboto;font-style: normal;font-size: 14px;line-height: 20px;cursor: pointer;");
    
    span1.addEventListener("click",function () {
        if($('#quick-actions').is(":visible")){
            $('#quick-actions').remove();
        }
    })

    const span2 = document.createElement("span");
    span2.innerHTML="Create";
    span2.setAttribute("style", "background: #276EF1;border-radius: 4px;padding: 5px 10px;font-family: Roboto;font-style: normal;font-size: 14px;line-height: 20px;color: #FFFFFF;margin-left: 10px;cursor: pointer;");

    span2.addEventListener("click",function () {
        let inputQuery;
        if($('#quick-actions').is(":visible")){
            inputQuery = $('#quick-actions').find("#input-dynamic").find("input").val();
            $('#quick-actions').remove();
        }
        
        createNewDynamicTestSuite(inputQuery);

        $("#play").click();
    })

    button.appendChild(span1);
    button.appendChild(span2);

    div.appendChild(filter);
    div.appendChild(table);
    div.appendChild(button);
    
    $(div)
    .dialog({
      dialogClass: "no-titlebar",
      autoOpen: false,
      resizable: true,
      height: "auto",
      width: 684,
      modal: true,
      open: function() {
        $(this).css("maxHeight", 400);
      }
    });
}

//add tag to contextmenu
const generateItemTag = (val) => {
    const box_item = document.createElement("div");
    box_item.innerHTML = val;

    box_item.addEventListener("click", function(e) {
        if (!e.target.src) {
            quickDynamicDialog(this.innerText);
            $("#quick-actions").dialog("open");
        }
    })

    const button_remove = document.createElement("img");
    button_remove.src = 'icons/remove.svg';

    button_remove.addEventListener("click", function(e) {
        let removeValue = this.parentNode.textContent;
        const testcaseObj = findTestCaseById(idTestCase);
        let tags = $(`#${idTestCase}`).attr('data-tags');
        let tagMap = tags.indexOf(',') > -1 ? tags.split(',') : [tags];

        tagMap = tagMap.filter(e => e !== removeValue);

        testcaseObj.tags = tagMap;
        $(`#${idTestCase}`).attr("data-tags", tagMap.toString());

        loadButtonTags();

        if (tagMap.length <= 0) {
            const iconTag = document.getElementById("tags-icon-" + idTestCase);
            iconTag.removeAttribute("style");
            iconTag.getElementsByTagName('img')[0].src = "/panel/icons/tags.svg";
        }
        trackingRemoveTag();

    });

    box_item.appendChild(button_remove);

    return box_item;
}

function generateButtonsTags() {
    const div_tag = document.createElement("div");
    div_tag.setAttribute("id", "button-tags" + idTestCase);
    div_tag.setAttribute("class", "button-tags");

    const span_tag = document.createElement("span");
    span_tag.innerHTML = "Click on a tag to filter and execute test cases"

    let tags = getTag(idTestCase);
    if (tags.length > 0) {
        div_tag.appendChild(span_tag)
        for (const val of tags) {
            const item_tags = generateItemTag(val);
            div_tag.appendChild(item_tags)
        }
    }

    return div_tag;
}

function generateAutocomplete() {
    const div_input = document.createElement("div");
    div_input.setAttribute("id", "div-input-tags");
    div_input.setAttribute("class", "div-input-tags");

    const span_input = document.createElement("span");
    span_input.setAttribute("id", "span-input-tags");
    span_input.setAttribute("class", "span-input-tags");
    span_input.innerHTML = "Tag this test case";

    const input_tag = document.createElement("INPUT");
    input_tag.setAttribute("id", "input-tags");
    input_tag.setAttribute("class", "input-tags");

    input_tag.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            addTagIntoTestcase(this.value);
            //clear input
            $("#add-tags-" + idTestCase).find('input').val('');
            $("#add-tags-" + idTestCase).find('input').focus();
        }
    }, false);

    div_input.appendChild(span_input);
    div_input.appendChild(input_tag);

    return div_input;
}

const generateAddTags = (id) => {
    idTestCase = id;
    const menu = document.createElement("div");
    menu.setAttribute("class", "menu");
    menu.setAttribute("id", "add-tags-" + id);
    menu.setAttribute("style", "width: 255px;");

    const inputTag = generateAutocomplete();
    const divTag = generateButtonsTags();
    menu.appendChild(divTag)
    menu.append(inputTag);

    return menu;
}

//add tag to record-grid
function renderButtonTag(divTag, tags, length) {
    if (tags.length > length) {
        for (let index = 0; index < length; index++) {
            const element = tags[index];
            const item_tags = generateItemTag(element);
            divTag.appendChild(item_tags);
        }

        const divMore = document.createElement("div");
        divMore.setAttribute("class", "more-div-tag");
        divMore.setAttribute("id", "more-button-tag-" + idTestCase);

        for (let index = length; index < tags.length; index++) {
            const element = tags[index];
            const item_tags = generateItemTag(element);
            divMore.appendChild(item_tags);
        }

        const moreButton = generateItemTagWithoutButton('...');
        moreButton.setAttribute("style", "cursor: pointer;");

        moreButton.addEventListener('click', (event) => {
            const moreTag = $(`#more-button-tag-${idTestCase}`);
            if (moreTag.is(':visible')) {
                moreTag.hide();
            } else {
                moreTag.show();
            }
        })

        divTag.appendChild(moreButton);
        divTag.appendChild(divMore);
    } else {
        for (const val of tags) {
            const item_tags = generateItemTag(val);
            divTag.appendChild(item_tags)
        }
    }
}

function addDivTagList() {
    const div_tag = document.createElement("div");
    div_tag.setAttribute("id", "div-button-tags" + idTestCase);
    div_tag.setAttribute("class", "button-tags");

    let tags = getTag(idTestCase);

    switch (true) {
        case (window.innerWidth < 726): //show 2 items and more button
            {
                renderButtonTag(div_tag, tags, 2);
                break;
            }
        case (window.innerWidth >= 726 && window.innerWidth < 814): //show 3 items and more button
            {
                renderButtonTag(div_tag, tags, 3);
                break;
            }
        case (window.innerWidth >= 814 && window.innerWidth < 1072): //show 4 items and more button
            {
                renderButtonTag(div_tag, tags, 4);
                break;
            }
        case (window.innerWidth >= 1072 && window.innerWidth < 1225): //show 5 items and more button
            {
                renderButtonTag(div_tag, tags, 5);
                break;
            }
        case (window.innerWidth >= 1225): //show 6 items and more button
            {
                renderButtonTag(div_tag, tags, 6);
                break;
            }
        default:
            break;
    }

    return div_tag;
}

function addTagtoInput() {
    const input_tag = document.createElement("INPUT");
    input_tag.setAttribute("id", "input-tags");
    input_tag.setAttribute("class", "input-tags");

    input_tag.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            addTagIntoTestcase(this.value);
            //clear input
            $(`#div-item-add-tag-${idTestCase}`).find('input').val('');
            $(`#div-item-add-tag-${idTestCase}`).find('input').focus();
        }
    }, false);

    input_tag.onfocusout = () => {
        $(`#div-item-add-tag-${idTestCase}`).find('input').val('');
        $(`#div-item-add-tag-${idTestCase}`).find('input').hide();
        $(`#button-item-add-tag-${idTestCase}`).show();
    }

    return input_tag;
}

function addButtonTag() {
    const div_item = document.createElement("div");
    div_item.setAttribute("class", "button-item-add-tag");
    div_item.setAttribute("id", "button-item-add-tag-" + idTestCase);

    const button_add = document.createElement("img");
    button_add.src = 'icons/add-tag.svg';

    div_item.appendChild(button_add);

    div_item.addEventListener("click", function() {
        $(`#div-item-add-tag-${idTestCase}`).find('input').show();
        $(`#div-item-add-tag-${idTestCase}`).find('input').focus();
        $(`#button-item-add-tag-${idTestCase}`).hide();
    });

    return div_item;
}

function generateDivItemAddTag() {
    const div_item = document.createElement("div");
    div_item.setAttribute("class", "div-item-add-tag");
    div_item.setAttribute("id", "div-item-add-tag-" + idTestCase);

    const div_item_tag = addDivTagList();
    const input_item_tag = addTagtoInput();
    const button_item_tag = addButtonTag();
    div_item.appendChild(button_item_tag);
    div_item.appendChild(input_item_tag);
    div_item.appendChild(div_item_tag);

    return div_item;
}

const generateAddTagsDiv = (id) => {
    idTestCase = id;
    const div = document.createElement("div");
    div.setAttribute("class", "div-add-tag");
    div.setAttribute("id", "div-add-tag-" + id);

    const testcaseObj = findTestCaseById(idTestCase);
    const span = document.createElement("span");
    span.innerHTML = testcaseObj.name;
    div.appendChild(span);

    const div_item = generateDivItemAddTag();
    div.appendChild(div_item);

    return div;
}

export { generateAddTags, generateItemTag, generateAddTagsDiv }