import { resetTable } from "../../view/records-grid/attach-event.js";
import { removeInputValue } from "../../view/records-grid/input-value.js";
import { removeInputCommand } from "../../view/records-grid/input-command.js";
import { removeInputTarget } from "../../view/records-grid/input-target.js";

$(document).on('click', function(e) {
    if ($(e.target).parents('#records-grid').length == 0) {
        if (e.target.id !== 'record') {
            $('#records-grid .selectedRecord').removeClass('selectedRecord');
        }
        resetTable();
        removeInputValue();
        removeInputCommand();
        removeInputTarget();
    }
});

$(() => {
    $("#playback").click(function() {
        resetTable();
        removeInputValue();
        removeInputCommand();
        removeInputTarget();
    });
    $("#playSuite").click(function() {
        resetTable();
        removeInputValue();
        removeInputCommand();
        removeInputTarget();
    });
    $("#playSuites").click(function() {
        resetTable();
        removeInputValue();
        removeInputCommand();
        removeInputTarget();
    });
})