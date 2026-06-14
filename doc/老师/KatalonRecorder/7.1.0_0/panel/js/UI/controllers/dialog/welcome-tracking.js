const forumLink =
  "https://forum.katalon.com/c/product-forums/katalon-recorder/17";
let htmlWhatsnews = `
    <div class="header">
      <div class="title">🌟 Katalon Recorder 7.0.0 - Upgraded to Manifest V3!</div>
    </div>
    <div class="content">
      <p>
        We're excited to announce that Katalon Recorder has successfully migrated to Chrome Manifest V3! Along with enhanced performance and security, this upgrade ensures your existing test cases and favorite extension will continue to work seamlessly with the new Chrome updates.
      </p>
      <p>
        We identified and resolved issues with over 10 keywords. If you encounter any problems with custom locators or keywords, just post the details on the <a href="${forumLink}" target="_blank" tabindex="-1">Katalon Forum</a>, and our team will get to it.
      </p>
      <p>
        Happy testing!
      </p>
    </div>
    <div class="footer">
    <button id="whats-news-release-note">Release note</button>
    <button id="whats-news-close">Close</button>
    </div>
`;

function displayWhatsNewDialog() {
  let newsDialog = $("<div id='whatsNews'></div>")
    .html(htmlWhatsnews)
    .dialog({
      title: `🚀 Katalon Recorder 7.0.0`,
      resizable: true,
      autoOpen: true,
      dialogClass: "newStyleDialog",
      height: "auto",
      width: "500",
      modal: true,
      open: function () {
        $(this.parentElement.childNodes[0]).css("display", "block");
      },
    });
  $("#whats-news-release-note").click(() => {
    window.open(
      "https://docs.katalon.com/katalon-platform/plugins-and-add-ons/katalon-recorder-extension/get-started/release-notes"
    );
  });
  $("#whats-news-close").click(() => {
    newsDialog.remove();
  });
}

$(document).ready(function () {
  browser.storage.local.get("tracking").then(function (result) {
    if (result.tracking) {
      if (
        result.tracking.isUpdated &&
        (result.tracking.hasShownWhatsNewDialog === undefined ||
          result.tracking.hasShownWhatsNewDialog === false)
      ) {
        displayWhatsNewDialog();
        result.tracking.hasShownWhatsNewDialog = true;
        browser.storage.local.set(result);
      }
    }
  });
});
