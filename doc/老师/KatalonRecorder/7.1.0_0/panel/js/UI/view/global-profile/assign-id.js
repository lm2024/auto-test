import { getVariablesArray } from "./get-variables-array.js";

/**
 * assign the id and order number for variable rows on profile-grid
 * @param {number} start - the index of first variable to start assigning
 * @param {number} end - the index of last variable
 * @returns {Promise<void>}
 */
const assignId = async (start, end) => {
  const variableArray = await getVariablesArray();
  if (start > variableArray.length){
    return;
  }
  if (end > variableArray.length) {
    end = variableArray.length;
  }
  for (let i = start; i < end; i++) {
    //assign id
    variableArray[i].id = `variable-${i}`;
    //assign index
    //variableArray[i].childNodes[0].innerHTML = i + 1;
  }
}

export { assignId }