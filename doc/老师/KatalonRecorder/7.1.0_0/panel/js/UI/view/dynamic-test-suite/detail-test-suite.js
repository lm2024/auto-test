import { getAllTestCases, findTestSuiteById } from "../../services/data-service/test-suite-service.js";

let testCaseList, testSuiteId;

const generateItemTagWithoutButton = (val) => {
    const box_item = document.createElement("div");
    box_item.setAttribute("class", "box-item-dynamic");
    box_item.innerHTML = val;

    box_item.addEventListener("click", function(e) {
        this.setAttribute("style", "background: #A3CDFF;");
        let inputValue;
        if ($('#quick-actions').is(":visible")) {
            inputValue = $('#quick-actions').find("#input-dynamic").find("input").val();
        } else {
            inputValue = $("#input-dynamic").find("input").val();
        }
        if (inputValue && !inputValue.includes(this.innerHTML)) {
            inputValue += "," + this.innerHTML;
        } else {
            inputValue = this.innerHTML;
        }

        if ($('#quick-actions').is(":visible")) {
            $('#quick-actions').find("#input-dynamic").find("input").val(inputValue);
        } else {
            $("#input-dynamic").find("input").val(inputValue);
        }
    });

    return box_item;
}

function renderTable(inputValue) {
    let ul;
    if (inputValue) {
        ul = createTableDynamicTestSuite(inputValue);
    } else {
        testCaseList = getAllTestCases();
        ul = createTableDynamicTestSuite();
    }

    if ($('#quick-actions').is(":visible")) {
        if ($('#quick-actions').find('#table-dynamic').length > 0) {
            $('#quick-actions').find('#table-dynamic').remove();
        }
        document.getElementById('quick-actions').insertBefore(ul, document.getElementById('quick-actions').children[1]);
    } else {
        if ($('#table-dynamic').length > 0) {
            $('#table-dynamic').remove();
        }
        document.getElementById('detail-dynamic').appendChild(ul);
    }
}

function generateFilterTags(query, title) {
    const div = document.createElement("div");
    div.setAttribute("class", "input-dynamic");
    div.setAttribute("id", "input-dynamic");

    let taggedTestCases;
    const span_title = document.createElement("span");
    span_title.setAttribute("style", "font-family: Roboto;font-style: normal;font-weight: bold;font-size: 20px;line-height: 28px;");
    if (title) {
        taggedTestCases = $(`[data-tags*=${query}]`).length;
        span_title.textContent = `${title} (${taggedTestCases} items)`;

        const button_remove = document.createElement("img");
        button_remove.src = 'icons/remove.svg';
        button_remove.setAttribute("style", "float: right; padding-top: 10px;");

        button_remove.addEventListener("click", function() {
            if ($('#quick-actions').is(":visible")) {
                $('#quick-actions').remove();
            }
        })

        span_title.appendChild(button_remove);
    } else {
        span_title.textContent = 'Dynamic Test Suite';
    }

    //label
    const span = document.createElement("span");
    span.textContent = 'Tags';
    span.setAttribute("style", "font-family: Roboto;font-style: normal;font-weight: bold;font-size: 12px;line-height: 16px;");

    //div of input
    const div_input = document.createElement("div");
    div_input.setAttribute("style", "display: flex;flex-direction: row; position: relative;");

    const input = document.createElement("input");
    input.setAttribute("type", "text");
    input.placeholder = "Example:tag1,tag2,tag3";

    if (query) {
        input.value = query;
    }

    //input apply query when focus input
    input.addEventListener("keypress", function(e) {
        if (e.which == 13 || e.keyCode == 13) {
            renderTable(this.value);
        }

        if (title) {
          taggedTestCases = $('#quick-actions .table-dynamic li').length;
          span_title.textContent = `${title} (${taggedTestCases} items)`;
        }
    }, false);

    //remove all value
    const xicon_input = document.createElement("img");
    xicon_input.setAttribute("src", "icons/x_icon.svg");
    xicon_input.setAttribute("style", "position: absolute;margin: 10px;right: 68px;cursor: pointer");
    xicon_input.addEventListener("click", function(e) {
        let inputValue;
        if ($('#quick-actions').is(":visible")) {
            inputValue = $('#quick-actions').find("#input-dynamic").find("input");
        } else {
            inputValue = $("#input-dynamic").find("input");
        }
        inputValue.val("");
        inputValue.focus();
    })

    //button apply query
    const button_input = document.createElement("div");
    button_input.innerHTML = "Apply";
    button_input.setAttribute("style", "cursor: pointer;background: #F0F1F2;border-radius: 4px;padding: 10px 15px;margin: 0px 5px;font-weight: 500;")
    button_input.addEventListener("click", function(e) {
        let inputValue;
        if ($('#quick-actions').is(":visible")) {
            inputValue = $('#quick-actions').find("#input-dynamic").find("input").val();
        } else {
            inputValue = $("#input-dynamic").find("input").val();
        }
        renderTable(inputValue);

        if (title) {
          taggedTestCases = $('#quick-actions .table-dynamic li').length;
          span_title.textContent = `${title} (${taggedTestCases} items)`;
        }
    }, false);

    div_input.appendChild(input);
    div_input.appendChild(xicon_input);
    div_input.appendChild(button_input);


    div.appendChild(span_title);
    div.appendChild(span);
    div.appendChild(div_input);

    return div;
}

function createTableDynamicTestSuite(query) {
    let filterMap;
    let testSuite = findTestSuiteById(testSuiteId);

    if (query) {
        let filterString = query;
        filterString = /,\s/.test(filterString) ? filterString.replace(/,\s/g, ',') : filterString;
        filterMap = filterString.indexOf(',') > -1 ? filterString.split(',') : [filterString];
        filterMap = filterMap.filter(e => e !== "");

        let testCasefilter = [];
        if (filterMap.length > 0) {
            testCasefilter = getAllTestCases().map(item => {
                if (filterMap.some(x => item.tags.includes(x))) {
                    return item;
                }
            }).filter(e => e !== undefined);
        } else {
            testCasefilter = getAllTestCases();
        }
        testCaseList = testCasefilter;
        if (testSuite) {
            testSuite.query = query;
            testSuite.testCases = testCaseList;
        }
    }

    const ul = generateTableDynamicTestSuite(filterMap);

    return ul;
}

function generateTableDynamicTestSuite(tags) {
    const ul = document.createElement('ul');
    ul.setAttribute("class", "table-dynamic");
    ul.setAttribute("id", "table-dynamic");

    for (const testCase of testCaseList) {
        const item_div = document.createElement('li');
        item_div.setAttribute("id", "li-" + testCase.id);

        const imgState = document.createElement('img');
        imgState.setAttribute("id", "img-" + testCase.id);

        const span = document.createElement('span');
        span.textContent = `${testCase.testSuiteName} - ${testCase.name}`;

        const div = document.createElement('div');
        div.setAttribute("id", "button-tags");
        div.setAttribute("class", "button-tags");

        if (testCase.tags && testCase.tags.length > 0) {
            for (const tag of testCase.tags) {
                if (tag !== "") {
                    const item_tags = generateItemTagWithoutButton(tag);
                    if (tags && tags.includes(tag)) {
                        item_tags.setAttribute("style", "background: #FFF0BD;");
                    }
                    div.appendChild(item_tags);
                }
            }
        } else {
            item_div.setAttribute("style", "padding: 15px 12px;");
        }

        item_div.appendChild(imgState);
        item_div.appendChild(span);
        item_div.appendChild(div);

        // item_div.addEventListener("click", function() {
        //     console.log(this.getAttribute("style"));
        //     this.setAttribute("style", "background: #c9cbcd;")
        //     let id = this.id.replace('li-', '');
        //     setSelectedCase(id);
        // })

        ul.appendChild(item_div);
    }
    return ul;
}

const generateDetailDynamicTestSuite = (id) => {
    testSuiteId = id;
    testCaseList = getAllTestCases();
    const div = document.createElement("div");
    div.setAttribute("class", "detail-dynamic");
    div.setAttribute("id", "detail-dynamic");

    let testSuite = findTestSuiteById(testSuiteId);

    let filter, table;
    if (testSuite.status === "dynamic" && testSuite.query) {
        filter = generateFilterTags(testSuite.query);
        table = createTableDynamicTestSuite(testSuite.query);
    } else {
        filter = generateFilterTags();
        table = createTableDynamicTestSuite();
    }

    div.appendChild(filter);
    div.append(table);

    return div;
}

export { generateDetailDynamicTestSuite, generateItemTagWithoutButton, createTableDynamicTestSuite, generateFilterTags }