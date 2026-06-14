import {
    trackingCompletedTheTour,
    trackingSkippedStep
} from "../../services/tracking-service/segment-tracking-service.js"

function removeOnboarding() {
    if ($('#init-onboarding').length > 0) {
        $('#init-onboarding').remove();
    }
}

async function eventNextElement(item) {
    const onBoardingUserChoice = (await browser.storage.local.get("onBoardingUserChoice")).onBoardingUserChoice;
    if (!onBoardingUserChoice.checkedEndTour) {
        if (item.element == "#record") {
            setTimeout(() => {
                if (isRecording) {
                    removeOnboarding();
                } else {
                    const nextElement = onBoardingUserChoice.tour.find(e => e.index == item.next);
                    if ($(nextElement.showElement).length > 0) {
                        initPopupOnboarding(nextElement);
                    } else {
                        const showElement = onBoardingUserChoice.tour.find(e => e.index == 'user');
                        initPopupOnboarding(showElement);
                    }
                }
            }, 300);
        } else {
            const nextElement = onBoardingUserChoice.tour.find(e => e.index == item.next);
            initPopupOnboarding(nextElement);
        }
    } else {
        $("#skip-onboarding").click();
    }
}

function interactiveElement(item) {
    //remove effect while onboarding
    $(item.element).click(function (event) {
        event.stopPropagation();
        eventNextElement(item);
    });

    $(item.showElement).click(function (event) {
        event.stopPropagation();
        eventNextElement(item);
    })

    $(item.element).contextmenu(async function (event) {
        event.stopPropagation();
        eventNextElement(item);
    });
}

function setupPopupOnboarding(elementTour) {
    const div = document.createElement('div');
    div.id = 'init-onboarding';
    div.setAttribute('class', `init-onboarding`);

    //init popup
    const div1 = document.createElement('div');
    div1.id = 'popup-onboarding';
    div1.setAttribute('class', `popup-onboarding`);

    //content popup
    const span1 = document.createElement('p');
    span1.innerHTML = elementTour.content;
    span1.setAttribute('class', 'content-onboarding');

    //init footer of popup
    const elementDiv = document.createElement('div');

    const span2 = document.createElement('p');
    span2.innerHTML = `<strong>${elementTour.index.includes('-') ? elementTour.index.split('-')[0] : elementTour.index}</strong> of <strong>3</strong>`;
    span2.setAttribute('class', 'index-onboarding');

    const button1 = document.createElement('button');
    button1.setAttribute('class', 'skip-onboarding');
    button1.id = 'skip-onboarding';
    button1.innerHTML = "Skip tour";
    button1.addEventListener("click", async function (event) {
        if (this.innerHTML == "Got it" && elementTour.index == '3-3') {
            const onBoardingUserChoice = (await browser.storage.local.get("onBoardingUserChoice")).onBoardingUserChoice;
            const showElement = onBoardingUserChoice.tour.find(e => e.index == 'user');
            initPopupOnboarding(showElement);

            //set state for user manual
            let states = (await browser.storage.local.get("tutorialStates")).tutorialStates;
            if (!states) {
                states = [false, false, false, false, false]
            }
            states[0] = true;
            browser.storage.local.set({ tutorialStates: states });
            await trackingCompletedTheTour();
        } else {
            if (this.innerHTML == "Skip tour") {
                trackingSkippedStep(elementTour.index);
            }

            const onBoardingUserChoice = (await browser.storage.local.get("onBoardingUserChoice")).onBoardingUserChoice;
            if (!onBoardingUserChoice?.checkedEndTour) {
                onBoardingUserChoice.checkedEndTour = true;
            }
            browser.storage.local.set({ "onBoardingUserChoice": onBoardingUserChoice });
            removeOnboarding();
        }

    }, false);

    const button2 = document.createElement('button');
    button2.setAttribute('class', 'next-onboarding');
    button2.id = 'next-onboarding';
    button2.innerHTML = "Next";
    button2.addEventListener("click", async function (event) {
        const onBoardingUserChoice = (await browser.storage.local.get("onBoardingUserChoice")).onBoardingUserChoice;
        if (!onBoardingUserChoice.checkedEndTour) {
            const nextElement = onBoardingUserChoice.tour.find(e => e.index == elementTour.nextButton);
            initPopupOnboarding(nextElement);
        }
    }, false);

    elementDiv.appendChild(span2);
    if (elementTour.index !== '1') {
        elementDiv.appendChild(button1);
    }

    if (elementTour.nextButton != '') {
        elementDiv.appendChild(button2);
    }

    div1.appendChild(span1);
    div1.appendChild(elementDiv);

    const div2 = document.createElement('div');
    div2.id = 'border-onboarding';
    div2.setAttribute('class', `border-onboarding`);
    if (elementTour.index !== '2-2') {
        div2.addEventListener("click", async function (event) {
            setTimeout(() => {
                if ($(elementTour.element).length > 0) {
                    $(elementTour.element).click();
                } else {
                    $(elementTour.showElement).click();
                }
            }, 600);
        });
    }
    div2.addEventListener("contextmenu", async function (event) {
        event.preventDefault();
        event.stopPropagation();

        setTimeout(() => {
            $(elementTour.element).contextmenu();
        }, 200);
    }, false);

    div.appendChild(div1);
    div.appendChild(div2);
    return div;
}

function initPopupOnboarding(elementTour) {
    removeOnboarding();
    //init popup
    const div = setupPopupOnboarding(elementTour);

    document.getElementById('main').appendChild(div);

    //interactive element
    interactiveElement(elementTour);

    //set position popup
    if ($(elementTour.showElement).length > 0) {
        if (["info", "action"].includes(elementTour.index)) {
            $('#popup-onboarding').css({
                top: $(elementTour.showElement).offset().top,
                left: $(elementTour.showElement).offset().left + $(elementTour.showElement).outerWidth() + 10
            });

            document.getElementById("skip-onboarding").innerHTML = "Got it";
            document.getElementById("skip-onboarding").style = "background: #FAAE17;padding: 5px 10px;border-radius: 5px;margin:0";
            document.getElementsByClassName("index-onboarding")[0].style = "color: #FFD36B;";
        } else {
            $('#popup-onboarding').css({
                top: $(elementTour.showElement).offset().top + $(elementTour.showElement).outerHeight() + 10,
                left: $(elementTour.showElement).offset().left
            });
            if (elementTour.nextButton == '' && elementTour.next == '') {
                document.getElementById("skip-onboarding").innerHTML = "Got it";
                document.getElementById("skip-onboarding").style = "background: #FAAE17;padding: 5px 10px;border-radius: 5px;margin:0";
                document.getElementsByClassName("index-onboarding")[0].style = "color: #FFD36B;";
            }
        }

        //set position and width, height for element onboarding
        if ($(elementTour.showElement).find("div.toolbar-btn")?.is(":visible")) {
            $('#border-onboarding').css({
                top: $(elementTour.showElement).find("div.toolbar-btn").offset().top,
                left: $(elementTour.showElement).offset().left - 2,
                width: $(elementTour.showElement).outerWidth(),
                height: $(elementTour.showElement).outerHeight() + $(elementTour.showElement).find("div.toolbar-btn").outerHeight()
            });
        } else if ($(elementTour.showElement).find("div.toolbar-command-btn")?.is(":visible")) {
            $('#border-onboarding').css({
                top: $(elementTour.showElement).find("div.toolbar-command-btn").offset().top,
                left: $(elementTour.showElement).offset().left - 2,
            });
            if ($(elementTour.showElement).find("div.ctm-command-btn")?.is(":visible")) {
                $('#popup-onboarding').css({
                    top: $(elementTour.showElement).offset().top + $(elementTour.showElement).find("div.toolbar-command-btn").outerHeight() + $(elementTour.showElement).find("div.ctm-command-btn").outerHeight() + 15,
                    left: $(elementTour.showElement).offset().left
                });
                $('#border-onboarding').css({
                    width: $(elementTour.showElement).outerWidth() + 30,
                    height: $(elementTour.showElement).outerHeight() + $(elementTour.showElement).find("div.toolbar-command-btn").outerHeight() + $(elementTour.showElement).find("div.ctm-command-btn").outerHeight() - 16
                });
            } else {
                $('#border-onboarding').css({
                    width: $(elementTour.showElement).outerWidth(),
                    height: $(elementTour.showElement).outerHeight() + $(elementTour.showElement).find("div.toolbar-command-btn").outerHeight()
                });
            }
        } else {
            if (elementTour.index == 'user') {
                $('#popup-onboarding').css({
                    left: $(elementTour.showElement).offset().left - 100
                });
            }
            $('#border-onboarding').css({
                top: $(elementTour.showElement).offset().top,
                left: $(elementTour.showElement).offset().left - 2,
                width: $(elementTour.showElement).outerWidth() - 5,
                height: $(elementTour.showElement).outerHeight() - 5
            });
        }
    }
}

export {
    initPopupOnboarding
};