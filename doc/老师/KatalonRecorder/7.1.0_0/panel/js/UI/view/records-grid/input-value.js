import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { modifyCaseSuite } from "./modify-case-suite.js";
import { getSelectedRecord } from "./selected-records.js";
import { getSelectedCase } from "../testcase-grid/selected-case.js";
import { getTargetDatalist, getTdRealValueNode, getTdShowValueNode } from "./record-utils.js";
// import {
//     appendAddVariableButton,
//     appendValueContextMenu,
//     removeAddVariableButton,
//     removeValueContextMenu
// } from "./global-profile-context-menu.js";
import { addProfileLinkForCommandValue } from "./global-profile-link-for-command-value.js";
import { generateDropdownCommandToolbarCommand } from "../../services/records-grid-service/command-generators.js";
import { saveWhenInsideInput } from "./input-command.js";

async function changeTdOfTable(event) {
    let temp, value;
    if (event.target) {
        temp = $(event.target).parents('tr').attr('id');
        value = event.target.value;
    } else {
        temp = $(event).parents('tr').attr('id');
        value = $(event).val();
    }

    if (temp) {
        var div = getTdRealValueNode(document.getElementById(temp), 3);
        // set innerHTML = ""
        if (div.childNodes && div.childNodes[0]) {
            div.removeChild(div.childNodes[0]);
        }
        div.appendChild(document.createTextNode(value));

        var command_value = value;
        div = getTdShowValueNode(document.getElementById(temp), 3);
        if (div.childNodes && div.childNodes[0]) {
            div.removeChild(div.childNodes[0]);
        }
        $(div).prepend(document.createTextNode(command_value));

        const s_case = getSelectedCase();
        if (s_case) {
            const testCaseID = s_case.id;
            const testCase = findTestCaseById(testCaseID);
            //record index start with 1
            const commandIndex = parseInt(temp.substring(8)) - 1;
            const testCommand = testCase.commands[commandIndex];
            testCommand.value = value;
            modifyCaseSuite();
        }
        await addProfileLinkForCommandValue(document.getElementById(temp));
    }
}

function removeInputValue() {
    if ($('#records-grid').find('#command-value').length > 0) {
        const foundInput = $('#records-grid').find('#command-value');
        changeTdOfTable(foundInput);
        foundInput.remove();
        $('#records-grid .ctm-value-btn:visible').hide();
    }
}

function inputValue(node) {
    //remove all #command-value exists
    removeInputValue();

    if ($(node).find('#command-value').length > 0) {
        $(node).text($(node).find('#command-value').val());
        $(node).find('#command-value').remove();
    }
    node.childNodes[1].innerText = '';

    //init textarea
    const textarea = document.createElement('TEXTAREA');
    textarea.id = "command-value";
    textarea.setAttribute("class", "command-value");
    textarea.style = "width: 93%;font-family: 'Roboto', sans-serif;font-size: 12px;"
    textarea.rows = 6;
    textarea.placeholder = "Shift + Enter for a new line";

    generateDropdownCommandToolbarCommand().execute();
    node.childNodes[1].prepend(textarea);

    const $inputValue = $(node).find('#command-value');
    $inputValue.val(node.firstChild.innerText);
    $inputValue.focus();

    // $inputValue.on("input", changeTdOfTable);

    $inputValue.on('keyup', function (event) {
        event.preventDefault();
        $(node).find('.ctm-value-btn').hide();
        if ((event.shiftKey && event.keyCode == 13) || (event.shiftKey && event.which == 13)) {
            event.stopPropagation();
        } else if (event.which == 13 || event.keyCode == 13) {
            changeTdOfTable(event);
            $(this).remove();
            $('.toolbar-value-btn').hide();
        }
    });

    $inputValue.keypress(function (event) {
        if (event.which == 13 && !event.shiftKey) {
            event.preventDefault();
        }
    });

    $inputValue.on("keydown", saveWhenInsideInput);

    $inputValue.contextmenu(function (event) {
        event.preventDefault();
        event.stopPropagation();

        $(node).find('.ctm-value-btn').css({
            top: $(this).position().top + 90,
            left: $(this).position().left + 30,
        });
        $(node).find('.ctm-value-btn').show();
        return false;
    });
}

export {
    inputValue,
    removeInputValue
}