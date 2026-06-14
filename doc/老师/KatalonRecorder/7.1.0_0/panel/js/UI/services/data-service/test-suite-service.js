import { TestSuite } from "../../models/test-model/test-suite.js";


/**
 * delete all TestSuite in in-memory data object and return the deleted TestCase object
 */
function deleteAllTestSuite() {
    return KRData.removeAllTestSuites();
}

/**
 * delete TestSuite in in-memory data object and return the deleted TestCase object
 * @param {string} testSuiteID - TestSuite's id
 * @returns {TestSuite} - delete TestCase object
 */
function deleteTestSuite(testSuiteID) {
    if (testSuiteID === undefined || testSuiteID === null) {
        throw "Null or undefined testSuiteID"
    }
    return KRData.removeTestSuite(testSuiteID);

}

/**
 * create a new TestSuite object and save it into in-memory data object
 * @param {string} title - TestSuite's name
 * @returns {TestSuite}
 */
const createTestSuite = (title = "Untitled Test Suite", status) => {
    title = title !== null ? title : "Untitled Test Suite";
    status = status !== undefined ? status : "normal";
    const testSuite = new TestSuite(title, status);
    KRData.testSuites.push(testSuite);
    return testSuite;
}


/**
 * add new TestSuite object to in-memory data object
 * @param {TestSuite} testSuite
 * @returns {string} sideex-id go with that TestSuite
 */
const addTestSuite = (testSuite) => {
    if (testSuite === undefined || testSuite === null) {
        throw "Null or undefined test suite";
    }
    KRData.testSuites.push(testSuite);
}

const getTestSuiteCount = () => {
    return KRData.getTestSuiteCount();
}

const getTextSuiteByIndex = (index) => {
    return KRData.testSuites[index];
}

const findTestSuiteById = (testSuiteID) => {
    return KRData.testSuites.find(testSuite => testSuite.id === testSuiteID);
}

const getAllTestSuites = () => {
    return KRData.testSuites.filter(e => e.status !== 'dynamic');
}

const getAllDynamicTestSuites = () => {
    return KRData.testSuites.filter(e => e.status === 'dynamic');
}

const getTagsData = () => {
    let tags = [];
    for (const testSuite of KRData.testSuites) {
        if (testSuite.status !== 'dynamic') {
            testSuite.testCases.find(e => {
                if (e.tags && e.tags.length > 0) {
                    tags.push(e.tags);
                }
            });
        }
    }

    tags = tags.flat(1);
    if(tags.length > 0){
        tags = tags.filter(e => e !== "");
    }
    
    return [...new Set(tags)];
}

const getAllTestCases = () => {
    let testCases = [];
    for (const testSuite of KRData.testSuites) {
        if (testSuite.status !== 'dynamic') {
            testSuite.testCases.find(e => {
                e.testSuiteName = testSuite.name;
                testCases.push(e);
            });
        }
    }
    testCases = testCases.flat(1);
    return testCases;
}

const auditTags = () => {
    let tags = getTagsData();
    let testcaseList = getAllTestCases();
    let auditTag = [];

    auditTag = tags.map(element => {
        let testcases = testcaseList.filter(e => e.tags && e.tags.includes(element));
        return {
            tag: element,
            testcases: testcases
        }
    })

    return auditTag;
}

const findTestSuiteIndexByID = (testSuiteID) => {
    return KRData.testSuites.findIndex(testSuite => testSuite.id === testSuiteID);
}

const insertNewTestSuiteAtIndex = (index, testSuite) => {
    KRData.testSuites.splice(index, 0, testSuite);
}

export {
    createTestSuite,
    deleteTestSuite,
    addTestSuite,
    getTestSuiteCount,
    getTextSuiteByIndex,
    findTestSuiteById,
    getAllTestSuites,
    getTagsData,
    getAllTestCases,
    auditTags,
    findTestSuiteIndexByID,
    insertNewTestSuiteAtIndex,
    deleteAllTestSuite,
    getAllDynamicTestSuites
}