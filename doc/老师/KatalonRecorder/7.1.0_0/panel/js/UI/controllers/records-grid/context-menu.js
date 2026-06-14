import { commandGridMenu } from "../../view/records-grid/command-grid-menu.js";
import { MenuItem } from "../../models/menu/menu-item.js";
import { generatePlayFromHereCommand, generatePlaySpecificRecordCommand, generateDeleteSelectedCommand, generateRecordFromHereCommand, generatePlayToHereCommand } from "../../services/records-grid-service/command-generators.js";

document.body.appendChild(commandGridMenu.getContainer());

// Trigger action when the context menu is about to be shown
$(document).on("contextmenu", function(event) {
    $(".menu").css("left", event.pageX).css("top", event.pageY);

    if (event.target.id === "testCase-container") {
        event.preventDefault();
        $("#suite-grid-menu").show();
        return;
    }
    commandGridMenu.remove("grid-play-this-command");
    commandGridMenu.remove("grid-play-from-here");
    commandGridMenu.remove("grid-play-to-here");
    commandGridMenu.remove("grid-record");
    commandGridMenu.remove("grid-delete");
    let target = event.target;
    let inCommandGrid = false;
    while (target.tagName.toLowerCase() !== "body") {
        if (/records-(\d)+/.test(target.id)) {
            let index = target.id.split("-")[1];
            let recordFromHere = new MenuItem("grid-record", "Record from here", generateRecordFromHereCommand());
            let playThisCommandItem = new MenuItem("grid-play-this-command", "Play this test step", generatePlaySpecificRecordCommand(index));
            let playFromHereItem = new MenuItem("grid-play-from-here", "Play from here", generatePlayFromHereCommand(index));
            let playToHereItem = new MenuItem("grid-play-to-here", "Play to here", generatePlayToHereCommand());
            commandGridMenu.add(playThisCommandItem);
            commandGridMenu.add(playFromHereItem);
            commandGridMenu.add(playToHereItem);
            commandGridMenu.add(recordFromHere);
        }
        if (target.id === "command-grid" || target.className.search("record-bottom") >= 0) {
            inCommandGrid = true;
            break;
        } else {
            target = target.parentElement;
        }
    }

    const deleteItem = new MenuItem("grid-delete", `Delete this test step <span class="hotKey"></span>`, generateDeleteSelectedCommand);
    commandGridMenu.add(deleteItem);

    $('#grid-delete').on('mouseover', function(event) {
        $('.selectedRecord').addClass('removeRecord');
    });

    $('#grid-delete').on('mouseout', function(event) {
        $('.selectedRecord').removeClass('removeRecord');
    });
    if (inCommandGrid) {
        event.preventDefault();
        commandGridMenu.show();
    }
});


// If the document is clicked somewhere
$(document).on("mousedown", function(e) {
    if (!$(e.target).parents(".menu").length > 0) $(".menu").hide();
    // KAT-BEGIN fix context menu not work with touchpad
    else setTimeout(function() { $(".menu").hide(); }, 500);
    // KAT-END
});