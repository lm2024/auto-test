import AuthService from "../../panel/js/UI/services/auth-service/auth-service.js";
import { usageWatcher } from "../../panel/js/UI/services/tracking-service/UsageWatcher.js";
import { Tracker } from "../../panel/js/UI/services/tracking-service/segment-tracking-service.js";

export async function popupPromoteSignup(triggerPath) {
  usageWatcher.countPromoteSignUp();

  const id = "promote-sign-up-dialog";
  let popup = $(`#${id}`);
  if (popup.length) {
    $(popup).show();
    $(popup).find(".toast").effect("shake");
    Tracker.promoteSignUpPopupAction("open", triggerPath);
    return;
  }

  let dialogHTML = `
    <style>
      .toast-backdrop {
        background: rgba(0,0,0,0.4);
        width: 100%;
        height: 100%;
      }
      .toast {
        position: absolute;
        bottom: 50px;
        right: 20px;
        background-color: #fff;
        max-width: 220px;
        box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
        padding: 20px;
        margin-bottom: -1%;
        color: black;
      }
      .toast-button {
        border-radius: 5px;
        padding: 8px 14px;
        border: none;
        color: black;
        cursor: pointer;
      }
      #btn-cancel:hover {
        background-color: #d7dbdb;
      }
      #btn-ok{
        background-color: #3366FF;
        color: white;
        border-radius: 5px;
      }
      #btn-ok:hover{
        background-color: #1d42af;
      }
    </style>
    <div class="toast-backdrop">
      <div class="toast">
        <div style="text-align: left; font-size: 13px;"><strong>Automate more with a free account!</strong></div>
        </br>
        <span>
          Sign up now to connect with other Katalon users, and receive support from our product team.
        </span>
        <div style="margin-top: 25px; text-align: right">
          <button id="btn-cancel" class="toast-button" type="button" style="margin-right: 10px">Maybe later</button>
          <button id="btn-ok" class="toast-button" type="button">Sign up</button>
        </div>
      </div>
    </div>
    `;

  popup = $(`<div id="${id}"></div>`)
    .css({
      "z-index": 99999999,
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
    })
    .html(dialogHTML);
  $("body").append(popup);

  $(popup)
    .find("#btn-cancel")
    .click(function (event) {
      $(popup).hide();
      Tracker.promoteSignUpPopupAction("maybe-later", triggerPath);
    });

  $(popup)
    .find(".toast-backdrop")
    .click((event) => {
      if (event.currentTarget === event.target) {
        $(popup).hide();
        Tracker.promoteSignUpPopupAction("backdrop", triggerPath);
      }
    });

  $(popup)
    .find("#btn-ok")
    .click(function () {
      $(popup).hide();
      AuthService.openUniversalLoginUrl();
      Tracker.promoteSignUpPopupAction("sign-up", triggerPath);
    });
  $(popup).show();
  $(popup).find(".toast").effect("shake");

  Tracker.promoteSignUpPopupAction("open", triggerPath);
}
