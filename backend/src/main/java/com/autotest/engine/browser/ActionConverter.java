package com.autotest.engine.browser;

import com.autotest.model.dto.BrowserAction;

public class ActionConverter {

    public static BrowserAction fromMacroAction(com.alibaba.fastjson.JSONObject macro) {
        BrowserAction action = new BrowserAction();
        String type = macro.getString("type");
        action.setActionType(type);
        action.setDescription(type + " " + macro.getString("pageUrl"));

        com.alibaba.fastjson.JSONObject element = macro.getJSONObject("element");
        if (element != null) {
            action.setTargetSelector(element.getString("selector"));
        }

        if ("navigate".equals(type)) {
            action.setTargetUrl(macro.getString("url"));
        } else if ("input".equals(type)) {
            action.setValue(macro.getString("value"));
        } else if ("select".equals(type)) {
            action.setValue(macro.getString("value"));
        } else if ("check".equals(type)) {
            action.setValue(String.valueOf(macro.getBooleanValue("checked")));
        } else if ("keypress".equals(type)) {
            action.setValue(macro.getString("key"));
        }

        action.setWaitDelayMs(500);
        action.setTimeoutMs(10000);
        return action;
    }
}
