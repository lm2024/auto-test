import { setIsChange } from "../setting-panel.js";

class PrivacySettingTab { //Implements ISettingTab
    constructor(containerElement) {
        this.containerElement = containerElement;
    }

    async initialize() {
        $("#enable-tracking").click(function () {
            setIsChange(true);
        });
    }

    async getContent() {
        const settingData = await browser.storage.local.get("setting");
        const checked = settingData.setting.tracking === true? "checked" : "";
        return `
        <div id="privacy-setting" style="display: none">
            <h1>Privacy</h1>
            <div>
                <input type="checkbox" id="enable-tracking" name="enable-tracking" ${checked}>
                <label for="enable-tracking">Enable tracking</label>
            </div>
        </div> 
        `;
    }

    async saveData() {
        debugger;
        const enable = $("#enable-tracking").prop("checked");
        const settingData = await browser.storage.local.get("setting");
        settingData.setting.tracking = enable;
        browser.storage.local.set({ setting: settingData.setting });
    }

    display() {
        for (let child of $(this.containerElement).children()) {
            $(child).hide();
        }
        $("#privacy-setting").show();
    }
}

export { PrivacySettingTab }