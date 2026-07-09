package com.autotest.controller;

import com.autotest.model.dto.FailureAnalyzeDTO;
import com.autotest.model.dto.TestDataGenerateDTO;
import com.autotest.model.vo.Result;
import com.autotest.service.AiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    @Autowired
    private AiService aiService;

    @PostMapping("/data/generate")
    public Result<?> generateTestData(@RequestBody TestDataGenerateDTO dto) {
        Map<String, Object> data = aiService.generateTestData(dto);
        return Result.success(data);
    }

    @PostMapping("/failure/analyze")
    public Result<?> analyzeFailure(@RequestBody FailureAnalyzeDTO dto) {
        Map<String, String> analysis = aiService.analyzeFailure(dto);
        return Result.success(analysis);
    }
}
