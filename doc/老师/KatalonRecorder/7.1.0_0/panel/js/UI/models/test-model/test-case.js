import { generateUUID } from "../../services/helper-service/utils.js";

/**
 * Class represent test case that currently loaded when KR is running
 */
class TestCase {
    /**
     * Create a TestCase
     * TestCase's id will be an UUID string
     * @param {string} name - Test case name
     * @param {TestCommand[]} commands - List of commands belonging to test case
     * @param {tags[]} tags - List of tags belonging to test case
     */
    constructor(name = "", commands = [], tags = []) {
        this.id = generateUUID();
        this.name = name;
        this.commands = commands;
        this.tags = tags;
    }

    /***
     *
     * @returns {number}
     */
    getTestCommandCount() {
        return this.commands.length;
    }

    insertCommandToIndex(index, testCommand) {
        this.commands.splice(index, 0, testCommand);
    }

    removeCommandAtIndex(index) {
        return this.commands.splice(index, 1)[0];
    }

    setTestCase(testcase) {
        let keys = ['name', 'commands', 'tags'];
        let testCase = new TestCase();

        for (const key of keys) {
            if (testcase[key]) {
                testCase[key] = testcase[key];
            }
        }
        return testCase;
    }
}

export { TestCase }