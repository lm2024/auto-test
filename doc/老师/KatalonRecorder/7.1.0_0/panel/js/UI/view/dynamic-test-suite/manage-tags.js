import { auditTags, getTagsData, getAllTestSuites } from "../../services/data-service/test-suite-service.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { trackingAddTagFromMangagement, trackingEditTagFromMangagement, trackingRemoveTagFromMangagement } from "../../services/tracking-service/dynamic-testsuite-tracking.js";

//render div
function generateDiv(value, src) {
    const div_item = document.createElement("div");
    div_item.setAttribute("class", value);
    div_item.setAttribute("id", value);

    if (src) {
        const button_add = document.createElement("img");
        button_add.src = src;

        div_item.appendChild(button_add);
    }

    return div_item;
}

//render title
function generateTitle() {
    const div = document.createElement("div");
    div.setAttribute("class", "title-manage-tag");
    div.setAttribute("id", "title-manage-tag");

    const backButton = document.createElement("img");
    backButton.setAttribute("id", "back-tag");
    backButton.setAttribute("style", "display:none;");
    backButton.src = 'icons/back.svg';

    backButton.addEventListener("click", function(e) {
        if ($('#content-delete-tag').length > 0) {
            $('#content-delete-tag').remove();
        }

        if ($('#content-edit-tag').length > 0) {
            $('#content-edit-tag').remove();
        }

        if ($('#content-add-tag').length > 0) {
            $('#content-add-tag').remove();
        }
        const mainContent = generateContenPopup();
        document.getElementById("manage-tag").appendChild(mainContent);
        $('#back-tag').hide();

        $("#title-manage-tag").find('span').html('Tags Management');
    })

    const span = document.createElement('span');
    span.textContent = 'Tags Management';

    const button_remove = document.createElement("img");
    button_remove.src = 'icons/remove.svg';

    button_remove.addEventListener("click", function(e) {
        $("#tag-popup").remove();
    })

    div.appendChild(backButton);
    div.appendChild(span);
    div.appendChild(button_remove);

    return div;
}

//render main content
function generateTableDynamicTag() {
    const ul = document.createElement('ul');
    ul.setAttribute("class", "table-dynamic");
    ul.setAttribute("id", "table-dynamic");

    for (const tag of auditTags()) {
        const item_div = document.createElement('li');
        item_div.setAttribute("id", "li-tag");

        const span = document.createElement('span');
        span.textContent = tag.tag;

        const div = generateDiv('div-button-tag');

        const numberDiv = generateDiv('number-tag');
        numberDiv.textContent = tag.testcases.length;

        const editDiv = generateDiv('button-edit-tag', 'icons/edit-tag.svg');
        editDiv.addEventListener("click", function(event) {
            $('#content-tag').remove();
            const mainContent = generateContentEditPopup(tag);
            document.getElementById("manage-tag").appendChild(mainContent);
            $('#back-tag').show();

            let tagList = getTagsData().sort();
            $('#content-input-tag').autocomplete({
                source: tagList
            });

            $("#title-manage-tag").find('span').html('Edit Tag');
        })

        const deleteDiv = generateDiv('button-delete-tag', 'icons/delete-tag.svg');
        deleteDiv.addEventListener("click", function(event) {
            $('#content-tag').remove();
            const mainContent = generateContentDeletePopup(tag);
            document.getElementById("manage-tag").appendChild(mainContent);
            $('#back-tag').show();

            $("#title-manage-tag").find('span').html('Delete Tag');
        })

        div.appendChild(numberDiv);
        div.appendChild(editDiv);
        div.appendChild(deleteDiv);

        item_div.appendChild(span);
        item_div.appendChild(div);


        ul.appendChild(item_div);
    }

    return ul;
}

function generateContenPopup() {
    const div = generateDiv('content-tag');

    const table = generateTableDynamicTag();
    const button = generateDiv("button-add-tag", 'icons/add-tag-blue.svg');

    button.addEventListener("click", function(event) {
        $('#content-tag').remove();
        const mainContent = generateContentAddPopup();
        document.getElementById("manage-tag").appendChild(mainContent);
        $('#back-tag').show();

        let tagList = getTagsData().sort();
        $('#content-input-tag').autocomplete({
            source: tagList
        });

        $("#title-manage-tag").find('span').html('Add Tag');
    })

    div.append(table);
    div.append(button);

    return div;
}

//render edited-delete content popup
function generateInputEdit(task, tag) {
    const div = generateDiv('input-edit-tag');
    const input_tag = document.createElement("INPUT");
    input_tag.setAttribute("type", "text");
    input_tag.setAttribute("class", "content-input-tag");
    input_tag.setAttribute("id", "content-input-tag");

    const valueDiv = generateDiv('value-edit-tag');

    const span = document.createElement('span');

    if (task === 'delete') {
        valueDiv.setAttribute("style", "display: flex;flex-direction: column;");
        valueDiv.innerHTML = 'Delete this tag will also remove it from the following test cases. Are you sure you want to proceed?'

        span.textContent = tag;
    } else {
        const errorValue = generateDiv('error-tag', 'icons/error.svg');
        errorValue.setAttribute("style", "display:none; align-self: normal;");

        const errorSpan = document.createElement('span');
        errorSpan.setAttribute("style", "font-family: Roboto; font-style: normal; font-weight: normal; font-size: 14px; color: #B41400; padding: 0 2px;")
        errorValue.appendChild(errorSpan);

        if (task === 'edit') {
            input_tag.value = tag;
            input_tag.addEventListener("keypress", function(e) {
                if (e.which == 13 || e.keyCode == 13) {
                    let inputVal = $('#content-input-tag').val();
                    $('#value-edit-tag').show();
                    $('#value-edit-tag').find('span').html(inputVal);
                    $('#content-input-tag').hide();
                }
            })
        }
        valueDiv.setAttribute("style", "display:none;");

        div.appendChild(input_tag);
        div.appendChild(errorValue);
    }

    valueDiv.appendChild(span);

    div.appendChild(valueDiv);

    return div;
}

function generateTestcaseList(task, testcases) {
    const div = generateDiv('div-table-tag');

    const span = document.createElement('span');
    span.textContent = 'This tag is used in';

    const ul = document.createElement('ul');
    ul.setAttribute("class", "table-dynamic");
    ul.setAttribute("id", "table-dynamic");

    for (const testcase of testcases) {
        const item_div = document.createElement('li');

        const span = document.createElement('span');
        span.innerHTML = testcase.name;

        item_div.appendChild(span);

        ul.appendChild(item_div);
    }
    div.appendChild(span);
    div.appendChild(ul);

    return div;

}

function generateTestSuiteTreeview(tag) {
    const div = generateDiv('div-table-tag');

    const span = document.createElement('span');
    span.textContent = 'This tag is used in';

    const ul = document.createElement('ul');
    ul.setAttribute("class", "treeview-testsuite");
    ul.setAttribute("id", "treeview-testsuite");

    for (const testSuite of getAllTestSuites()) {
        const item_div = document.createElement('li');

        const div = generateDiv('list-checkbox-tag');

        //open and close child element of test suite
        const dropdown = generateDiv('dropdown', '/katalon/images/SVG/dropdown-arrow-on.svg');
        dropdown.setAttribute("data-dropdown", "open");
        dropdown.addEventListener("click", function(event) {
            if (dropdown.dataset.dropdown === 'open') {
                dropdown.dataset.dropdown = 'close';
                dropdown.childNodes[0].src = '/katalon/images/SVG/dropdown-arrow-off.svg';
                $(`*[data-item=${testSuite.id}]`).hide();
            } else {
                dropdown.dataset.dropdown = 'open';
                dropdown.childNodes[0].src = '/katalon/images/SVG/dropdown-arrow-on.svg';
                $(`*[data-item=${testSuite.id}]`).show();
            }
        })

        //checkbox for testsuite
        const input_tag = document.createElement("INPUT");
        input_tag.setAttribute("type", "checkbox");
        input_tag.value = testSuite.id;
        input_tag.addEventListener("change", function(event) {
            if (event.currentTarget.checked) {
                $(`*[data-item=${testSuite.id}]`).find('input').prop('checked', true);
            } else {
                $(`*[data-item=${testSuite.id}]`).find('input').prop('checked', false);
            }
        })

        const label = document.createElement("Label");
        label.setAttribute("for", testSuite.id);
        label.innerHTML = testSuite.name;

        div.appendChild(dropdown);
        div.appendChild(input_tag);
        div.appendChild(label);

        item_div.appendChild(div);

        let checkedTag = 0;

        //render checkbox of child testsuite
        for (const testcase of testSuite.testCases) {
            const div_item = generateDiv('item-checkbox-tag');
            div_item.setAttribute("data-item", testSuite.id);

            const item_input = document.createElement("INPUT");
            item_input.setAttribute("type", "checkbox");
            item_input.value = testcase.id;

            const item_lable = document.createElement("Label");
            item_lable.setAttribute("for", testSuite.id);
            item_lable.innerHTML = testcase.name;

            const item_img = document.createElement("img");
            item_img.setAttribute("for", testSuite.id);
            item_img.setAttribute("style", "margin-left: 10px;");

            if (testcase.tags.length > 0) {
                if (testcase.tags.some(e => e === tag)) {
                    item_input.checked = true;
                }
                item_img.src = "icons/show-tag.svg";
                checkedTag++;
            }

            div_item.appendChild(item_input);
            div_item.appendChild(item_lable);
            div_item.appendChild(item_img);
            item_div.appendChild(div_item);
        }

        if (checkedTag === testSuite.testCases.length) {
            input_tag.checked = true;
        }

        ul.appendChild(item_div);
    }
    div.appendChild(span);
    div.appendChild(ul);

    return div;
}

function renderIconTaggingForTestcase(testcase) {
    if (testcase.tags.length > 0) {
        const iconTag = document.getElementById("tags-icon-" + testcase.id);
        iconTag.setAttribute("style", "visibility: visible;");
        iconTag.getElementsByTagName('img')[0].src = "/panel/icons/show-tag.svg";
    } else {
        const iconTag = document.getElementById("tags-icon-" + testcase.id);
        iconTag.removeAttribute("style");
        iconTag.getElementsByTagName('img')[0].src = "/panel/icons/tags.svg";
    }
}

function editTagWithTreeview(inputVal) {
    let checkedList = $('.item-checkbox-tag').find('input:checked');
    let uncheckedList = $('.item-checkbox-tag').find('input:not(:checked)');

    //edit testcase has new tag
    if (checkedList.length > 0) {
        for (let index = 0; index < checkedList.length; index++) {
            const element = checkedList[index];
            const foundTestcase = findTestCaseById($(element).val());

            if ((foundTestcase.tags.length > 0 && foundTestcase.tags.every(e => e !== inputVal)) || foundTestcase.tags.length <= 0) {
                foundTestcase.tags.push(inputVal);
                $(`#${$(element).val()}`).attr("data-tags", foundTestcase.tags.toString());
            }

            renderIconTaggingForTestcase(foundTestcase);

        }
    }

    //remove testcase 
    if (uncheckedList.length > 0) {
        for (let index = 0; index < uncheckedList.length; index++) {
            const element = uncheckedList[index];
            const foundTestcase = findTestCaseById($(element).val());
            foundTestcase.tags = foundTestcase.tags.filter(e => e !== inputVal);
            $(`#${$(element).val()}`).attr("data-tags", foundTestcase.tags.toString());

            renderIconTaggingForTestcase(foundTestcase);
        }
    }

    //format dialog
    if ($('#content-add-tag').length > 0) {
        $('#content-add-tag').remove();
    }

    if ($('#content-edit-tag').length > 0) {
        $('#content-edit-tag').remove();
    }

    const mainContent = generateContenPopup();
    document.getElementById("manage-tag").appendChild(mainContent);
    $('#back-tag').hide();

    $("#title-manage-tag").find('span').html('Tags Management');
}

function generateButtonTag(task, tag) {
    const div = generateDiv('button-tag-popup');

    const cancelButton = document.createElement("BUTTON");
    cancelButton.setAttribute("id", "content-button-delete");
    cancelButton.setAttribute("style", "background: #EEEEF0;");
    cancelButton.innerHTML = "Cancel";
    cancelButton.addEventListener("click", function(event) {
        if ($('#content-delete-tag').length > 0) {
            $('#content-delete-tag').remove();
        }

        if ($('#content-edit-tag').length > 0) {
            $('#content-edit-tag').remove();
        }

        if ($('#content-add-tag').length > 0) {
            $('#content-add-tag').remove();
        }
        const mainContent = generateContenPopup();
        document.getElementById("manage-tag").appendChild(mainContent);
        $('#back-tag').hide();

        $("#title-manage-tag").find('span').html('Tags Management');
    });

    const updateButton = document.createElement("BUTTON");
    updateButton.setAttribute("id", "content-button-update");

    if (task === 'delete') {
        updateButton.setAttribute("style", "background: #E11900;color: #FFFFFF;");
        updateButton.innerHTML = "Delete";
    } else {
        updateButton.setAttribute("style", "background: #276EF1;color: #FFFFFF;");
        updateButton.innerHTML = "Save";
    }

    updateButton.addEventListener("click", function(event) {
        switch ($('#content-button-update').text()) {
            case 'Save':
                {
                    let inputVal = $('#content-input-tag').val();
                    //warning error
                    if (!inputVal) {
                        if (!$('#error-tag').is(':visible')) {
                            $('#error-tag').find('span').html("This field is required");
                            $('#error-tag').show();
                        }
                    } else {
                        if (tag) { //edit tag with new value input
                            if (tag.tag !== inputVal && getTagsData().includes(inputVal)) {
                                if (!$('#error-tag').is(':visible')) {
                                    $('#error-tag').find('span').html("This tag already exsists");
                                    $('#error-tag').show();
                                }
                            } else {
                                tag.testcases.forEach(element => {
                                    let foundTestcase = findTestCaseById(element.id);
                                    if (foundTestcase.tags.every(e => e !== inputVal)) {
                                        let indexTag = foundTestcase.tags.indexOf(tag.tag);
                                        foundTestcase.tags[indexTag] = inputVal;
                                    }
                                    $(`#${element.id}`).attr("data-tags", foundTestcase.tags.toString());
                                });

                                editTagWithTreeview(inputVal);

                                trackingEditTagFromMangagement();
                            }
                        } else { //add tag to testcases
                            if (getTagsData().includes(inputVal)) {
                                if (!$('#error-tag').is(':visible')) {
                                    $('#error-tag').find('span').html("This tag already exsists");
                                    $('#error-tag').show();
                                }
                            } else {
                                editTagWithTreeview(inputVal);
                                trackingAddTagFromMangagement();
                            }
                        }
                    }
                    break;
                }
            case 'Delete':
                {
                    tag.testcases.forEach(element => {
                        const foundTestcase = findTestCaseById(element.id);
                        foundTestcase.tags = foundTestcase.tags.filter(e => e !== tag.tag);
                        $(`#${element.id}`).attr("data-tags", foundTestcase.tags.toString());

                        renderIconTaggingForTestcase(foundTestcase);
                    });

                    trackingRemoveTagFromMangagement();

                    $('#content-delete-tag').remove();
                    const mainContent = generateContenPopup();
                    document.getElementById("manage-tag").appendChild(mainContent);
                    $('#back-tag').hide();
                    break;
                }
            default:
                break;
        }
    });

    div.appendChild(cancelButton);
    div.appendChild(updateButton);

    return div;
}

//render edit content popup
function generateContentEditPopup(tag) {
    const div = generateDiv('content-edit-tag');

    const input = generateInputEdit('edit', tag.tag);
    const table = generateTestSuiteTreeview(tag.tag);
    const button = generateButtonTag('edit', tag);

    div.appendChild(input);
    div.appendChild(table);
    div.appendChild(button);

    return div;
}

//render deleted content popup
function generateContentDeletePopup(tag) {
    const div = generateDiv('content-delete-tag');

    const input = generateInputEdit('delete', tag.tag);
    const table = generateTestcaseList('delete', tag.testcases);
    const button = generateButtonTag('delete', tag);

    div.appendChild(input);
    div.appendChild(table);
    div.appendChild(button);

    return div;
}

//render added content popup
function generateContentAddPopup() {
    const div = generateDiv('content-add-tag');

    const input = generateInputEdit('add');
    const table = generateTestSuiteTreeview();
    const button = generateButtonTag('add');

    div.appendChild(input);
    div.appendChild(table);
    div.appendChild(button);

    return div;
}

const generateAuditTagsPopup = () => {
    const div = document.createElement("div");
    div.setAttribute("class", "manage-tag");
    div.setAttribute("id", "manage-tag");

    const title = generateTitle();
    const content = generateContenPopup();

    div.appendChild(title);
    div.append(content);

    return div;
}

export { generateAuditTagsPopup }