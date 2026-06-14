import { generateUUID } from "../../services/helper-service/utils.js";

/**
 * Class represent test suite that currently loaded when KR is running
 */
class TestSuite {
    /**
     * Create a TestSuite
     * TestSuite's id will be an UUID string
     * @param {string} name - TestSuite's name
     * @param {string} status - TestSuite's status
     * @param {TestCase[]} testCases - List of TestCase objects belonging to test case
     */
    constructor(name = "", status = "", testCases = [], query = "") {
        if (testCases === undefined) {
            testCases = [];
        }
        this.id = generateUUID();
        this.name = name;
        this.status = status;
        this.testCases = testCases;
        this.query = query;
    }

    getTestCaseCount() {
        return this.testCases.length;
    }

    findTestCaseIndexByID(testCaseID) {
        return this.testCases.findIndex(testCase => testCase.id === testCaseID);
    }

    insertNewTestCase(index, testCase) {
        this.testCases.splice(index, 0, testCase);
    }

    setTestSuite(testsuite) {
        let keys = ['name', 'status', 'testCases', 'query'];
        let testSuite = new TestSuite();

        for (const key of keys) {
            if (testsuite[key]) {
                testSuite[key] = testsuite[key];
            }
        }
        return testSuite;
    }

}

export { TestSuite }