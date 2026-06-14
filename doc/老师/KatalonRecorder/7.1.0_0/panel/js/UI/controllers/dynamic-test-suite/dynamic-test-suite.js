import { generateAuditTagsPopup } from "../../view/dynamic-test-suite/manage-tags.js";
import { createNewDynamicTestSuite } from "../../view/dynamic-test-suite/dynamic-helper.js";
import { setTrackingLeftSidePanelData } from "../../services/tracking-service/left-side-panel-tracking.js";
// import { checkLoginOrSignupUserForCreateDynamicTestSuite } from "../../../../../content-marketing/panel/popup-create-dynamic-test-suite.js";

function renderAuditTagDialog() {
    $("<div id='tag-popup'></div>")
        .html(generateAuditTagsPopup)
        .dialog({
            resizable: true,
            width: "500",
            modal: true,
            open: function(event, ui) {
                $(".ui-dialog-titlebar").hide();
            }
        });
    $('#tag-popup').keyup(function(e) {
        if (e.which == 27 || e.keyCode == 27) {
            $("#tag-popup").remove();
        }
    })
}


$(() => {
    $('#tagging-features').click(function(event) {
        if ($("#tag-popup").length > 0) {
            $("#tag-popup").remove();
        }
        renderAuditTagDialog();
        $("#tag-popup").dialog('open');
    });

    $('#dynamic-plus').click(async function(event) {
      /*** Comment out for KR-520 ***/
      // const result = await checkLoginOrSignupUserForCreateDynamicTestSuite();
      // if (result){
      //     createNewDynamicTestSuite();
      //     setTrackingLeftSidePanelData("addDynamicTestSuite");
      // }
      /*** Comment out for KR-520 ***/

      createNewDynamicTestSuite();
      setTrackingLeftSidePanelData("addDynamicTestSuite");
    });

    $("#testCase-filter").css("display", "none");
    $("#dynamic-dropdown").click(function() {
        const image = $(this).find("img");
        const src = $(image).attr("src");
        if (src.includes("off")) {
            $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-on.svg");
            $("#testCase-filter").css("display", "block");
        } else {
            $(image).attr("src", "/katalon/images/SVG/dropdown-arrow-off.svg");
            $("#testCase-filter").css("display", "none");
        }
    });
})