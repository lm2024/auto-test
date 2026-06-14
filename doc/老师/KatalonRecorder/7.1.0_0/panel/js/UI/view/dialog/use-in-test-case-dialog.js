import { WizardDialog } from "./wizard-dialog.js";
import { getAllTestSuites } from "../../services/data-service/test-suite-service.js";
import { findTestCaseById } from "../../services/data-service/test-case-service.js";
import { parseData } from "../../services/data-file-service/data-file-services.js";
import { TestCommand } from "../../models/test-model/test-command.js";
import { renderTestCaseToRecordGrid } from "../records-grid/render-test-case-to-record-grid.js";
import { NotificationDialog } from "./notification-dialog.js";
import { trackingSegment } from "../../services/tracking-service/segment-tracking-service.js";

class WizardDialogMediator{
    constructor() {
    }

    setWizardDialogScreens(wizardDialogScreens){
        this.wizardDialogScreens = wizardDialogScreens;
        for (let i = 1; i <= Object.keys(wizardDialogScreens).length; i++){
            const key = Object.keys(wizardDialogScreens)[i-1];
            const wizardDialogScreen = wizardDialogScreens[key];
            wizardDialogScreen.pageNum = i;
            wizardDialogScreen.pageTotal = Object.keys(wizardDialogScreens).length;
        }
    }

    invokeNext(sender){
        switch (sender.id){
            case "data-files-use-in-test-case-dialog-1":
                const nextScreen = this.wizardDialogScreens["data-files-use-in-test-case-dialog-2"];
                nextScreen.testCaseID = sender.testCaseID;
                nextScreen.render();
                break;
            case "data-files-use-in-test-case-dialog-2":
                break;
        }
    }

    invokeBack(sender){
        switch (sender){
            case "data-files-use-in-test-case-dialog-1":
                break;
            case "data-files-use-in-test-case-dialog-2":
                const nextScreen = this.wizardDialogScreens["data-files-use-in-test-case-dialog-1"];
                nextScreen.render();
        }
    }

    invokeCancel(sender){
        switch (sender.id){
            case "data-files-use-in-test-case-dialog-1":
                break;
            case "data-files-use-in-test-case-dialog-2":
                const testCase = findTestCaseById(sender.testCaseID);
                for (const index of Object.keys(sender.changedValue)){
                    testCase.commands[index].value = sender.changedValue[index];
                }
                testCase.commands.unshift(new TestCommand(
                    "loadVars", sender.dataFileName, [sender.dataFileName], ""
                ));
                testCase.commands.push(new TestCommand("endLoadVars"));
                renderTestCaseToRecordGrid(testCase);
                trackingSegment("kru_use_test_data_in_test_case", {
                   "test_case_name": sender.testCaseID,
                    "test_data_name": sender.dataFileName,
                    "no_variables_mapped": Object.keys(sender.changedValue).length
                });
                new NotificationDialog({
                    message: `<img src="/katalon/images/SVG/green-check-circle.svg" alt="success-icon" style="margin-right: 10px"/> Add test data to test case successfully!`,
                    duration: 2000,
                }).display();
        }
    }
}

class UseInTestCaseFirstDialog extends WizardDialog{
    constructor(mediator) {
        super({});
        this.id = "data-files-use-in-test-case-dialog-1";
        this.contentHtml = this._generateContent();
        this.dialogClass = "useInTestCase";
        this.height = 458;
        this.width = 650;
        this.testCaseID = "";
        this.mediator = mediator;
        this.skipBtnContent = "Cancel"
    }

    _generateContent(){
        return `
    <div class="header">
        <div class="title">Use test data in a test case</div>
        <button class="dialog-close">
            <img src="/katalon/images/SVG/close-icon.svg" alt="Close"/>
        </button>
    </div>
    <div class="content">
      <div class="content-header">
            <div class="step">Step 1 of 2</div>
            <div class="message">Select a test case</div>
        </div>
        <div id="use-in-test-case-test-suite-list"></div>
    </div>`
    }

    async render() {
        await super.render();
        this.setDisableNextButton(true);
        $(this.dialog).find(".dialog-close").click(() => {
            this.close();
        });
        const testSuites = getAllTestSuites();
        for (const testSuite of testSuites) {
            const testSuiteContainer = await this._generateTestSuiteContainerElement(testSuite, this);
            document.getElementById("use-in-test-case-test-suite-list").appendChild(testSuiteContainer);
        }

    }

    async _generateTestSuiteContainerElement(testSuite) {
        const container = document.createElement("div");
        container.id = `use-in-test-case-test-suite-${testSuite.id}`;

        const header = document.createElement("div");
        header.classList.add("use-in-test-case-header");
        container.appendChild(header);

        const dropdown = document.createElement("div");
        dropdown.classList.add("dropdown");
        header.appendChild(dropdown);
        const img = document.createElement("img");
        img.src = "/katalon/images/SVG/dropdown-arrow-off.svg";
        dropdown.appendChild(img);

        const title = document.createElement("div");
        title.classList.add("title")
        title.innerHTML = testSuite.name;
        header.appendChild(title);

        const testCaseContainer = await this._generateTestCasesContainerElement(testSuite);
        container.appendChild(testCaseContainer);


        dropdown.addEventListener("click", function () {
            const image = $(this).find("img");
            const src = $(image).attr("src");
            if (src.includes("off")) {
                $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
                $(testCaseContainer).css("display", "block");
            } else {
                $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
                $(testCaseContainer).css("display", "none");
            }
        })

        return container;
    }

    async _generateTestCasesContainerElement(testSuite) {
        const testCasesContainer = document.createElement("div");
        testCasesContainer.classList.add("use-in-test-case-test-cases-container");
        testCasesContainer.style.display = "none";

        for (const testCase of testSuite.testCases) {
            const testCaseContainer = await this._generateTestCaseContainerElement(testCase);
            testCasesContainer.appendChild(testCaseContainer);
        }

        return testCasesContainer;
    }

    async _generateTestCaseContainerElement(testCase) {
        const container = document.createElement("div");
        container.id = `use-in-test-case-test-case-${testCase.id}`;
        container.classList.add("test-case-item")
        container.addEventListener("click", (event) => {
            event.stopPropagation();
            let target = event.target;
            while (!target.id.includes("use-in-test-case-test-case")) {
                target = target.parentElement;
            }
            $("#use-in-test-case-test-suite-list .selected").removeClass("selected");
            $(target).addClass("selected");
            this.setDisableNextButton(false);
            this.testCaseID = target.id.substring(27);
        })

        const title = document.createElement("div");
        title.innerHTML = testCase.name;
        container.appendChild(title);
        if (testCase.id === this.testCaseID){
            container.classList.add("selected");
            this.setDisableNextButton(false);
        }

        return container;
    }


}

class UseInTestCaseSecondDialog extends WizardDialog{
    constructor(dataFileName, mediator) {
        super({});
        this.id = "data-files-use-in-test-case-dialog-2";
        this.contentHtml = this._generateContent();
        this.dialogClass = "useInTestCase";
        this.height = 458;
        this.width = 650;
        this.testCaseID = "";
        this.dataFile = window.dataFiles[dataFileName];
        if (this.dataFile.data === undefined){
            parseData(dataFileName);
        }
        this.dataFileName = dataFileName;
        this.selectedTestStepIndex = -1;
        this.changedValue = {};
        this.skipBtnContent = "Add";
        this.mediator = mediator;
    }

    _generateContent(){
        return `
    <div class="header">
        <div class="title">Use test data in a test case</div>
        <button class="dialog-close">
            <img src="/katalon/images/SVG/close-icon.svg" alt="Close"/>
        </button>
    </div>
    <div class="content useInTestCase">
      <div class="content-header">
            <div class="step">Step 2 of 2</div>
            <div class="message">Replace values with Test Data columns</div>
        </div>
        <div id="use-in-test-case-preview">
            <table id="use-in-test-case-command-grid" class="tablesorter" cellspacing="0">
              <thead class="fixed">
              <tr>
                <th style="width: 23%">Command</th>
                <th style="width: 52%">Target</th>
                <th style="width: 25%">Value</th>
              </tr>
              </thead>
              <tbody id="use-in-test-case-records-grid">
                  
              </tbody>
            </table>
        </div>
    </div>`
    }

    _generateValueDropDownMenu() {
        const dropdownDiv = document.createElement("div");
        dropdownDiv.id = "use-in-test-case-dialog-menu";
        dropdownDiv.classList.add("menu");

        const ul = document.createElement("ul");
        dropdownDiv.appendChild(ul);

        const columnNames = Object.keys(this.dataFile.data[0]);
        for (let i = 0; i < columnNames.length; i++) {
            const li = document.createElement("li");
            ul.append(li);
            li.style.display = "block"
            li.innerHTML = `\${${columnNames[i]}}`;

            li.addEventListener("click", (event) => {
                event.stopPropagation();
                const tr = $(`#use-in-test-case-records-${this.selectedTestStepIndex} td:nth-child(3) > div:nth-child(1) > div:nth-child(1)`)[0];
                tr.innerHTML = event.target.innerHTML;
                this.changedValue[this.selectedTestStepIndex] = event.target.innerHTML;

            });
        }
        return dropdownDiv;
    }

    async render() {
        await super.render();
        $(this.dialog).find(".dialog-close").click(() => {
            this.close();
        });
        const testCase = findTestCaseById(this.testCaseID);
        const recordGrid = $("#use-in-test-case-records-grid");
        $("#use-in-test-case-preview").append(this._generateValueDropDownMenu());
        $(recordGrid).empty();
        for (let i = 0; i < testCase.getTestCommandCount(); i++) {
            const testCommand = testCase.commands[i];
            let row = document.createElement("tr");
            row.id = `use-in-test-case-records-${i}`;
            let command = document.createElement("td");
            command.innerHTML = testCommand.name;
            let target = document.createElement("td");
            target.innerHTML = testCommand.defaultTarget;
            let value = document.createElement("td");

            let div = document.createElement("div");
            let div2 = document.createElement("div");
            div2.innerHTML = testCommand.value;

            let div3 = document.createElement("div");
            let img = document.createElement("img");
            img.src = "/katalon/images/SVG/angle-down.svg";

            div3.appendChild(img);

            div3.addEventListener("click",  event => {
                let target = event.target;
                while (target.tagName !== "TD"){
                    target = target.parentElement;
                }
                $("#use-in-test-case-dialog-menu")
                    .css("display", "block")
                    .css("top", target.getBoundingClientRect().bottom)
                    .css("left", target.getBoundingClientRect().left)
                    .css("width", target.getBoundingClientRect().width);
                this.selectedTestStepIndex = i;
                $("#use-in-test-case-dialog-menu .custom").remove();

                const li = document.createElement("li");
                li.style.display = "block"
                li.innerHTML = testCommand.value === "" ? "&nbsp;" : testCommand.value;
                li.classList.add("custom");
                li.addEventListener("click",  (event) => {
                    event.stopPropagation();
                    const tr = $(`#use-in-test-case-records-${this.selectedTestStepIndex} td:nth-child(3) > div:nth-child(1) > div:nth-child(1)`)[0];
                    tr.innerHTML = event.target.innerHTML;
                    delete this.changedValue[this.selectedTestStepIndex];
                });

                $("#use-in-test-case-dialog-menu ul").prepend(li);
            });

            div.appendChild(div2);
            div.appendChild(div3);
            value.appendChild(div);

            row.appendChild(command);
            row.appendChild(target);
            row.appendChild(value);
            $(recordGrid).append(row);
        }
    }

}

export { UseInTestCaseFirstDialog, UseInTestCaseSecondDialog, WizardDialogMediator }


