import { findProfileByID } from "../../services/global-profile-service/profile-data-service.js";
import { getSelectedProfile } from "../../view/global-profile/selected-profile.js";
import { assignId } from "../../view/global-profile/assign-id.js";
import { renderProfileSectionStructure } from "../../view/global-profile/render-profile-section-structure.js";
import { getSelectedVariable } from "../../view/global-profile/selected-variable.js";
import { addDirtyMark } from "../../view/global-profile/dirty-mark.js";
import { GenericDialog } from "../../view/dialog/generic-dialog.js";
import {
    generateAddVariableCommand,
    generateCopyVariableCommand,
    generateDeleteVariableCommand,
    generatePasteVariableCommand
} from "../../services/global-profile-service/command-generator.js";
import { addHotKeysHandler } from "./hotkeys-command.js";

async function updateHandler() {
    const selectedProfile = await findProfileByID(getSelectedProfile().id);
    await assignId(0, await selectedProfile.countVariables());
}


async function handlerFunction() {
    await renderProfileSectionStructure();

    $("#profile-variable-grid").sortable({
        axis: "y",
        items: "tr",
        scroll: true,
        revert: 200,
        scrollSensitivity: 20,
        connectWith: "#records-grid",
        helper: function(e, tr) {
            const $originals = tr.children();
            const $helper = tr.clone();
            $helper.children().each(function(index) {
                $(this).width($originals.eq(index).width());
            });
            return $helper;
        },
        update: function(event, ui) {
            //the update property is not working with async function
            updateHandler();
        },
    });

    $("#variable-delete-btn").click(async() => {
        await generateDeleteVariableCommand().execute();
    });

    $("#variable-add-btn").click(async() => {
        await generateAddVariableCommand().execute();
    });

    $("#variable-copy-btn").click(async() => {
        await generateCopyVariableCommand().execute();
    });

    $("#variable-paste-btn").click(async() => {
        await generatePasteVariableCommand().execute();
    });


    $("#profile-variable-name").on("keyup", async function(event) {
        const selectedVariable = getSelectedVariable();
        const inputValue = event.target.value;
        if (selectedVariable) {
            const selectedProfile = await findProfileByID(getSelectedProfile().id);
            //the id has format "variables-{index}"
            const index = parseInt(selectedVariable.id.substring(9));
            selectedVariable.childNodes[0].innerHTML = inputValue;
            selectedProfile.variables[index].name = inputValue;
            addDirtyMark(selectedProfile.id);
        }
    });

    $("#profile-variable-value").on("input", async function(event) {
        const selectedVariable = getSelectedVariable();
        const inputValue = event.target.value;
        if (selectedVariable) {
            selectedVariable.childNodes[1].innerHTML = inputValue;
            const selectedProfile = await findProfileByID(getSelectedProfile().id);
            //the id has format "variables-{index}"
            const index = parseInt(selectedVariable.id.substring(9));
            selectedProfile.variables[index].value = inputValue;
            addDirtyMark(selectedProfile.id);
        }
    });

    addHotKeysHandler();
}

$(document).ready(function() {
    //ready() does not work with async function
    handlerFunction();
})