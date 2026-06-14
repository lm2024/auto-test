class NotificationDialog {
    constructor({
                    message = "",
                    height = 36,
                    width = 200,
                    top = 10,
                    left = 0,
                    duration = 1000,
                }) {
        this.message = message;
        this.height = height;
        this.width = width;
        this.top = top;
        this.left = left;
        this.duration = duration;
    }

    async display() {
        const div = $("<div id='notification-dialog'></div>").html(this.message);
        div.css("min-width", this.width).css("min-height", this.height).css("top", this.top).css("left", window.innerWidth/2 - this.width/2);
        document.body.appendChild(div[0]);

        setTimeout(() => {
            div.remove();
        }, this.duration)
    }


}

export { NotificationDialog }