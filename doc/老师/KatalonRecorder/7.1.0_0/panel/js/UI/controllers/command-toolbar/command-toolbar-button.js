import {
    generateAddCommand,
    generateAddValuesToDefaultProfileACommand,
    generateCopyCommand,
    generateDeleteSelectedCommand,
    generatePasteCommand,
    generateRedoCommand,
    generateUndoCommand
} from "../../services/records-grid-service/command-generators.js";


$(function() {
    $('.record-bottom').click(() => {
        const addCommand = generateAddCommand();
        addCommand.execute();
    });
    // $('#grid-add-btn').on('click', function(event) {
    //     const addCommand = generateAddCommand();
    //     addCommand.execute();
    // });

    // $('#grid-delete-btn').on('click', function(event) {
    //     const deleteSelected = generateDeleteSelectedCommand();
    //     deleteSelected.execute();
    // });

    // $('#grid-copy-btn').on('click', function(event) {
    //     const copyCommand = generateCopyCommand();
    //     copyCommand.execute();
    // });

    // $('#grid-paste-btn').on('click', function(event) {
    //     const pasteCommand = generatePasteCommand();
    //     pasteCommand.execute();
    // });

    // $('#grid-undo-btn').on('click', function(event) {
    //     const undoCommand = generateUndoCommand();
    //     undoCommand.execute();
    // });

    // $('#grid-redo-btn').on('click', function(event) {
    //     const redoCommand = generateRedoCommand();
    //     redoCommand.execute();
    // });

    // $('#grid-add-global-variable-btn').on('click', function(event) {
    //     const command = generateAddValuesToDefaultProfileACommand();
    //     command.execute();
    // })
});