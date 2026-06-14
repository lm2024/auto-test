import { trackingSegment } from "../../panel/js/UI/services/tracking-service/segment-tracking-service.js";
import { trackingHubspotLogin, trackingHubspotSignup } from "../../panel/js/UI/services/tracking-service/hubspot-tracking-service.js";

let loginSignup = `
<style>
.no-titlebar .ui-dialog-titlebar {
  display: none;
}
#dialgue.ui-dialog-content.ui-widget-content{
  padding: 0!important;
}
h2 {
  margin-left: 48px;
  margin-right: 48px;
}
.content-signin{
  font-family: Roboto;
  font-style: normal;
  margin-top: 15px;
  margin-left: 30px;
}

input[type=email],input[type=password],input[type=text]{
  padding-left: 10px;
  width: 85%;
  height: 30px;
  margin: 5px 0;
  border: 2px solid #999;
  border-radius: 5px;
  font:15px sans-serif;
}

#sign-up, #sign-in, #ignore-1, #ignore-2, #signup-button, #signin-button {
  width: 40%;
  height: 30px;
  font:15px sans-serif;
  cursor: pointer;
}

#sign-up, #sign-in, #signup-button, #signin-button {
  width: 90%;
  color: #f1f1f4;
  background: #276EF1;
  border: none;
  border-radius: 4px;
  margin-bottom: 10px;
}

#signup-button, #signin-button {
    background: #F0F1F2;
    color: #233145;
}

#ignore-1, #ignore-2 {
  width: 90%;
  color: #BDBDBD;
  background: white;
  border:none;
}

.button-login{
  margin: 20px 0;
}
#error-login1,#error-login2{
  color: #ff0000d6;
  font-style: italic;
  display: block;
  width: 90%;
}

.block-input{
    display: flex;
    flex-direction: column;
}

.block-input label {
  width: 80px;
  text-align: left;
  font:15px Roboto;
}

.block-input i {
  margin-left: 260px;
  margin-top: -27px;
  position: relative;
}​
</style>
<div style="text-align: center;margin-top: 20px;">
<img src="../katalon/images/branding/new-Katalon-Recorder-full-color-large.svg" alt="Katalon Recorder" width="80%"/>
</div>
<div class="content-signin">
  <div id="signin">
  <h3 style="color: #276EF1;">Quality assurance. Productivity. 
  </br>
  Let’s begin the journey!
  </h3>
  <div>
    <div class="block-input">
    <label>Email</label>
    <input id="email-signin" type="email" name="email" required>
    </div>
    <div class="block-input">
    <label>Password</label>
    <input id="pass-signin" type="password" placeholder="Minimum 8 characters" name="password" required>
    <i class="fa fa-eye-slash" id="toggle-pass1" toggle="#pass-signin"></i>
    </div>
    <div class="button-login">
      <button id="sign-in" type="button">Sign in</button>
      <span id="error-login1"></span>
      <button id="ignore-1" type="button"><u>Maybe later</u></button>
    </div>
    <div>
        <span>New to Katalon Recorder?</span>
        <button id="signup-button" type="button" style="margin-top: 10px;">Sign up</button>
    </div>
  </div>
  </div>
  <div id="signup">
  <h3 style="color: #276EF1;">
  Easy. Powerful. Extensible.
  </br>
  Free account. Unlimited Automation
  </h3>
  <div>
    <div class="block-input">
    <label>Full name</label>
    <input id="name" type="text" name="Fullname" required>
    </div>
    <div class="block-input">
    <label>Email</label>
    <input id="email" type="email" name="email" required>
    </div>
    <div class="block-input" id="block-pass">
    <label>Password</label>
    <input id="pass" type="password" name="password" placeholder="Minimum 8 characters" required>
    <i class="fa fa-eye-slash" id="toggle-pass" toggle="#pass"></i>
    </div>
    <div class="button-login">
      <button id="sign-up" type="button">Create account</button>
      <span id="error-login2"></span>
      <button id="ignore-2" type="button"><u>Maybe later</u></button>
    </div>
    <div>
        <span>Already have an account? </span>
        <button id="signin-button" type="button" style="margin-top: 10px;">Sign in</button>
    </div>
  </div>
  </div>
</div>  
`;

// function togglerButton(data) {
//     $(".io-toggler").each(function() {
//         var io = $(this).data("io"),
//             $opts = $(this).find(".io-options"),
//             $clon = $opts.clone(),
//             $span = $clon.find("span"),
//             width = $opts.width() / 2;

//         $(this).append($clon);

//         function swap(x) {
//             $clon.stop().animate({ left: x }, 150);
//             $span.stop().animate({ left: -x }, 150);
//             $(this).data("io", x === 0 ? 0 : 1);
//             if (x === 0) {
//                 $("#signup").show();
//                 $("#signin").hide();
//             } else {
//                 $("#signin").show();
//                 $("#signup").hide();
//             }
//         }

//         $clon.draggable({
//             axis: "x",
//             containment: "parent",
//             drag: function(evt, ui) {
//                 $span.css({ left: -ui.position.left });
//             },
//             stop: function(evt, ui) {
//                 swap(ui.position.left < width / 2 ? 0 : width);
//             },
//         });

//         $opts.on("click", function() {
//             swap($clon.position().left > 0 ? 0 : width);
//         });

//         if (data) {
//             $opts.click();
//         }

//         // Read and set initial predefined data-io
//         if (!!io) $opts.trigger("click");
//         // on submit read $(".io-toggler").data("io") value
//     });
// }

async function setUserLogin(rs, isLoggedIn) {
    if (isLoggedIn) {
        const result = await getCheckLoginData();
        let checkLoginData = result.checkLoginData;

        if (rs.data.jwt) {
            checkLoginData.user = rs.email;
            checkLoginData.hasLoggedIn = true;

            const options = {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${rs.data.jwt}`,
                    "Content-Type": "application/json",
                },
            };
            fetch(getKatalonAPI().checkActived, options)
                .then((res) => res.json())
                .then((res) => {
                    let check = false;
                    if (res.data.status !== "NEW") {
                        checkLoginData.isActived = true;
                        check = true;
                    } else {
                        check = false;
                    }
                    browser.storage.local.set(result);
                    return check;
                })
                .then((check) => {
                    if (check) {
                        segmentTrackingService().then((r) => r.trackingLogin());
                        trackingHubspotLogin();
                        $(dialogSignIn).dialog("close");
                        $("#email-signin").val("");
                        $("#pass-signin").val("");

                        // Set katone_access_token for TestOps
                        updateTestOpsLoginToken(rs.data.jwt);
                    } else {
                        $("#sign-in").text("Sign in");
                        $("#error-login1")
                            .css("color", "#ff0000d6")
                            .html(
                                '<span>This email is not verified yet. Please check your inbox, or go to <a target="_blank" href="https://my.katalon.com/profile">My Account</a> to finish the process.<span>'
                            );
                    }
                });
        }
    } else {
        let emailSignup = $("#email").val();
        let passSignup = $("#pass").val();

        if (emailSignup && passSignup) {
            $("#email-signin").val(emailSignup);
            $("#pass-signin").val(passSignup);
            document.getElementById("name").value = "";
            document.getElementById("email").value = "";
            document.getElementById("pass").value = "";
        }
        $("#error-login1")
            .css("color", "rgb(54, 179, 126)")
            .html(
                "Sign up successfully, please sign in to start using Katalon Recorder."
            );
        $("#sign-up").text("Sign up");
    }
}

function togglePassword(toggle) {
    $(toggle).toggleClass("fa-eye-slash fa-eye");
    var input = $($(toggle).attr("toggle"));
    if (input.attr("type") == "password") {
        input.attr("type", "text");
    } else {
        input.attr("type", "password");
    }
}

function getKatalonAPI() {
    const endpoint = `https://web-api.katalon.com/wp-json/restful_api/v1/user`;
    const endpointAPI = "https://api.katalon.com/auth";
    const url = {
        signup: `${endpoint}/create-new-account`,
        signin: `${endpointAPI}/login`,
        checkActived: `${endpointAPI}/me`,
    };
    return url;
}

const segmentTrackingService = async function() {
    const segmentSer = await
    import ("../../panel/js/UI/services/tracking-service/segment-tracking-service.js");
    return segmentSer;
};

const dialogSignIn = $('<div id="dialgue"></div>')
    .html(loginSignup)
    .dialog({
        dialogClass: "no-titlebar",
        autoOpen: false,
        height: 'auto',
        width: 348,
        modal: true,
        open: function() {
            $("#signup").show();
            $("#signin").hide();
        },
        close: function() {
            $(this).hide();
        },
        closeOnEscape: false
    });

function setLoginOrSignup() {
    $(dialogSignIn).dialog("open");

    //init dialog
    $("#error-login1").html('');
    $("#error-login2").html('');

    $("#ignore-1").click(() => {
        $(dialogSignIn).dialog("close");
    });

    $("#signup-button").click(() => {
        $("#signup").show();
        $("#signin").hide();
    });

    $("#signin-button").click(() => {
        $("#signup").hide();
        $("#signin").show();
    });

    $('#pass').focusin(function() {
        if ($('#req-pass').length > 0 || $('#req-pass').is(':visible')) {
            $('#req-pass').remove();
        }

        $('#block-pass').append(`<div id="req-pass" class="tooltip">
        <ul style="margin-block-end: 0;margin-block-start: 0;">
          <li style="display: list-item; align-items: flex-end; margin-left: -14px; margin-top: 3px;">
            <img src='icons/checked.svg' style='display:none; margin-right: 5px;'>
            <span>1 upper and lowercase letter</span>
          </li>
          <li style="display: list-item; align-items: flex-end; margin-left: -14px; margin-top: 3px;">
            <img src='icons/checked.svg' style='display:none; margin-right: 5px;'>
            <span>1 special character (e.g. @,#,$,...)</span>
          </li>
          <li style="display: list-item; align-items: flex-end; margin-left: -14px; margin-top: 3px;">
            <img src='icons/checked.svg' style='display:none; margin-right: 5px;'>
            <span>At least 8 characters</span>
          </li>
          <li style="display: list-item; align-items: flex-end; margin-left: -14px; margin-top: 3px;">
            <img src='icons/checked.svg' style='display:none; margin-right: 5px;'>
            <span>Do not allow space</span>
          </li>
        </ul>
      </div>`).show();

        $('#req-pass').css({
            'position': 'absolute',
            'display': 'block',
            'border': '1px solid #000000',
            'background-color': 'white',
            'color': 'black',
            'padding': '5px',
            'border-radius': '10px',
            'z-index': 2,
            'text-align': 'left',
            'margin-top': '60px',
            'width': '79%',
            'opacity': 1
        });
    });
    $('#pass').focusout(() => {
        $('#req-pass').remove();
    })

    $('#pass').on('keyup', function(e) {
        if ($('#req-pass').length > 0) {
            let liMap = $('#req-pass').find('li');
            if (/^(?=.*?[A-Z])(?=.*?[a-z])/.test(this.value)) {
                $(liMap[0]).css('display', 'flex');
                $(liMap[0]).find('img').show();
            } else {
                $(liMap[0]).css('display', 'list-item');
                $(liMap[0]).find('img').hide();
            }

            if (/(?=.*?[#?!@$%^&*-])/.test(this.value)) {
                $(liMap[1]).css('display', 'flex');
                $(liMap[1]).find('img').show();
            } else {
                $(liMap[1]).css('display', 'list-item');
                $(liMap[1]).find('img').hide();
            }

            if (this.value.length >= 8) {
                $(liMap[2]).css('display', 'flex');
                $(liMap[2]).find('img').show();
            } else {
                $(liMap[2]).css('display', 'list-item');
                $(liMap[2]).find('img').hide();
            }

            if (/\s/.test(this.value)) {
                $(liMap[3]).css('display', 'list-item');
                $(liMap[3]).find('img').hide();
            } else {
                $(liMap[3]).css('display', 'flex');
                $(liMap[3]).find('img').show();
            }
        }
    })

    $("#sign-in").click(() => {
        let email = $("#email-signin").val();
        let pass = $("#pass-signin").val();

        if (!email || !pass) {
            $("#error-login1").text("Please fill in all the fields.");
        } else {
            $("#sign-in").text("Processing.....");

            let options = {
                method: "POST",
                headers: { "Content-type": "application/json; charset=UTF-8" },
                body: JSON.stringify({
                    email: email,
                    password: pass,
                }),
            };

            fetch(getKatalonAPI().signin, options)
                .then((rp) => rp.json())
                .then(async(rs) => {
                    if (!rs.errors) {
                        rs.email = email;
                        let result = await browser.storage.local.get('segment');
                        if (result.segment) {
                            result.segment.user = rs.email;
                            browser.storage.local.set(result);
                        }
                        result = await browser.storage.local.get('hubspot');
                        if (result.hubspot) {
                            result.hubspot.user = rs.email;
                        } else {
                            result = {
                                hubspot: {
                                    user: rs.email
                                }
                            }
                        }
                        browser.storage.local.set(result);

                        // focus input
                        // $("#email-signin").val("");
                        // $("#email-signin").focus();
                        // $("#pass-signin").val("");
                        // $("#pass-signin").focus();
                        $("#error-login2").html('');
                        $("#sign-in").text("Sign in");

                        await setUserLogin(rs, true);

                    } else {
                        $("#sign-in").text("Sign-in");
                        $("#error-login1")
                            .css("color", "#ff0000d6")
                            .text("Wrong username or password, please try again.");
                    }
                });
        }
    });

    $("#ignore-2").click(() => {
        $(dialogSignIn).dialog("close");
    });

    $("#sign-up").click(() => {
        let name = $("#name").val();
        let email = $("#email").val();
        let pass = $("#pass").val();

        if (name == "" || email == "" || pass == "") {
            $("#error-login2").text("Please fill in all the fields.");
        } else {
            // if (new RegExp('^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$').test(pass)) {
            $("#sign-up").text("Processing.....");
            const dataBody = new FormData();
            dataBody.append("user_login", name);
            dataBody.append("user_email", email);
            dataBody.append("user_pass", pass);
            dataBody.append("source_from", "Katalon Recorder");
            dataBody.append("kr_inapp_signup", "Signed Up");

            let options = {
                method: "POST",
                body: dataBody,
            };

            fetch(getKatalonAPI().signup, options)
                .then((rp) => rp.json())
                .then(async(rs) => {
                    if (!rs.error) {
                        segmentTrackingService().then((r) => r.trackingSignup());
                        trackingHubspotSignup();
                        await setUserLogin(rs, false);
                        $("#signup").hide();
                        $("#signin").show();
                    } else {
                        $("#sign-up").text("Sign up");
                        $("#error-login2").text(rs.message);
                    }
                });
        }
    });

    $("#toggle-pass").on("click", function() {
        togglePassword(this);
    });
    $("#toggle-pass1").on("click", function() {
        togglePassword(this);
    });
}



function popupCreateMoreTestCase() {
    let popup = $("#createTestMoreCaseDialog");
    if (popup.length) {
        $(popup).show().effect("shake");
        return;
    }

    let dialogHTML = `
    <div style="text-align:center; font-size: 15px;"><strong>Is it time to automate more?</strong></div>
    </br>
    <span>
    If you need more scenarios, then maybe it's time to sign up for a free account. No pressure though, feel free to modify your existing scenarios to continue your automation.
    </span>
    <style>
        .createTestCaseBtn{
            border-radius: 5px;
            padding: 5px;
            border: none;
            color: black
        }
        #createTestCase-later:hover{
            background-color: #d7dbdb;
        }
        #createTestCase-okay{
            background-color: #3366FF;
            color: white;
            border-radius: 5px;
        }
        #createTestCase-okay:hover{
            background-color: #1d42af;
        }
    </style>
    <div style="margin-top:10px; text-align: right">
        <button id="createTestCase-later" class="createTestCaseBtn" type="button" style="margin-right: 10px"><u>Maybe later</u></button>
        <button id="createTestCase-okay" class="createTestCaseBtn" type="button">Automate more</button>
    </div>`;

    popup = $('<div id="createTestMoreCaseDialog"></div>').css({
        'position': 'absolute',
        'display': 'none',
        'bottom': '50px',
        'z-index': '1',
        'background-color': '#f1f1f1',
        'max-width': '300px',
        'box-shadow': '0px 8px 16px 0px rgba(0,0,0,0.2)',
        'padding': '10px',
        'margin-bottom': '-1%',
        'right': '0',
        'color': "black"

    }).html(dialogHTML);
    $("body").append(popup);

    $("#createTestCase-later").click(function() {
        $(popup).hide();
    });

    $("#createTestCase-okay").click(function() {
        setLoginOrSignup();
        $(popup).hide();
    });
    $(popup).show().effect("shake")

}

export async function getCheckLoginData() {
    let createTestCaseThreshold;
    let result = await browser.storage.local.get("checkLoginData");
    if (!result.checkLoginData) {
        createTestCaseThreshold = getTestCaseThreshold();
        result = {
            checkLoginData: {
                recordTimes: 0,
                playTimes: 0,
                hasLoggedIn: false,
                user: "",
                isActived: false,
                testCreated: 0,
                createTestCaseThreshold
            },
        };
    }
    browser.storage.local.set(result);
    return result;
}


export async function checkLoginOrSignupUserForCreateTestCase() {
  let createTestCaseThreshold;
  const result = await getCheckLoginData();
  let checkLoginData = result.checkLoginData;
  createTestCaseThreshold = checkLoginData.createTestCaseThreshold;

  const onboardingChoice = (
    await browser.storage.local.get("onBoardingUserChoice")
  ).onBoardingUserChoice;

  if (
    !checkLoginData.isActived &&
    checkLoginData.testCreated >= createTestCaseThreshold &&
    !onboardingChoice?.use_case?.includes("Kickstart test automation")
  ) {
    popupCreateMoreTestCase();
    trackingSegment("kru-quota_hit", {
      type: "no_test_case",
      count: createTestCaseThreshold,
    });
    return false;
  }
  if (!checkLoginData.playTimes) {
    checkLoginData.playTimes = 0;
  }
  checkLoginData.playTimes++;
  browser.storage.local.set(result);
  return true;
}

function getTestCaseThreshold() {
    return 2;
    const random = Math.random();
    if (random < 0.33) {
        return 1;
    } else if (random >= 0.33 && random < 0.66) {
        return 3;
    } else {
        return 5;
    }
}

export {
    setLoginOrSignup
}