import { AsyncCommand } from "../../models/command/async-command.js";
import { addVariableAction, copyVariableAction, deleteVariableAction, pasteVariableAction } from "./actions.js";

const generateAddVariableCommand = () => new AsyncCommand(addVariableAction);
const generateDeleteVariableCommand = () => new AsyncCommand(deleteVariableAction);
const generateCopyVariableCommand = () => new AsyncCommand(copyVariableAction);
const generatePasteVariableCommand = () => new AsyncCommand(pasteVariableAction);

export {
  generateCopyVariableCommand,
  generateAddVariableCommand,
  generateDeleteVariableCommand,
  generatePasteVariableCommand
}