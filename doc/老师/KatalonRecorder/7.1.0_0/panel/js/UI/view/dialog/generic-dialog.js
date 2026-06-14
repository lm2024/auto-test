import {generateUUID} from "../../services/helper-service/utils.js";

class GenericDialog {
  constructor({
                id = generateUUID(),
                html = null,
                buttons = [],
                message = "",
                title = "",
                width = 500,
                height = 500,
                draggable = true,
                modal = true,
                appendTo= "body",
              }) {
    this.buttons = buttons;
    this.message = message;
    this.title = title;
    this.id = id;
    this.html = this._generateHTML(html);
    this.height = height;
    this.width = width;
    this.dialog = null;
    this.draggable = draggable;
    this.modal = modal;
    this.isOpen = false;
    this.appendTo = appendTo;
  }

  _generateHTML(html) {
    if (html !== null) {
      return html;
    }

    let buttonsHTML = "";
    for (const button of this.buttons) {
      buttonsHTML += `<button ${button?.id ? `id=${button.id}` : ""}>${button.text}</button>`;
    }

    return `<div class="header">
        <div class="title">${this.title}</div>
         <button class="dialog-close">
              <img src="/katalon/images/SVG/close-icon.svg" alt="Close"/>
          </button>
    </div>
    <div class="content">
        <div class="message">
            ${this.message}
        </div>
    </div>
    <div class="footer">
        ${buttonsHTML}
    </div>`
  }

  async render() {
    const self = this;
    this.dialog = $(`<div id=${this.id}></div>`)
      .html(this.html)
      .dialog({
        autoOpen: true,
        dialogClass: 'newStyleDialog',
        resizable: true,
        height: `${this.height}`,
        width: `${this.width}`,
        modal: this.modal,
        draggable: false,
        appendTo: this.appendTo,
        open: function () {
          $('.ui-widget-overlay').addClass("dim-overlay");
        },
        close: function () {
          self.close();
        }
      })
    if (this.draggable){
        this.dialog.parent().draggable();
    }

    $(this.dialog).find(".dialog-close").click(()=>{
      this.close();
    });
    this.isOpen = true;
  }

  async close(){
    try{
        $(`#${this.id}`).dialog('destroy').remove();
    } catch (e){
        console.log(e);
    }
    try{
      this.dialog.find("div.ui-dialog-content").dialog('destroy').remove();
    } catch (e){
      console.log(e);
    }
    this.isOpen = false;
  }

}

export { GenericDialog }