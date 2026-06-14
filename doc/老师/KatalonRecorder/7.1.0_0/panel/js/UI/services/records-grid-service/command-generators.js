import { commandHistory } from "./command-history.js";
import { UndoCommand } from "../../models/command/undo-command.js";
import { RedoCommand } from "../../models/command/redo-command.js";
import { ReversibleCommandDecorator } from "../../models/command/reversible-command-decorator.js";
import { Command } from "../../models/command/command.js";
import {
    addAction, addValuesToDefaultProfileAction,
    changeCommandTargetAction,
    copyAction,
    deleteAllAction,
    deleteSelectedAction,
    pasteAction,
    playCommandAction,
    playFromHereAction,
    playToHereAction,
    selectAllAction,
    setBreakpointAction,
    recordFromHereAction
} from "./actions.js";
import {
    extractInformationFromRecordGrid,
    extractRecordGridWhenEditCommandToolBar,
    restoreRecords
} from "./state-actions.js"

const generateAddCommand = () => new ReversibleCommandDecorator(
    new Command(addAction),
    commandHistory,
    () => { return extractInformationFromRecordGrid('add') },
    restoreRecords);
const generateDeleteAllCommand = () => new ReversibleCommandDecorator(
    new Command(deleteAllAction),
    commandHistory,
    () => { return extractInformationFromRecordGrid('delete') },
    restoreRecords);
const generateCopyCommand = () => new Command(copyAction);
const generatePasteCommand = () => new ReversibleCommandDecorator(
    new Command(pasteAction),
    commandHistory,
    () => { return extractInformationFromRecordGrid('paste') },
    restoreRecords);
const generateSetBreakpointCommand = () => new ReversibleCommandDecorator(
    new Command(setBreakpointAction),
    commandHistory,
    () => { return extractInformationFromRecordGrid('breakpoint') },
    restoreRecords);
const generateDeleteSelectedCommand = () => new ReversibleCommandDecorator(
    new Command(deleteSelectedAction),
    commandHistory,
    () => { return extractInformationFromRecordGrid('delSelected') },
    restoreRecords);
const generateUndoCommand = () => new UndoCommand(commandHistory);
const generateRedoCommand = () => new RedoCommand(commandHistory);


const generatePlayFromHereCommand = (index) => {
    return () => new Command(playFromHereAction, index);
}
const generatePlaySpecificRecordCommand = (index) => {
    return () => new Command(playCommandAction, index);
}

const generatePlayToHereCommand = () => {
    return () => new Command(playToHereAction);
}

const generateRecordFromHereCommand = () => {
    return () => new Command(recordFromHereAction);
}

const generateSelectAllCommand = () => new Command(selectAllAction);

const generateEditCommandToolbarCommand = (commandToolbarID) => {
    return new ReversibleCommandDecorator(
        new Command(_ => { }),
        commandHistory,
        () => {
            return extractRecordGridWhenEditCommandToolBar(commandToolbarID);
        },
        restoreRecords
    );
}

const generateEditTargetToolbarCommand = (index, oldValue) => {
    return new ReversibleCommandDecorator(
        new Command(changeCommandTargetAction, index, oldValue),
        commandHistory,
        () => {
            return extractRecordGridWhenEditCommandToolBar("command-target");
        },
        restoreRecords
    );
}

const generateDropdownCommandToolbarCommand = () => {
    return new ReversibleCommandDecorator(
        new Command(() => { }),
        commandHistory,
        () => { return extractInformationFromRecordGrid('edit') },
        restoreRecords
    );
}

const generateDragAndDropCommand = () => {
    return new ReversibleCommandDecorator(
        new Command(_ => { }),
        commandHistory,
        () => { return extractInformationFromRecordGrid('dragdrop') },
        restoreRecords);
}

const generateAddValuesToDefaultProfileACommand = () => {
    return new ReversibleCommandDecorator(
        new Command(addValuesToDefaultProfileAction),
        commandHistory,
        () => { return extractInformationFromRecordGrid('valueProfile') },
        restoreRecords);
}

export {
    generateAddCommand,
    generateDeleteAllCommand,
    generateCopyCommand,
    generatePasteCommand,
    generateSetBreakpointCommand,
    generateDeleteSelectedCommand,
    generatePlayFromHereCommand,
    generatePlayToHereCommand,
    generatePlaySpecificRecordCommand,
    generateUndoCommand,
    generateRedoCommand,
    generateSelectAllCommand,
    generateEditCommandToolbarCommand,
    generateDropdownCommandToolbarCommand,
    generateDragAndDropCommand,
    generateEditTargetToolbarCommand,
    generateAddValuesToDefaultProfileACommand,
    generateRecordFromHereCommand
}