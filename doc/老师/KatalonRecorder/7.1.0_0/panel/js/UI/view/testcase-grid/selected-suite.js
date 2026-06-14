import { cleanSelected, saveOldCase } from "./utils.js";

const getSelectedSuite = () => {
    let normalSelectedSuite = document.getElementById("testCase-grid").getElementsByClassName("selectedSuite");
    let dynamicSeletedSuite = document.getElementById("testCase-filter").getElementsByClassName("selectedSuite");

    if (normalSelectedSuite.length > 0) {
        return normalSelectedSuite[0];
    } else if (dynamicSeletedSuite.length > 0) {
        return dynamicSeletedSuite[0];
    } else {
        return null;
    }
}


const setSelectedSuite = (id) => {
    saveOldCase();
    cleanSelected();
    $("#" + id).addClass('selectedSuite');
    clean_panel();
}
export { getSelectedSuite, setSelectedSuite }