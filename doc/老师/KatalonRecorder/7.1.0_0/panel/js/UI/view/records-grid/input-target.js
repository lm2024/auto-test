import { generateDropdownCommandToolbarCommand } from "../../services/records-grid-service/command-generators.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { modifyCaseSuite } from "../../view/records-grid/modify-case-suite.js";
import { getSelectedRecord } from "../../view/records-grid/selected-records.js";
import { getSelectedCase } from "../../view/testcase-grid/selected-case.js";
import { getTargetDatalist, getTdRealValueNode, getTdShowValueNode } from "./record-utils.js";

import { saveWhenInsideInput } from "./input-command.js";

let timeout = null;

function changeTdOfTable(event, isSaved) {
    let temp, value;
    if (event.target) {
        temp = $(event.target).parents('tr').attr('id');
        value = event.target.value;
    } else {
        temp = $(event).parents('tr').attr('id');
        value = $(event).val();
    }

    if (temp) {
        var div = getTdRealValueNode(document.getElementById(temp), 2);
        // Check hidden value and target value
        if (!(div.childNodes[0] && div.childNodes[0].textContent.includes("d-XPath") && value.includes("tac"))) {
            var real_command_target = value;
            if (real_command_target == "auto-located-by-tac") {
                // Real tac value is hidden
                var real_tac = getTargetDatalist(document.getElementById(temp)).options[0].text;
                if (real_tac == "") real_tac = "auto-located-by-tac";
                real_command_target = real_tac;
            }
            if (div.childNodes && div.childNodes[0]) {
                div.removeChild(div.childNodes[0]);
            }
            div.appendChild(document.createTextNode(real_command_target));

            var command_target = value;
            div = getTdShowValueNode(document.getElementById(temp), 2);
            /* KAT-BEGIN remove tac
            if (command_target.includes("tac")) {
                command_target = "auto-located-by-tac";
            }
            KAT-END */
            if (div.childNodes && div.childNodes[1]) {
                div.removeChild(div.childNodes[1]);
            }
            div.appendChild(document.createTextNode(command_target));
        }
        modifyCaseSuite();

        if (isSaved) {
            //need a time out here to make sure user finnish typing before sava new target to in-memory object
            clearTimeout(timeout);
            // store command to in-memory data object
            const s_case = getSelectedCase();
            if (s_case) {
                const testCaseID = s_case.id;
                const testCase = findTestCaseById(testCaseID);
                //record index start with 1
                const commandIndex = parseInt(temp.substring(8)) - 1;
                const testCommand = testCase.commands[commandIndex];

                testCommand.defaultTarget = value;
                if (!testCommand.targets.includes(value)) {
                    testCommand.targets.push(value);

                    //add to datalist on record-grid
                    let datalist = getTargetDatalist(document.getElementById(temp));

                    let option = document.createElement('option');
                    option.innerText = value;
                    datalist.appendChild(option);

                    //add to data list on command target
                    let targetDropdown = $('#' + temp).find("#target-dropdown");
                    let optionDrop = document.createElement('option');
                    optionDrop.innerText = value;
                    optionDrop.value = value;
                    targetDropdown.append(optionDrop);
                }
                modifyCaseSuite();
            }
        }
    }
}

function removeInputTarget() {
    if ($('#records-grid').find('#command-target').length > 0) {
        const foundInput = $('#records-grid').find('#command-target');
        changeTdOfTable(foundInput, true);
        foundInput.remove();
        $('#records-grid .target-dropdown:visible').hide();
        $('#records-grid .ctm-target-btn:visible').hide();
    }
}

function dropdownTarget(node) {
    let $target = $(node);

    if ($target.find('#target-dropdown').is(':visible')) {
        $target.find('#target-dropdown').hide();
    }

    const htmlCommand = `<div id="target-dropdown" class="w3-dropdown-content w3-bar-block target-dropdown"></div>`;

    if ($target.find('#target-dropdown').length == 0) {
        $target.append(htmlCommand)
    }

    let $dropdownTarget = $target.find('#target-dropdown');

    //add to data list on command target
    const s_case = getSelectedCase();
    if (s_case) {
        const testCaseID = s_case.id;
        const testCase = findTestCaseById(testCaseID);
        //record index start with 1
        const commandIndex = parseInt($target.parents('tr').attr('id').substring(8)) - 1;
        const testCommand = testCase.commands[commandIndex];
        let datalist = $target.find('datalist')[0];
        $(datalist).empty();
        $dropdownTarget.empty();

        if (testCommand) {
            for (const element of testCommand.targets) {
                if (element) {
                    let optionData = document.createElement('option');
                    optionData.innerText = element;
                    datalist.appendChild(optionData);

                    let option = document.createElement('option');
                    option.innerText = element;
                    option.value = element;
                    $dropdownTarget.append(option);
                }
            }
        }

    }
}

function inputTarget(node) {
    removeInputTarget();

    if ($(node).find('#command-target').length > 0) {
        $(node).text($(node).find('#command-target').val());
        $(node).find('#command-target').remove();
        $(node).find('.ctm-target-btn').hide();
    }
    node.childNodes[1].innerText = '';

    let $target = $(node);
    //interactive input
    const input = document.createElement("INPUT");
    input.id = "command-target";
    input.type = "text";
    input.setAttribute("class", "command-target");
    generateDropdownCommandToolbarCommand().execute();

    const img = document.createElement("img");
    img.id = "action1";
    img.src = "icons/close-command.svg";

    node.childNodes[1].append(input);
    node.childNodes[1].append(img);

    //load value to input
    const $inputTarger = $target.find("#command-target");
    $inputTarger.css({
        'font': '13px Roboto',
        'height': '25px',
        'padding-left': '5px',
        'width': '96%',
        'border-radius': '5px'
    });

    $inputTarger.val($target.children().eq(0).text());
    $inputTarger.focus();

    // $inputTarger.on("input", function(event) { changeTdOfTable(event, false) });

    $inputTarger.on('keyup', function (event) {
        event.preventDefault();
        $target.find('.ctm-target-btn').hide();
        if (event.which == 13 || event.keyCode == 13) {
            changeTdOfTable(event, true);
            $(this).remove();
            $target.find('#target-dropdown').hide();
        }
    });

    $inputTarger.dblclick(function (event) {
        event.preventDefault();
        this.select();
    })

    // $inputTarger.on("focusin", function () {
    //     let ID = getSelectedRecord();
    //     $(this).data('oldVal', $(this).val());
    //     $(this).data();
    //     $(this).data('ID', ID);
    // }).on("focusout", function () {
    //     let oldValue = $(this).data("oldVal");
    //     if (oldValue !== $(this).val()) {
    //         const index = parseInt($(this).parents('tr').attr('id').substring(8)) - 1;
    //         generateEditTargetToolbarCommand(index, oldValue).execute();
    //     }
    // })
    $inputTarger.on("keydown", saveWhenInsideInput);

    $inputTarger.contextmenu(function (event) {
        event.preventDefault();
        event.stopPropagation();

        if ($target.find('#target-dropdown').is(':visible')) {
            $target.find('#target-dropdown').hide();
        }

        $target.find('.ctm-target-btn').css({
            top: $(this).position().top + 30,
            left: $(this).position().left + 30,
        });
        $target.find('.ctm-target-btn').show();
        return false;
    });

    //interact dropdown target
    let $dropdownTarget = $target.find('#target-dropdown');
    $target.find('#action1').click(function () {
        if ($target.find('.ctm-target-btn').is(':visible')) {
            $target.find('.ctm-target-btn').hide();
        }
        if ($dropdownTarget.is(':visible')) {
            $dropdownTarget.hide();
        } else {
            $dropdownTarget.css({
                'top': $(this).position().top + 45,
                'width': $inputTarger.width() + 20
            })
            $dropdownTarget.show();
        }
    });

    $dropdownTarget.click(function (e) {
        let option = e.target;
        if (option.nodeName === "OPTION") {
            $inputTarger.val(option.value);
            $dropdownTarget.hide();
            $inputTarger.focus();
        }
    });
}

export {
    inputTarget,
    removeInputTarget,
    dropdownTarget
}