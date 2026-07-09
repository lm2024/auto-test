package com.autotest.service;

import com.autotest.model.dto.FailureAnalyzeDTO;
import com.autotest.model.dto.TestDataGenerateDTO;

import java.util.Map;

public interface AiService {
    Map<String, Object> generateTestData(TestDataGenerateDTO dto);
    Map<String, String> analyzeFailure(FailureAnalyzeDTO dto);
}
