package com.autotest.controller;

import com.autotest.mapper.SysConfigMapper;
import com.autotest.model.entity.SysConfig;
import com.autotest.model.vo.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/config")
public class ConfigController {

    @Autowired
    private SysConfigMapper sysConfigMapper;

    @GetMapping("/all")
    public Result<?> getAllConfig() {
        List<SysConfig> configs = sysConfigMapper.selectAll();
        Map<String, String> map = new HashMap<>();
        for (SysConfig c : configs) {
            map.put(c.getConfigKey(), c.getConfigValue());
        }
        return Result.success(map);
    }

    @PostMapping("/save")
    public Result<?> saveConfig(@RequestBody Map<String, String> params) {
        for (Map.Entry<String, String> entry : params.entrySet()) {
            SysConfig config = new SysConfig();
            config.setConfigKey(entry.getKey());
            config.setConfigValue(entry.getValue());
            sysConfigMapper.insertOrUpdate(config);
        }
        return Result.success();
    }

    @GetMapping("/ai")
    public Result<?> getAiConfig() {
        Map<String, String> map = new HashMap<>();
        SysConfig baseUrl = sysConfigMapper.selectByKey("ai.baseUrl");
        SysConfig apiKey = sysConfigMapper.selectByKey("ai.apiKey");
        SysConfig model = sysConfigMapper.selectByKey("ai.model");
        SysConfig timeout = sysConfigMapper.selectByKey("ai.timeout");
        map.put("baseUrl", baseUrl != null ? baseUrl.getConfigValue() : "");
        map.put("apiKey", apiKey != null ? apiKey.getConfigValue() : "");
        map.put("model", model != null ? model.getConfigValue() : "qwen-max");
        map.put("timeout", timeout != null ? timeout.getConfigValue() : "120");
        return Result.success(map);
    }
}
