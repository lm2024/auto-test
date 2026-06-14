import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { modifyCaseSuite } from "./modify-case-suite.js";
import { getSelectedRecord } from "./selected-records.js";
import { getSelectedCase } from "../testcase-grid/selected-case.js";

import { generateDropdownCommandToolbarCommand } from "../../services/records-grid-service/command-generators.js";
import { resetFocus } from "../../services/records-grid-service/state-actions.js";
import { removeDirtyMarks } from "../testcase-grid/remove-dirty-mark.js";
import { saveData } from "../../services/data-service/save-data.js";

function changeTdOfTable(event) {
    let temp, value;
    if (event.target) {
        temp = $(event.target).parents('tr').attr('id');
        value = event.target.value;
    } else {
        temp = $(event).parents('tr').attr('id');
        value = $(event).val();
    }

    if (temp) {
        var div = getTdRealValueNode(document.getElementById(temp), 1);
        // set innerHTML = ""
        if (div.childNodes && div.childNodes[0]) {
            div.removeChild(div.childNodes[0]);
        }
        div.appendChild(document.createTextNode(value));

        var command_command = value;
        div = getTdShowValueNode(document.getElementById(temp), 1);
        if (div.childNodes && div.childNodes[1]) {
            div.removeChild(div.childNodes[1]);
        }
        div.appendChild(document.createTextNode(command_command));

        // store command to in-memory data object
        const s_case = getSelectedCase();
        if (s_case) {
            const testCaseID = s_case.id;
            const testCase = findTestCaseById(testCaseID);
            //record index start with 1
            const commandIndex = parseInt(temp.substring(8)) - 1;
            const testCommand = testCase.commands[commandIndex];
            testCommand.name = value;
            modifyCaseSuite();
        }
    }
}

function saveWhenInsideInput(event) {
    //capture Ctrl+S when inside input
    let keyNum;
    if (window.event) { // IE
        keyNum = event.keyCode;
    } else if (event.which) { // Netscape/Firefox/Opera
        keyNum = event.which;
    }
    if (event.ctrlKey || event.metaKey) {
        if (keyNum === 83 || keyNum === 229) {
            //disable browser default Ctrl + S event handler
            event.preventDefault();
            event.stopPropagation();
            const element = event.target;
            $(element).blur();
            saveData();
            removeDirtyMarks();
            resetFocus();
        }
    }
}

function removeInputCommand() {
    if ($('#records-grid').find('#command-command').length > 0) {
        const foundInput = $('#records-grid').find('#command-command');
        changeTdOfTable(foundInput);
        foundInput.remove();
        $('#records-grid .ctm-command-btn:visible').hide();
    }
}

function inputCommand(node) {
    const supportedCommand = _loadSeleniumCommands();

    removeInputCommand();

    if ($(node).find('#command-command').length > 0) {
        $(node).text($(node).find('#command-command').val());
        $(node).find('#command-command').remove();
    }
    node.childNodes[1].innerText = '';

    const $target = $(node);

    const input = document.createElement("INPUT");
    input.id = "command-command";
    input.type = "text";
    input.setAttribute("class", "command-command");
    generateDropdownCommandToolbarCommand().execute();

    node.childNodes[1].prepend(input);

    //interactive input
    const inputCommand = $target.find("#command-command");
    inputCommand.css({
        'font': '13px Roboto',
        'height': '25px',
        'padding-left': '5px',
        'width': '94%'
    });

    inputCommand.autocomplete({
        minLength: 0,
        source: supportedCommand,
        select: function (event, ui) {
            event.stopPropagation();
            $(this).parents('#dropdown-command').show();
            $(this).val(ui.item.value);
        }
    });

    inputCommand.val($target.children().eq(0).text());
    inputCommand.focus();

    inputCommand.on('keyup', function (event) {
        event.preventDefault();
        $target.find('.ctm-command-btn').hide();
        if (event.which == 13 || event.keyCode == 13) {
            changeTdOfTable(event);
            $(this).remove();
            $('.toolbar-command-btn').hide();
        }
    });

    inputCommand.dblclick(function (event) {
        event.preventDefault();
        this.select();
    })

    inputCommand.on("keydown", saveWhenInsideInput);

    inputCommand.contextmenu(function (event) {
        event.preventDefault();
        event.stopPropagation();

        $target.find('.ctm-command-btn').css({
            top: $(this).position().top + 30,
            left: $(this).position().left + 30,
        });
        $target.find('.ctm-command-btn').show();
        return false;
    });
}

export {
    inputCommand,
    saveWhenInsideInput,
    removeInputCommand
}