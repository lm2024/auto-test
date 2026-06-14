import {
    generateCopyVariableCommand,
    generatePasteVariableCommand
} from "../../services/global-profile-service/command-generator.js";


function addHotKeysHandler() {
    let isOnProfileContainer = false;
    let isOnProfileToolBar = false;


    document.getElementById("profile-toolbar").addEventListener("click", function(event) {
        isOnProfileContainer = false;
    })

    document.addEventListener("click", function(event) {
        const commandContainerElement = document.getElementById("profile-variable-container");
        const commandToolbarElement = document.getElementById("profile-toolbar");
        isOnProfileContainer = commandContainerElement.contains(event.target);
        isOnProfileToolBar = commandToolbarElement.contains(event.target);
    });


    function stopNativeEvent(event) {
        // NOTE: lock the browser default shortcuts
        // and this should be careful
        event.preventDefault();
        event.stopPropagation();
    }

    // Hot key setting
    document.addEventListener("keydown", async function(event) {
        let keyNum;
        if (window.event) { // IE
            keyNum = event.keyCode;
        } else if (event.which) { // Netscape/Firefox/Opera
            keyNum = event.which;
        }

        // Hot keys: Ctrl + [KEY] or Command + [KEY]
        if ($('#profile-section').is(':visible')) {
            if (event.ctrlKey || event.metaKey) {
                // Users should not be allowed to refresh the app,
                // as it will re-inject content scripts and cause weird behaviors
                if (keyNum === 82) {
                    stopNativeEvent(event);
                    return;
                }
                if (!isOnProfileContainer) {
                    return;
                }

                stopNativeEvent(event);
                let copyCommand;
                switch (keyNum) {
                    case 67: // Ctrl + C
                        copyCommand = generateCopyVariableCommand();
                        await copyCommand.execute();
                        break;
                    case 86: // Ctrl + V
                        let pasteCommand = generatePasteVariableCommand();
                        await pasteCommand.execute();
                        break;
                    default:
                        break;
                }
            }
        }
    }, false);
}

export { addHotKeysHandler }