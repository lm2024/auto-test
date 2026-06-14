import { Menu } from "../../models/menu/menu.js";
import { MenuItem } from "../../models/menu/menu-item.js";
import {
  generateCopyVariableCommand,
  generatePasteVariableCommand
} from "../../services/global-profile-service/command-generator.js";

const copyVariableItem = new MenuItem("grid-copy-variable",
  `Copy variable <span class="hotKey">Ctrl+C</span>`,
  generateCopyVariableCommand);

const pasteVariableItem = new MenuItem("grid-paste-variable",
  `Paste variable <span class="hotKey">Ctrl+V</span>`,
  generatePasteVariableCommand);


const variableGridMenu = new Menu("variable-grid-menu");
variableGridMenu.add(copyVariableItem);
variableGridMenu.add(pasteVariableItem);

export { variableGridMenu }
