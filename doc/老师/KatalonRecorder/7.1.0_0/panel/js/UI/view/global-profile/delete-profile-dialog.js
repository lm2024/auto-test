import { GenericDialog } from "../dialog/generic-dialog.js";
import { getAllTestCases, getAllTestSuites } from "../../services/data-service/test-suite-service.js";
import { assignId } from "./assign-id.js";
import { addDirtyMark } from "./dirty-mark.js";

class DeleteProfileDialog extends GenericDialog {
    constructor(profile, variableIndex, variableElement) {
        const variableName = profile.variables[variableIndex].name;
        const html = `
            <div>Delete this global variable will also remove it from the following test cases. Are you sure you want to proceed?</div>
            <div>Global variable</div>
            <div>${variableName}</div>
            <div>This global variable is used in</div>
            <div id="delete-profile-test-case-list"></div>
        `
        super({
            id: "delete-profile-dialog",
            title: "Delete global variable",
            buttons: [
                {
                    id: "delete-profile-dialog-cancel",
                    text: "Cancel"
                },
                {
                    id: "delete-profile-dialog-delete",
                    text: "Delete"
                }
            ],
            message: html,
            width: 400,
            height: 416,

        });
        this.index = variableIndex;
        this.variableName = variableName;
        this.profile = profile;
        this.element = variableElement;
    }

    attachEvent(resolve) {
        $("#delete-profile-dialog-delete").click(async () => {
            await this.profile.removeVariable(this.index);
            $(this.element).remove();
            await assignId(0, await this.profile.countVariables());
            addDirtyMark(this.profile.id);
            this.close();
            resolve();
        });
        $("#delete-profile-dialog-cancel").click(() => {
            this.close();
            resolve();
        })
    }

    async render() {
        return new Promise(async resolve => {
            await super.render();
            this.attachEvent(resolve);
            const testCases = getAllTestCases();
            const containGlobalVariableTestCases = [];
            for (const testCase of testCases) {
                for (const command of testCase.commands) {
                    if (command.value.includes(`\${GlobalVariable.${this.variableName}`)) {
                        containGlobalVariableTestCases.push(testCase);
                        break;
                    }
                }
            }
            const container = $("#delete-profile-test-case-list");
            for (const testCase of containGlobalVariableTestCases) {
                const div = document.createElement("div");
                div.innerHTML = testCase.name;
                container.append(div);
            }
        })

    }
}

export { DeleteProfileDialog }