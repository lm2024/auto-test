import { generateUUID } from "../../services/helper-service/utils.js";

/**
 * Class represent a execution profile that currently loaded when KR is running
 */
class Profile {
  /**
   * Create a Profile
   * @param {string} [id=random UUID]
   * @param {string} [title=""]
   * @param {ProfileVariable[]} [variables=[]]
   * @param {boolean} [isDefault=false]
   */
  constructor(id = generateUUID(), title = "", variables = [], isDefault = false) {
    this.id = id;
    this.title = title;
    this.variables = variables;
    this.isDefault = isDefault;
  }

  /**
   * Remove a variable at index
   * @param {number} index
   * @returns {Promise<ProfileVariable[]>}
   */
  async removeVariable(index) {
    return this.variables.splice(index, 1);
  }

  /**
   * insert a ProfileVariable to Profile at index
   * if index is not provided the variable will be inserted at the head
   * @param {ProfileVariable} variable
   * @param {number} [index=0]
   * @returns {Promise<void>}
   */
  async insertNewVariable(variable, index = 0) {
    this.variables.splice(index, 0, variable);
  }

  /**
   * find a variable by name
   * @param {string} variableName
   * @returns {Promise<ProfileVariable>}
   */
  async findVariableByName(variableName) {
    return this.variables.find(variable => variable.name === variableName);
  }

  /**
   * get variable by index
   * @param {number} index
   * @returns {Promise<ProfileVariable>}
   */
  async getVariableByIndex(index) {
    return this.variables[index];
  }

  /**
   * return how many variables are inside this profile
   * @returns {Promise<number>}
   */
  async countVariables() {
    return this.variables.length;
  }

  /**
   * Check if there is 2 variables with the same name inside this profile
   * @returns {Promise<boolean>}
   */
  async isContainDuplicated() {
    return this.variables.some(
      (item, index) => this.variables.findIndex(comparedItem => comparedItem.name === item.name) !== index);
  }

  /**
   * Check if this profile already contains any variable with this name
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async isVariableNameExist(name){
    return this.variables.some(variable => variable.name === name);
  }

  /**
   * Find variable index in Profile by its name
   * @param name
   * @returns {Promise<number>}
   */
  async findIndexByName(name){
    return this.variables.findIndex(variable => variable.name === name);
  }
}


export { Profile }
