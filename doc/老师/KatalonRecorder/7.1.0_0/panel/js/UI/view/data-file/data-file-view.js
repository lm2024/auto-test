import { renderDataListItem } from "./render-data-list-item.js";

const resetDataList = () => {
    var list = $('#data-files-list');
    list.empty();
    var names = Object.keys(window.dataFiles).sort();
    for (var i = 0; i < names.length; i++) {
        var name = names[i];
        var tr = renderDataListItem(name, i);
        list.append(tr);
    }
}

const testDataContainerOpen = () => {
    const image = $("#testDataDropdown").find("img");
    const src = $(image).attr("src");
    if (src.includes("off")) {
        $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
        $("#data-files-list").css("display", "flex");
    }
}

export { resetDataList, testDataContainerOpen }