import { renderDataListContextMenu } from "./render-data-list-context-menu.js";

const renderDataListItem = (name, index) => {
    const id = "data" + index;
    const div = document.createElement('div');
    div.classList.add("data-item");
    div.id = id;

    const imageDiv = document.createElement('div');
    imageDiv.classList.add("dataIcon");
    const img = document.createElement('img');
    img.src = "/katalon/images/SVG/paper-icon.svg";
    imageDiv.append(img);
    div.appendChild(imageDiv);

    const titleDiv = document.createElement("div");
    titleDiv.innerHTML = name;
    div.append(titleDiv);

    const contextMenu = renderDataListContextMenu(id, name);
    div.append(contextMenu);
    addContextMenuButton(id, div, contextMenu, "data");
    div.addEventListener("contextmenu", function(event) {
        event.preventDefault();
        event.stopPropagation();
        var mid = "#" + "menu" + id;
        $(".menu").css("left", event.pageX).css("top", event.pageY);
        $(mid).show();
    })
    return div;
}

export { renderDataListItem }