import { OnBoardingDialog } from "../../view/dialog/onboarding-dialog.js";
import { trackingSegment } from "../../services/tracking-service/segment-tracking-service.js";
import { initPopupOnboarding } from "../../view/onboarding/new-onboarding.js";
import { trackingSkippedTheTour } from "../../services/tracking-service/segment-tracking-service.js";

const tourguide = [{
    element: "#record",
    showElement: "#record",
    content: "<strong>Hit <i class='fa fa-dot-circle-o'></i> Record</strong> & interact with website to create your first script.",
    index: '1',
    next: '2-1',
    nextButton: '',
},
{
    element: "#records-1 td:first-child",
    showElement: "#records-1 td:first-child",
    content: "<strong>Click here</strong> to modify a whole test step.",
    index: '2-1',
    next: '2-2',
    nextButton: '3-1',
},
{
    element: "#records-1 td:nth-child(2)",
    showElement: "#records-1",
    content: "The floating toolbar is for modifying the whole test step. <strong>Click Next</strong> for more.",
    index: '2-2',
    next: '3-1',
    nextButton: '3-1',
},
{
    element: "#records-1 td:nth-child(2)",
    showElement: "#records-1 td:nth-child(2)",
    content: "<strong>Click here</strong> to edit individual cell.",
    index: '3-1',
    next: '3-2',
    nextButton: '',
},
{
    element: "#records-1 td.selectedTd input",
    showElement: "#records-1 td.selectedTd",
    content: "<strong>Right-click</strong> to choose edit options.",
    index: '3-2',
    next: '3-3',
    nextButton: '',
},
{
    element: "#records-1 td.selectedTd input",
    showElement: "#records-1 td.selectedTd",
    content: "Nice work! You’re ready to automate your first test!",
    index: '3-3',
    next: '',
    nextButton: '',
},
{
    element: "#user-manual-icon",
    showElement: "#user-manual-icon",
    content: "<strong>Click here</strong> for more tutorials on advanced features.",
    index: 'user',
    next: '',
    nextButton: '',
}
];

/*** KR435: https://katalon.atlassian.net/browse/KR-435 ***/
function generatePrivacyDialog() {
    const content = `
    <h3>Privacy</h3>
    <p>
      We're asking to collect the following Personally Identifiable Information:
          <ul>
              <li><b>If you consent and sign in with a Katalon account</b>, we will collect the email address associated with that account.</li>
              <li><b>If you consent</b>, we will collect data about the actions that you perform within the application.</li>
              <li><b>Whether your consent or not</b>, we DO NOT track or collect the content of your test cases, test suites or your execution logs.</li>
          </ul>
    </p>
    <p>You can read more about our <a href="https://www.katalon.com/terms/#license-agreement-katalon-recorder">License Agreement</a>.</p>  
    <p>Do you allow us to collect these information in accord with our data privacy?</p> 
    `
    const privacyDialog = new OnBoardingDialog({
        id: "privacyDialog",
        content: content,
        contentClass: "dialog1",
        pageNum: 1,
        pageTotal: 2,
        isPrivacyDialog: true,
    });
    return privacyDialog;
}

function generateFirstDialogKR435() {
    const content = `<div id="content-text">
  <h3>How do you want to use Katalon Recorder?</h3>
  <ul>
  <li>Kickstart test automation in your project</li>
  <li>Generate Selenium automated tests</li>
  <li>Generate Synthetic Scripts for APM tools</li>
  <li>Automate boring and repetitive browser tasks</li>
  <li>Learn test automation (bootcamps, university, etc)</li>
  <li><input type="text" placeholder="Please specify your motivation..."/></li>
  </ul>
</div>`
    return new OnBoardingDialog({
        id: "firstDialog",
        content: content,
        pageNum: 2,
        pageTotal: 2,
        contentClass: "dialog1",
        attachEvent: function () {
            const self = this;
            $(this.dialog).position({ my: "right+35%", at: "center", of: window });
            $(this.dialog).find("li").click(function () {
                $(self.dialog).find(".nextBtn").addClass("disabled");
                $(self.dialog).find(".checked").removeClass("checked");
                $(self.dialog).find(".inputChecked").removeClass("inputChecked");

                if ($(this).find('input').length > 0) {
                    $(this).find('input').on('keyup', function (event) {
                        $(this).parent().addClass('checked');
                        $(self.dialog).find(".nextBtn").removeClass("disabled");
                    });
                } else {
                    $(self.dialog).find('input').val('');
                    $(this).addClass('checked');
                    $(self.dialog).find(".nextBtn").removeClass("disabled");
                }
            });
        }
    });
}

async function renderOnBoardingDialogKR435() {
    const privacyDialog = generatePrivacyDialog();
    const firstDialog = generateFirstDialogKR435();


    privacyDialog.onNext = function () {
        privacyDialog.close();
        firstDialog.render();
    }

    firstDialog.onNext = async function () {
        const userChoice = $(this.dialog).find("li.checked").find('input').length > 0 ? $(this.dialog).find("li.checked").find('input').val() : $(this.dialog).find("li.checked").text();

        let result = (await browser.storage.local.get('onBoardingUserChoice')).onBoardingUserChoice;

        result["use_case"] = userChoice;
        result.checkedEndTour = false;
        result.checkedGotit = 0;

        browser.storage.local.set({ "onBoardingUserChoice": result });
        trackingSegment("kru_on_boarding_v1", result);
        //start the tour
        let startedTour = tourguide.find(i => i.index == '1');
        initPopupOnboarding(startedTour);

        firstDialog.close();
    }

    if (bowser.name === "Firefox") {
        await privacyDialog.render();
        return;
    }

    await firstDialog.render();

    //edit dialog
    $('#firstDialog').css({
        'width': '800px',
        'height': 'auto',
        'background-image': 'url("images/background-onboarding.png")'
    });

    $('#firstDialog').find('.nextBtn').css({
        'margin-right': '185px',
        'margin-bottom': '20px',
        'font-size': '16px',
        'margin-top': '-40px'
    });

    $('#firstDialog').find('.header').html('<button style="cursor: pointer;font-family: Roboto;font-size: 14px;color: #808B9A;float: right;border: none;background: none;padding: 30px 30px 20px 0;">Skip the tour</button>')

    const content = $('#firstDialog').find('.content');
    content.prepend('<div id="icons" style="flex: 1;"><img src="images/logo-onboarding.png" style="width: 100%;margin: 15px 0 0 30px;"/></div>');
    content.css({
        'display': 'flex',
        'flex-flow': 'row'
    });
    content.find('#content-text').css({
        'margin': '0px 30px 0px 50px',
        'display': 'flex',
        'flex-direction': 'column',
        'flex-flow': 3
    });

    $('#firstDialog').find('.header').find('button').click(async () => {
        firstDialog.close();
        let result = (await browser.storage.local.get('onBoardingUserChoice')).onBoardingUserChoice;
        result.checkedEndTour = false;
        browser.storage.local.set({ "onBoardingUserChoice": result });
        let startedTour = tourguide.find(i => i.index == 'user');
        initPopupOnboarding(startedTour);
        trackingSkippedTheTour();
    });
}

$(document).ready(function () {
    browser.storage.local.get('onBoardingUserChoice').then(function (result) {
        if (!result.onBoardingUserChoice) {
            result.onBoardingUserChoice = {};
        }

        let onBoardingUserChoice = result.onBoardingUserChoice;

        onBoardingUserChoice.tour = tourguide;
        browser.storage.local.set({ "onBoardingUserChoice": onBoardingUserChoice });
    });

    browser.storage.local.get("firstTime").then(async result => {
        if (result.firstTime) {
            /*** Update for KR-435 ***/
            renderOnBoardingDialogKR435();
            browser.storage.local.set({ firstTime: false });
        }
    });
})