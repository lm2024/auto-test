import { resetDataList } from "../../view/data-file/data-file-view.js";

const readCsv = (f) => {
    const reader = new FileReader();
    reader.readAsText(f);
    reader.onload = function (event) {
        window.dataFiles[f.name] = {
            content: reader.result,
            type: 'csv'
        };
        saveDataFiles();
    }
}

const readJson = (f) => {
    const reader = new FileReader();
    reader.readAsText(f);
    reader.onload = function (event) {
        window.dataFiles[f.name] = {
            content: reader.result,
            type: 'json'
        };
        saveDataFiles();
    }
}


const saveDataFiles = () => {
    browser.storage.local.set({
        dataFiles: window.dataFiles
    });
    resetDataList();
}

const parseData = (name) => {
    var dataFile = window.dataFiles[name];
    if (!dataFile.data) {
        var type = dataFile.type;
        if (!type) {
            type = 'csv';
        }
        if (type === 'csv') {
            dataFile.data = Papa.parse(dataFile.content, { header: true }).data;
        } else {
            dataFile.data = JSON.parse(dataFile.content);
        }
    }
    return dataFile;
}

export {readCsv, readJson, saveDataFiles, parseData}