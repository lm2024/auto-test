/**
 * Class represents test command  that currently loaded when KR is running
 */
class TestCommand {
    /**
     * Create a TestCommand
     *
     * @param {string} name
     * @param {string} defaultTarget
     * @param {string[]} targets
     * @param {string} value
     */
    constructor(name = "", defaultTarget = "", targets = [], value = "") {
        this.name = name;
        this.defaultTarget = defaultTarget;
        this.targets = targets;
        this.value = value;
        this.status = null;
        this.state = null;
    }

    setTestCommand(command) {
        let keys = ['name', 'defaultTarget', 'targets', 'value', 'status', 'state'];
        let newCommand = new TestCommand();

        for (const key of keys) {
            if (command[key]) {
                newCommand[key] = command[key];
            }
        }
        return newCommand;
    }
}

export { TestCommand }