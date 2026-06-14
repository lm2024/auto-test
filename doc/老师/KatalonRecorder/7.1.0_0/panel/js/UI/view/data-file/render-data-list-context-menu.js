import { saveDataFiles } from "../../services/data-file-service/data-file-services.js";
import {
    UseInTestCaseFirstDialog,
    UseInTestCaseSecondDialog, WizardDialogMediator
} from "../dialog/use-in-test-case-dialog.js";

function renderRenameListItem(oldName) {
    const rename = document.createElement("li");
    const a = document.createElement("a");
    a.setAttribute("href", "#");
    a.textContent = "Rename";
    rename.appendChild(a);
    rename.addEventListener("click", function(event) {
        event.stopPropagation();
        const newName = prompt('Please enter the new name for this data file.', oldName);
        if (newName.length > 0 && oldName !== newName) {
            window.dataFiles[newName] = window.dataFiles[oldName];
            delete window.dataFiles[oldName];
            saveDataFiles();
        }
    }, false);
    return rename;
}

function renderDownloadListItem(name) {
    const download = document.createElement("li");
    const a = document.createElement("a");
    a.setAttribute("href", "#");
    a.textContent = "Download";
    download.appendChild(a);
    download.addEventListener("click", function(event) {
        event.stopPropagation();
        let fileContent = "";
        if (window.dataFiles[name].type === "csv") {
            fileContent = "data:text/csv;charset=utf-8," + window.dataFiles[name].content;
        } else if (window.dataFiles[name].type === "json") {
            fileContent = 'data:application/json;charset=utf-8,' + window.dataFiles[name].content;
        }
        let encodedUri = encodeURI(fileContent);
        let link = document.createElement("a");
        link.setAttribute("id", "123");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", name);
        document.body.appendChild(link);
        link.click();
        $(link).remove();
    }, false);
    return download;
}

function renderDeleteListItem(name) {
    const deleteItem = document.createElement("li");
    deleteItem.setAttribute("style", "border-top: 1px solid #E8EBED;");
    const a = document.createElement("a");
    a.setAttribute("href", "#");
    a.textContent = "Delete test data";
    a.setAttribute("style", "color: #B41400;");
    deleteItem.appendChild(a);
    deleteItem.addEventListener("click", function(event) {
        event.stopPropagation();
        if (confirm('Do you want to remove this data file?')) {
            delete window.dataFiles[name];
            saveDataFiles();
        }
    }, false);
    return deleteItem;
}



function renderUseThisInTestCaseItem(name) {
    const useThisItem = document.createElement("li");
    const a = document.createElement("a");
    a.setAttribute("href", "#");
    a.textContent = "Use this in a test case";
    useThisItem.appendChild(a);
    useThisItem.addEventListener("click", async function(event) {
        event.stopPropagation();
        const mediator = new WizardDialogMediator();
        const dialog1 = new UseInTestCaseFirstDialog(mediator);
        const dialog2 = new UseInTestCaseSecondDialog(name, mediator);
        const screenObj = {};
        screenObj[dialog1.id] = dialog1;
        screenObj[dialog2.id] = dialog2;

        mediator.setWizardDialogScreens(screenObj);
        dialog1.render();

    }, false);
    return useThisItem;
}

const renderDataListContextMenu = (id, name) => {
    const menu = document.createElement("div");
    menu.setAttribute("class", "menu");
    menu.setAttribute("id", "menu" + id);

    const useThis = renderUseThisInTestCaseItem(name);
    const rename = renderRenameListItem(name);
    const download = renderDownloadListItem(name);
    const deleteItem = renderDeleteListItem(name);
    const list = document.createElement("ul");

    list.appendChild(useThis);
    list.appendChild(rename);
    list.appendChild(download);
    list.appendChild(deleteItem);

    menu.appendChild(list)
    return menu;
}

export { renderDataListContextMenu }




