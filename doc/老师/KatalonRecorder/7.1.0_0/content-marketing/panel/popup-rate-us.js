import { trackingNPSScore, trackingNPSWebStrore } from "../../panel/js/UI/services/tracking-service/segment-tracking-service.js";

let dialogHTML = `
    <div id="rate-dialog" style="display: flex; flex-direction: column;">
        <div style="display: flex; flex-direction: row; justify-content: center; align-items: flex-start; padding: 22px 0px 22px;">
            <span style="margin-left: 35%; font-weight: bold; font-size: 16px;">Give us a review</span>
            <img id="remove-rate" style="margin-left: auto;" src="../icons/remove.svg"/>
        </div>
        <div style="display: flex; flex-direction: column;">
            <img style="width: 60%; margin: 0 20% 5%;" src="../icons/rate-us.svg"/>
            <span style="font-size: 14px;margin: 0 3%;">Bravo! You have quite a few successful executions already. Are you finding Katalon Recorder helpful?<br/><br/>
            Leave us a review</span>
            <div id="button-rate" style="margin: 10px 17%;width: 60%;text-align: center;background: #EEEEF0;border-radius: 4px;display: flex;flex-direction: row;align-items: center;padding: 10px 12px;justify-content: center;cursor: pointer;">
                <img src=""/>
                <span style="padding-left: 5px;"></span>
            </div>
        </div>
    </div>
    `;

let ratePointHTML = `
    <div id="rate-point">
        <div class="rate-header" style="font-size: 16px;line-height: 24px; display: flex;align-items: center;>
            <span style="font-size: 16px;line-height: 24px;">Give us a review</span>
            <img id="remove-rate" style="margin-left: auto;" src="../icons/remove.svg"/>
        </div>
        <div id="rate-point-item" style="display: flex;flex-direction: column; margin-bottom: 10px;">
            <span>How likely are you to recommend us to your friends or colleagues?</span>
            <ul style="display: flex;flex-direction: row;margin-block-start: 0;padding-inline-start: 0;">
            </ul>
            <textarea placeholder="Please help us by explaining your score" style="display:none;height: 50px;font-family: 'Roboto';"></textarea>
            <div style="display:none;margin-left: auto;margin-top: 5%;">
                <button id="back-rate" style="border-radius: 4px;font-size: 14px;line-height: 20px;border: none;padding: 5px 10px;">Back</button>
                <button id="send-rate" style="background: #276EF1;border-radius: 4px;font-size: 14px;line-height: 20px;color: #FFFFFF;border: none;padding: 5px 10px;">Send</button>
            </div>
        </div>
    </div>
    `;

function popupRateUs(ratePoints) {
    for (let index = 1; index < 11; index++) {
        let li = `<li style="background: #FFFFFF;border: 1px solid #D5D8DD;border-radius: 50%;padding: 8px 11px; margin: 10px;display: flex;cursor: pointer;">${index}</li>`
        if (index == 10) {
            li = li.replace('padding: 8px 11px', 'padding: 8px');
            $('#rate-point-item').find('ul').append(li);
        } else {
            $('#rate-point-item').find('ul').append(li);
        }
    }
    $('#rate-point').find('li').click(function(event) {
        if ($('#rate-point-item').find('li').hasClass('checkedRate')) {
            $('#rate-point-item').find('li').css({ 'background': '', 'color': '' });
            $('#rate-point-item').find('li').removeClass('checkedRate');
        }

        $(this).css({ 'background': '#276EF1', 'color': '#FFFFFF' });
        $(this).addClass('checkedRate');

        let score = parseInt($(this).html());
        ratePoints.score = score;

        if (score <= 7) {
            setTimeout(() => {
                $('#ratepointPopup').css('width', '350px');
                $('#rate-point-item').find('textarea').show();
                $('#rate-point-item').find('div').show();
                $('#rate-point-item').find('ul').hide();
                $('#rate-point-item').find('span').hide();

                $('#send-rate').click(() => {
                    ratePoints.reviews = $('#rate-point-item').find('textarea').val();

                    browser.storage.local.set({
                        ratePoints: ratePoints
                    });

                    trackingNPSScore(score, ratePoints.reviews);

                    $('#ratepointPopup').remove();
                });

                $('#back-rate').click(() => {
                    $('#ratepointPopup').css('width', '');
                    $('#rate-point-item').find('textarea').hide();
                    $('#rate-point-item').find('div').hide();
                    $('#rate-point-item').find('ul').show();
                    $('#rate-point-item').find('span').show();
                })
            }, 1000);
        } else {
            $('#ratepointPopup').css('width', '350px');
            $('#ratepointPopup').html(dialogHTML);
            if (bowser.name === "Firefox") {
                $('#button-rate').find('span').html('Review on Firefox Web Store');
                $('#button-rate').find('img').attr("src", "../icons/firefox.svg");
                $('#button-rate').click(() => {
                    trackingNPSWebStrore('Firefox');
                })
            } else if (bowser.name === "Chrome") {
                $('#button-rate').find('span').html('Review on Chrome Web Store');
                $('#button-rate').find('img').attr("src", "../icons/chrome.svg");
                $('#button-rate').click(() => {
                    trackingNPSWebStrore('Chrome');
                })
            }

            $('#button-rate').click(() => {
                browser.storage.local.set({
                    ratePoints: ratePoints
                });

                trackingNPSScore(score, '');

                $('#ratepointPopup').remove();

                if (bowser.name === "Firefox") {
                    browser.tabs.create({
                        url: `https://addons.mozilla.org/en-US/firefox/addon/katalon-automation-record/`
                    });
                } else if (bowser.name === "Chrome") {
                    browser.tabs.create({
                        url: `https://chrome.google.com/webstore/detail/katalon-recorder-selenium/ljdobmomdgdljniojadhoplhkpialdid`
                    });
                }
            });

            $('#remove-rate').click(() => {
                $('#ratepointPopup').remove();
            });

        }
    });

    $('#remove-rate').click(() => {
        $('#ratepointPopup').remove();
    });
}

async function setRateUs() {
    let result = await browser.storage.local.get("ratePoints");
    if (!result.ratePoints) {
        result = {
            ratePoints: {
                score: 0,
                reviews: '',
                successfulExc: 0
            }
        }
    }

    result.ratePoints.successfulExc++;
    browser.storage.local.set(result);

    return result.ratePoints;
}

async function showRateUs(ratePoints) {
    let popup = $('<div id="ratepointPopup"></div>').css({
        'position': 'absolute',
        'display': 'none',
        'bottom': '50px',
        'z-index': '1',
        'background-color': '#FFFFFF',
        'border-radius': '15px',
        'max-width': '',
        'box-shadow': '0px 8px 16px 0px rgba(0,0,0,0.2)',
        'padding': '10px',
        'margin-bottom': '-1%',
        'right': '2%',
        'color': 'black'

    }).html(ratePointHTML);

    let numb = ratePoints.successfulExc,
        score = ratePoints.score,
        reviews = ratePoints.reviews;

    if (numb / 20 == 1 && (score <= 7 && reviews == '')) {
        if ($('#ratepointPopup').is(":visible")) {
            $('#ratepointPopup').remove();
        }
        $("body").append(popup);

        $(popup).show();
        popupRateUs(ratePoints);
    }
}

$(() => {
    browser.storage.onChanged.addListener(async(changes, areaName) => {
        if (Object.keys(changes).includes("ratePoints")) {
            showRateUs(changes.ratePoints.newValue);
        }
    })
})

$('body').on('DOMSubtreeModified', '#result-runs', function() {
    if ($('#stop').is(':visible')) {
        setRateUs();
    }
});