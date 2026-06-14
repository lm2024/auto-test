import { setSelectedVariable } from "./selected-variable.js";
import { findProfileByID } from "../../services/global-profile-service/profile-data-service.js";
import { getSelectedProfile } from "./selected-profile.js";

let firstSelectedTrIndex = undefined;

async function clickHandler(event){
  let rowElement = event.target;
  while (!rowElement.id.includes("variable")){
    rowElement = rowElement.parentNode;
  }
  //element has format "variable-{index}"
  const index = parseInt(rowElement.id.substring(9));
  const selectedProfile = await findProfileByID(getSelectedProfile().id);
  const variable = await selectedProfile.getVariableByIndex(index);
  $("#profile-variable-name").val(variable.name);
  $("#profile-variable-value").val(variable.value);

  if (firstSelectedTrIndex === undefined && $("#profile-grid .selected").length > 0) {
    firstSelectedTrIndex = parseInt($("#profile-grid .selected")[0].id.substring(9));
  }

  if (!event.ctrlKey && !event.shiftKey && !event.metaKey) {
    $('#profile-grid .selected').removeClass('selected');
    firstSelectedTrIndex = undefined;
  }

  if (event.shiftKey) {
    if (firstSelectedTrIndex !== undefined) {
      $('#profile-grid .selected').removeClass('selected');
      if (firstSelectedTrIndex < index) {
        for (let i = firstSelectedTrIndex; i < index; i++) {
          $("#variable-" + i).addClass("selected");
        }

      } else {
        for (let i = firstSelectedTrIndex; i > index; i--) {
          $("#variable-" + i).addClass("selected");
        }
      }
    }
  }

  if (event.ctrlKey || event.metaKey ) {
    $(this).addClass("selected");
  }
  $(this).addClass('selected');
}

/**
 * render a new variable rows on profile-grid at an index
 * @param {string} name - variable's name
 * @param {string} value - variable's value
 * @param {number} index - the index at which the new row will be inserted to
 * @returns {Promise<void>}
 */
const addVariable = async ({name = "", value = "", index= 0}) => {
  const profileGrid = document.getElementById("profile-grid");
  const row = document.createElement("tr");
  const nameCell  = document.createElement("td");
  nameCell.innerHTML = name;
  const valueCell = document.createElement("td");
  valueCell.innerHTML = value;
  row.appendChild(nameCell);
  row.appendChild(valueCell);
  row.addEventListener("click", clickHandler);
  if (index === -1){
    $(profileGrid).append(row);
  } else {
    $($(profileGrid).children()[index]).after(row);
  }
}

/**
 * render a new variable rows at the end of profile-grid
 * @param {string} name - variable's name
 * @param {string} value - variable's value
 * @returns {Promise<void>}
 */
const appendVariable = async (name = "", value = "") => {
  await addVariable({name, value, index: -1});
}

export { addVariable, appendVariable }