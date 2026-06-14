import { unmarshall } from "../helper-service/parser.js";

/**
 * read HTML file and parse it to model object
 * @param file - File object represent HTML KR save files
 * @returns {Promise<TestSuite>}
 */
const loadHTMLFile = (file) => {
    return new Promise((resolve, reject) => {
        if ((!file.name.includes(".krecorder") && !file.name.includes(".html")) && file.type !== "application/json") reject("Wrong file format");

        const reader = new FileReader();
        reader.readAsText(file);

        reader.onload = function() {
            let testSuiteHTMLString = reader.result;
            //testSuiteHTMLString = testSuiteHTMLString.split("\n").map(line => line.trim()).join("");
            let suiteName;
            if (file.name.lastIndexOf(".") >= 0) {
                suiteName = file.name.substring(0, file.name.lastIndexOf("."));
            } else {
                suiteName = file.name;
            }
            try {
                if (file.name.includes(".htm") || file.name.includes(".krecorder")) {
                    const testSuite = unmarshall(suiteName, testSuiteHTMLString);
                    resolve(testSuite);
                }
                if (file.name.includes(".json") && file.type === "application/json") {
                    const testSuite = JSON.parse(testSuiteHTMLString);
                    resolve(testSuite);
                }
            } catch (error) {
                reject(error);
            }

        };
        reader.onerror = function(e) {
            console.log("Error", e);
        };
    });
}

export { loadHTMLFile }