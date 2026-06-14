function injectRecord(request, sender, sendResponse, type) {
    if (request.attachRecorder) {
        if ($('#popupInjectionKR').length == 0) {
            addPopup();
        }
        return;
    } else if (request.detachRecorder) {
        removePopup();
        return;
    }
}

function removePopup() {
    if ($('#popupInjectionKR').length > 0) {
        $('#popupInjectionKR').remove();
    }
}

function addPopup() {
    var mousePosition;
    var offset = [0, 0];
    var isDown = false;

    const div = document.createElement('div');
    div.id = "popupInjectionKR";
    div.style = `display: flex!important;
        flex-direction: row!important;
        position: fixed!important;
        top: 90% !important;
        left: 35% !important;
        border: 1px solid rgb(232, 235, 237) !important;
        background: white !important;
        width: 350px !important;
        color: rgb(35, 49, 69) !important;
        border-radius: 6px !important;
        cursor: default !important;
        box-shadow: rgb(76 101 145 / 15%) 0px 8px 12px, rgb(76 101 145 / 30%) 0px 0px 1px !important;
        z-index: 99999999 !important;`;

    div.addEventListener('mousedown', function (e) {
        isDown = true;
        offset = [
            div.offsetLeft - e.clientX,
            div.offsetTop - e.clientY
        ];
    }, true);

    const div1 = document.createElement('div');
    div1.innerText = "Katalon Recorder is recording ...";
    div1.style = `flex: 9 1 0%!important;
    font-weight: 600!important;
    font-size: 16px!important;
    line-height: 16px!important;
    display: flex!important;
    align-items: center!important;
    margin: 10px 0 10px 12px!important;`;

    const button = document.createElement('button');
    button.innerHTML = trustedPolicy.createHTML("Stop");
    button.style = `color: white!important;
    background: rgb(225, 25, 0)!important;
    border: none!important;
    margin: 10px 12px 10px 0!important;
    border-radius: 3px!important;
    cursor: pointer!important;
    width: auto!important;
    align-self: flex-end!important;
    padding: 5px 12px!important;
    font-weight: 500!important;
    font-size: 16px!important;
    line-height: 16px!important;
    height: auto!important;
    letter-spacing: 0!important;`;
    button.addEventListener("click", function (event) {
        browser.runtime.sendMessage({ checkStopInContentScript: true });
    })

    div.appendChild(div1);
    div.appendChild(button);

    document.body.appendChild(div);

    document.addEventListener('mouseup', function () {
        isDown = false;
    }, true);

    document.addEventListener('mousemove', function (event) {
        event.preventDefault();
        if (isDown) {
            mousePosition = {

                x: event.clientX,
                y: event.clientY

            };
            div.style.left = (mousePosition.x + offset[0]) + 'px';
            div.style.top = (mousePosition.y + offset[1]) + 'px';
        }
    }, true);
}

browser.runtime.onMessage.addListener(injectRecord);