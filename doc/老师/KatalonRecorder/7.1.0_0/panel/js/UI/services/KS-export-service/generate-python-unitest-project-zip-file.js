import {findTestCaseById} from "../data-service/test-case-service.js";
import {generateExportedScript} from "./generate-exported-script.js";
import {findTestSuiteById} from "../data-service/test-suite-service.js";


async function generateRequirementTxt(zipFile) {
    const contain = `selenium==3.141.0
urllib3==1.26.7`;
    zipFile.file("requirements.txt", contain);
}

async function mappingTestSuiteToNewName(testSuites) {
    const testSuiteNames = new Map();
    const testSuiteObj = {};
    for (const testSuite of testSuites) {
        let testSuiteName = testClassName(testSuite.name);
        const nameNum = testSuiteNames.get(testSuiteName)
        if (nameNum) {
            testSuiteNames.set(testSuiteName, nameNum + 1)
            testSuiteName += `${nameNum}`;
        } else {
            testSuiteNames.set(testSuiteName, 1);
        }
        testSuiteObj[testSuite.id] = testSuiteName;
    }
    return testSuiteObj;
}


async function mappingTestCaseToNewName(testCases) {
    const testCaseNames = new Map();
    const testCaseObj = {};
    for (const testCase of testCases) {
        let testCaseName = testClassName(testCase.name);
        const nameNum = testCaseNames.get(testCaseName)
        if (nameNum) {
            testCaseNames.set(testCaseName, nameNum + 1)
            testCaseName += `${nameNum}`;
        } else {
            testCaseNames.set(testCaseName, 1);
        }
        testCaseObj[testCase.id] = testCaseName;
    }
    return testCaseObj;
}

const generatePythonUnittestProjectZipFile = async (userChoice, projectTitle) => {
    const zipFile = new JSZip();
    await generateRequirementTxt(zipFile);
    const testSuites = userChoice.testSuites.map(testSuite => findTestSuiteById(testSuite.id));
    const testSuiteNameMapping = await mappingTestSuiteToNewName(testSuites);
    for (const testSuite of userChoice.testSuites) {
        const testSuiteFolder = zipFile.folder(testSuiteNameMapping[testSuite.id]);
        const testCases = testSuite.testCases.map(testCase => findTestCaseById(testCase.id));
        const testCaseNameMapping = await mappingTestCaseToNewName(testCases);
        for (const testCase of testCases) {
            let script = await generateExportedScript(testCase);
            const originalClassName = testClassName(testCase.name);
            script = script.replace(`class ${originalClassName}`, `class ${testCaseNameMapping[testCase.id]}`);
            testSuiteFolder.file(`${testCaseNameMapping[testCase.id]}.py`, script);
        }
    }

    return zipFile;
}

export {generatePythonUnittestProjectZipFile}