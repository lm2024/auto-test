package com.autotest.service;

import com.autotest.model.dto.BrowserAction;
import java.util.List;
import java.util.Map;

public interface BrowserScriptService {
    List<BrowserAction> generateScript(String naturalLang, String targetUrl);
    Map<String, String> analyzeScreenshot(String screenshotBase64, String taskDescription);
}
