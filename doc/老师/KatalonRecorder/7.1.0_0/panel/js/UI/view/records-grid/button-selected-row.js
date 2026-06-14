import {
    generateAddCommand,
    generateCopyCommand,
    generateDeleteSelectedCommand,
    generatePasteCommand,
    generateRedoCommand,
    generateUndoCommand,
    generateAddValuesToDefaultProfileACommand
} from "../../services/records-grid-service/command-generators.js";
import {
    trackingAddTestStep,
    trackingDeleteTestStep,
    trackingCopyTestStep,
    trackingPasteTestStep,
} from "../../services/tracking-service/segment-tracking-service.js";

let isUI = false;

function deleteBtn(i) {
    //add btn delete
    const div = document.createElement('div');
    div.id = 'grid-delete-btn' + i;
    div.setAttribute("class", "grid-delete-btn tooltips");
    div.setAttribute("tooltip", "Delete");

    div.addEventListener('click', function(event) {
        const deleteSelected = generateDeleteSelectedCommand();
        deleteSelected.execute();
        trackingDeleteTestStep('UI');
        isUI = true;
    });

    div.addEventListener('mouseover', function(event) {
        $('.selectedRecord').addClass('removeRecord');
    });

    div.addEventListener('mouseout', function(event) {
        $('.selectedRecord').removeClass('removeRecord');
    });

    const delBtn = document.createElement('img');
    delBtn.src = 'icons/delete-tag.svg';
    div.appendChild(delBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function addBtn(i) {
    //add btn add
    const div = document.createElement('div');
    div.id = 'grid-add-btn' + i;
    div.setAttribute("class", "grid-add-btn tooltips");
    div.setAttribute("tooltip", "Add");

    div.addEventListener('click', function(event) {
        const addCommand = generateAddCommand();
        addCommand.execute();
        trackingAddTestStep('UI');
        isUI = true;
        $('#grid-add-btn').hide();
    });

    const addBtn = document.createElement('img');
    addBtn.src = 'icons/add-icon.svg';
    div.appendChild(addBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function copyBtn(i) {
    const div = document.createElement('div');
    div.id = 'grid-copy-btn' + i;
    div.setAttribute("class", "grid-copy-btn tooltips");
    div.setAttribute("tooltip", "Copy");

    div.addEventListener('click', function(event) {
        const copyCommand = generateCopyCommand();
        copyCommand.execute();
        trackingCopyTestStep('UI');
        isUI = true;
    });

    const copyBtn = document.createElement('img');
    copyBtn.src = 'icons/copy.svg';
    div.appendChild(copyBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function cutBtn(i) {
    const div = document.createElement('div');
    div.id = 'grid-cut-btn' + i;
    div.setAttribute("class", "grid-cut-btn tooltips");
    div.setAttribute("tooltip", "Cut");

    div.addEventListener('click', function(event) {
        const copyCommand = generateCopyCommand();
        copyCommand.execute();
        let deleteSelectedCommand = generateDeleteSelectedCommand();
        deleteSelectedCommand.execute();
        trackingCopyTestStep('UI');
        isUI = true;
    });

    const cutBtn = document.createElement('img');
    cutBtn.src = 'icons/cut.svg';
    div.appendChild(cutBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function pasteBtn(i) {
    const div = document.createElement('div');
    div.id = 'grid-paste-btn' + i;
    div.setAttribute("class", "grid-paste-btn tooltips");
    div.setAttribute("tooltip", "Paste");

    div.addEventListener('click', function(event) {
        const pasteCommand = generatePasteCommand();
        pasteCommand.execute();
        trackingPasteTestStep('UI');
        isUI = true;
    });

    const pasteBtn = document.createElement('img');
    pasteBtn.src = 'icons/paste.svg';
    div.appendChild(pasteBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function undoBtn(i) {
    const div = document.createElement('div');
    div.id = 'grid-undo-btn' + i;
    div.setAttribute("class", "grid-undo-btn tooltips");
    div.setAttribute("tooltip", "Undo");

    div.addEventListener('click', function(event) {
        const undoCommand = generateUndoCommand();
        undoCommand.execute();
    });

    const undoBtn = document.createElement('img');
    undoBtn.src = '/katalon/images/SVG/new-undo-arrow.svg';
    div.appendChild(undoBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function redoBtn(i) {
    const div = document.createElement('div');
    div.id = 'grid-redo-btn' + i;
    div.setAttribute("class", "grid-redo-btn tooltips");
    div.setAttribute("tooltip", "Redo");

    div.addEventListener('click', function(event) {
        const redoCommand = generateRedoCommand();
        redoCommand.execute();
    });

    const redoBtn = document.createElement('img');
    redoBtn.src = '/katalon/images/SVG/new-redo-arrow.svg';
    div.appendChild(redoBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function globalVarBtn(i) {
    const div = document.createElement('div');
    div.id = 'grid-add-global-variable-btn' + i;
    div.setAttribute("class", "grid-add-global-variable-btn");

    div.addEventListener('click', function(event) {
        const command = generateAddValuesToDefaultProfileACommand();
        command.execute();
    });

    const globalVarBtn = document.createElement('img');
    globalVarBtn.src = '/katalon/images/SVG/add-to-default-profile-icon.svg';
    div.appendChild(globalVarBtn);

    const span = document.createElement('span');
    div.appendChild(span);

    return div;
}

function toolbarBtn(i) {
    const div = document.createElement('div');
    div.id = 'toolbar-btn' + i;
    div.setAttribute('class', 'toolbar-btn');
    div.style = 'display:none;'

    const divAdd = addBtn(i);
    const copy = copyBtn(i);
    const cut = cutBtn(i);
    const paste = pasteBtn(i);
    const undo = undoBtn(i);
    const redo = redoBtn(i);
    const divDelete = deleteBtn(i);
    // const globalVar = globalVarBtn(i);

    div.appendChild(divAdd);
    div.appendChild(copy);
    div.appendChild(cut);
    div.appendChild(paste);
    div.appendChild(undo);
    div.appendChild(redo);
    div.appendChild(divDelete);

    return div;
}

export {
    toolbarBtn
}