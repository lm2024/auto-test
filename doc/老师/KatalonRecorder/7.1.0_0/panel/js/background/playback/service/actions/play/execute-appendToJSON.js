import { convertToCSV } from "../../utils/convert-to-CSV.js";
import { parseData } from "../../../../../UI/services/data-file-service/data-file-services.js";
import { convertVariableToString } from "./play-actions.js";


/***
 * check whether the input String "fileName" is a valid JSON file name
 *
 * @param {String} fileName
 * @returns {{result: boolean, errorMessage: string}}
 */
function validateJSONFileName(fileName){
    const regex = new RegExp("^[\\w,\\s-]+\\.[A-Za-z]{4}");
    if (!regex.test(fileName)) {
        return {
            result: false,
            errorMessage: "Invalid file name!"
        }
    }
    const tokens = fileName.split(".");
    const fileType = tokens[tokens.length - 1];
    if (fileType !== "json") {
        return {
            result: false,
            errorMessage: "Invalid file type! Data file must be a JSON file"
        }
    }
    return { result: true, errorMessage: "" }
}

/**
 * append the list of values to the end of data files
 * the number of values must match the number of column in data file
 * @param {String} fileName
 * @param {String[]} values
 * @returns {{result: boolean, errorMessage: string}}
 */
function appendDataFile(fileName, values) {
    let fileData = window.dataFiles[fileName];
    //data does not guarantee to have attribute data
    if (fileData.data === undefined) {
        parseData(fileName);
    }
    let headers;
    if (fileData.data.length === 0) {
        return {
            result: false,
            errorMessage: "Cannot append to an empty JSON file",
        }
    } else {
        if (Object.keys(fileData.data[0]).length !== values.length) {
            return {
                result: false,
                errorMessage: "The amount of data miss match the amount of column in data file"
            }
        }
        headers = Object.keys(fileData.data[0]);
    }

    let newData = Object.fromEntries(headers.map((_, i) => [headers[i], values[i]]));
    fileData.data.push(newData);
    fileData.content = JSON.stringify(fileData.data);
    return { result: true, errorMessage: "" }
}


/**
 * append the value to an existed data file.
 *
 * @param {String} fileName
 * @param {String} value - The value to be appended
 * @returns {{success: boolean, errorMessage: string}}
 */
const executeAppendToJSON = (fileName, value) => {
    let validateResult = validateJSONFileName(fileName);
    if (validateResult.result !== true || window.dataFiles[fileName] === undefined) {
        return {
            success: false,
            errorMessage: validateResult.errorMessage
        }
    }
    let values = value.split(',').map(value => {
        if (value.indexOf("${") !== -1) {
            return convertVariableToString(value);
        }
        return value
    });
    let result = appendDataFile(fileName, values);
    if (result.result === true) return { success: true, errorMessage: "" };
    return {
        success: false,
        errorMessage: result.errorMessage
    }

}

export { executeAppendToJSON }