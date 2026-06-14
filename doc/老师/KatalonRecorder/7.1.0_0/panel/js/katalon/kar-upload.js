function showBackupDisabledStatus() {
  $("#ka-upload").addClass("disable");
  updateBackupStatus(
    `<a href="#" target="_blank" class="katalon-link" id="testOps-login">Sign in</a> to enable automatic backup.`
  );
  $("#backup-restore-btn").hide();
  $("#backup-refresh-btn").show();

  $("#testOps-login").click(async (e) => {
    e.preventDefault();
    const AuthService = (
      await import("../UI/services/auth-service/auth-service.js")
    ).default;
    await AuthService.openUniversalLoginUrl();
  });
}

function showBackupEnabledStatus() {
  $("#ka-upload").removeClass("disable");
  var TestOpsKatalonRecorderBackup =
    testOpsEndpoint + "/user/katalon-recorder-backup";
  updateBackupStatus(
    `Your data is safely stored <a href="${TestOpsKatalonRecorderBackup}" target="_blank" class="katalon-link">here</a>.`
  );
  $("#backup-restore-btn").show();
  $("#backup-refresh-btn").hide();
}

function updateBackupStatus(html) {
  $("#backup-status").html(html);
}

function backupData() {
  return browser.storage.local.set({ firstTime: false }).then(function () {
    browser.storage.local.get(null).then(function (result) {
      $.ajax({
        url: testOpsUrls.getUploadUrlAvatar,
        type: "GET",
        success: function (response) {
          var path = response.path;
          var uploadUrl = response.uploadUrl;
          var data = JSON.stringify(result);

          $.ajax({
            url: uploadUrl,
            type: "PUT",
            contentType: "text/plain",
            data: data,
            success: function () {
              $.ajax({
                url: testOpsUrls.uploadBackup,
                type: "POST",
                data: {
                  uploadedPath: path,
                },
                success: function () {
                  showBackupEnabledStatus();
                },
                error: function () {
                  console.log(arguments);
                  showBackupDisabledStatus();
                },
              });
            },
            error: function () {
              console.log(arguments);
              showBackupDisabledStatus();
            },
          });
        },
        error: function () {
          showBackupDisabledStatus();
          console.log(arguments);
        },
      });
    });
  });
}

function uploadTestReportsToTestOps(teamId, projectId, autouploaded) {
  var executionUrl = teamId
    ? `${testOpsEndpoint}/team/${teamId}/project/${projectId}/executions`
    : null;

  $.ajax({
    url: testOpsUrls.getUploadUrl,
    type: "GET",
    data: {
      projectId: projectId,
    },
    success: function (response) {
      var path = response.path;
      var uploadUrl = response.uploadUrl;

      // see save-log button
      var logcontext = "";
      var logcontainer = document.getElementById("logcontainer");
      for (var i = 0; i < logcontainer.childNodes.length; i++) {
        logcontext = logcontext + logcontainer.childNodes[i].textContent + "\n";
      }

      $.ajax({
        url: uploadUrl,
        type: "PUT",
        contentType: "text/plain",
        data: logcontext,
        success: function () {
          $.ajax({
            url: testOpsUrls.uploadTestReports,
            type: "POST",
            data: {
              projectId: projectId,
              batch: new Date().getTime(),
              isEnd: true,
              fileName: "KR-" + new Date().getTime() + ".log",
              uploadedPath: path,
            },
            success: function () {
              if (executionUrl) {
                showTestOpsDialog(
                  "Execution logs have been uploaded successfully. Please give us a few minutes to analyze the data. Thank you!",
                  true
                );
                window.open(executionUrl);
              }
            },
            error: function () {
              console.log(arguments);
              showErrorDialog();
            },
          });
        },
        error: function () {
          console.log(arguments);
          showErrorDialog();
        },
      });
    },
    error: function () {
      console.log(arguments);
      showErrorDialog();
    },
  });
}

function getProjects() {
  return $.ajax({
    url: testOpsUrls.getUserInfo,
    type: "GET",
  }).then((data) => {
    if (data.projects.length === 0) {
      return $.ajax({
        url: testOpsUrls.getFirstProject,
        type: "GET",
      });
    } else {
      return data.projects;
    }
  });
}

function showTestOpsLoginDialog() {
  const dialogHtml = `
                    <span>Please log in to <a target="_blank" href="${testOpsEndpoint}" class="testops-link">Katalon TestOps</a> first and try again.</span>        
                    </br>            
                    <span>Katalon TestOps helps you generate quality, performance and flakiness reports to improve your confidence in evaluating the test results.</span>
                    </br> 
                    <span>When using with Katalon Recorder, Katalon TestOps also helps you backup your entire project to avoid the possibility of data loss.</span>
                    </br> 
                    <span>You can register a completely free account at <a target="_blank" href="${katalonEndpoint}" class="testops-link">katalon.com</a>.</span>
                `;
  showTestOpsDialog(dialogHtml);
}

async function renderUploadDialog(projects) {
  const module = await import("../UI/view/dialog/generic-dialog.js");

  const projectOptions = projects.reduce((prev, project) => {
    prev += `<option value="${project.id}" data-teamId="${project.team.id}">${project.name}</option>`;
    return prev;
  }, "");

  const html = `<label for="select-ka-project">Select a project to upload your logs. You can create new projects at <a
                target="_blank" href="https://analytics.katalon.com" class="katalon-link">Katalon
            TestOps</a>.</label>
        <select id="select-ka-project" style="width: 100%">${projectOptions}</select>`;

  const dialog = new module.GenericDialog({
    id: "uploadReportDialog",
    title: `
                <img class="kto-light" style="max-width: 50%;" src="../../../katalon/images/branding/Katalon-TestOps-full-color-large-w.png" alt="Katalon TestOps" />
                <img class="kto-dark" style="max-width: 50%;" src="../../../katalon/images/branding/Katalon-TestOps-full-color-large.png" alt="Katalon TestOps" />
                `,
    message: html,
    buttons: [
      {
        id: "uploadLogToTestOps-btn",
        text: "Upload",
      },
      {
        id: "uploadLogToTestOps-close-btn",
        text: "Cancel",
      },
    ],
    height: "auto",
    width: 300,
  });
  await dialog.render();
  $("#uploadLogToTestOps-btn").click(function () {
    const select = $("#select-ka-project");
    const projectId = select.val();
    const teamId = select.find(":selected").attr("data-teamId");
    uploadTestReportsToTestOps(teamId, projectId, false);
    dialog.close();
  });
  $("#uploadLogToTestOps-close-btn").click(function () {
    dialog.close();
  });
}

function uploadLogToTestOps() {
  getProjects()
    .then((projects) => {
      renderUploadDialog(projects);
      import(
        "../UI/services/tracking-service/segment-tracking-service.js"
      ).then((module) => {
        module.trackingSegment("kru_open_testops_report", { success: true });
      });
    })
    .catch((e) => {
      console.log(e);
      showTestOpsLoginDialog();
      showBackupDisabledStatus();
      import(
        "../UI/services/tracking-service/segment-tracking-service.js"
      ).then((module) => {
        module.trackingSegment("kru_open_testops_report", { success: false });
      });
    });
}

$(function () {
  function createDefaultProject(email) {
    return $.ajax({
      url: testOpsUrls.createOrganizationUrl,
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        name: `Organization ${email}`,
      }),
    })
      .then((org) => {
        console.log(org);
        return $.ajax({
          url: testOpsUrls.createTeamUrl,
          type: "POST",
          contentType: "application/json",
          data: JSON.stringify({
            name: `Team ${email}`,
            organizationId: org.id,
          }),
        });
      })
      .then((team) => {
        return $.ajax({
          url: testOpsUrls.createProjectUrl,
          type: "POST",
          contentType: "application/json",
          data: JSON.stringify({
            name: `Project ${email}`,
            teamId: team.id,
          }),
        });
      })
      .then((project) => {
        return Promise.resolve([project]);
      });
  }

  $("#ka-upload").click(function () {
    if (!$("#ka-upload").hasClass("disable")) {
      uploadLogToTestOps();
    }
  });
});
