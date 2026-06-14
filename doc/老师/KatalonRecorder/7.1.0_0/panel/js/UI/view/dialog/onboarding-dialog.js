import { generateUUID } from "../../services/helper-service/utils.js";

class OnBoardingDialog {
  constructor({
    id = generateUUID(),
    content = "",
    contentClass = "default",
    pageNum = 0,
    pageTotal = 0,
    attachEvent = function () {
    },
    onSkip,
    onNext,
    isPrivacyDialog = false
  }) {
    this.id = id;
    this.content = content;
    this.contentClass = contentClass;
    this.pageNum = pageNum;
    this.pageTotal = pageTotal;
    this.attachEvent = attachEvent;
    this.onNext = onNext;
    this.onSkip = onSkip;
    this.isPrivacyDialog = isPrivacyDialog;
    this.html = this._generateHTML(content);
  }

  _generateHTML() {
    const nextButtonContent = this.pageNum === this.pageTotal ? "Start the tour now" : "Next";
    let buttonHTML = `<button class="nextBtn disabled"><img src="icons/arrow-right.svg" style="float: right;padding: 3px 4px;"/>${nextButtonContent}</button>`;
    if (this.isPrivacyDialog) {
      buttonHTML = `
            <button class="nextBtn yesBtn">Yes</button>
            <button class="nextBtn noBtn">No</button>
        `
    }

    /*** OLD ***/
    // return `
    // <div class="header"> </div>
    // <div class="content ${this.contentClass}">
    //   ${this.content}
    // </div>
    // <div class="footer">
    //   <div class="progress-bar">
    //       <progress value="${this.pageNum}" max="${this.pageTotal}"></progress> 
    //       <span>${this.pageNum}/${this.pageTotal}</span>
    //   </div>
    //   ${buttonHTML}
    // </div>`

    /*** NEW ***/
    // for KR-435: https://katalon.atlassian.net/browse/KR-435
    return `
    <div class="header"> </div>
    <div class="content ${this.contentClass}">
      ${this.content}
    </div>
    <div class="footer">
      ${buttonHTML}
    </div>`
  }

  async render() {
    const self = this;
    this.dialog = $(`<div id=${this.id}></div>`)
      .html(this.html)
      .dialog({
        autoOpen: true,
        dialogClass: 'onboadingDialog',
        resizable: true,
        height: 438,
        width: 600,
        modal: true,
        draggable: false,
        open: function () {
          $('.ui-widget-overlay').addClass("dim-overlay");
        },
        close: function () {
          self.close();
        }
      }).parent()
      .draggable();
    await this.attachDefaultEvent();
    await this.attachEvent();
  }

  async close() {
    this.dialog.find("div.ui-dialog-content").dialog('destroy').remove()
  }

  async attachDefaultEvent() {
    const self = this;
    $(this.dialog).find(".skipBtn").click(function () {
      if (self.onSkip === undefined) {
        self.close();
        return;
      }
      self.onSkip();
    });
    $(this.dialog).find(".nextBtn").click(function () {
      if ($(this).hasClass("disabled")) return;
      if (self.onNext === undefined) {
        self.close();
        return;
      }
      self.onNext();
    });
    $(this.dialog).find(".yesBtn").click(async function () {
      const settingData = await browser.storage.local.get("setting");
      settingData.setting.tracking = true;
      browser.storage.local.set({ setting: settingData.setting });
    });
    $(this.dialog).find(".noBtn").click(async function () {
      const settingData = await browser.storage.local.get("setting");
      settingData.setting.tracking = false;
      browser.storage.local.set({ setting: settingData.setting });

    })
  }
}

export { OnBoardingDialog }


