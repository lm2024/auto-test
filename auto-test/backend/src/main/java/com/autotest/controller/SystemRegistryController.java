package com.autotest.controller;

import com.autotest.model.entity.SysSystemRegistry;
import com.autotest.model.vo.ClassifyResult;
import com.autotest.model.vo.Result;
import com.autotest.service.SystemRegistryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 系统注册表管理与接口内外网识别接口。
 */
@RestController
@RequestMapping("/api/system-registry")
public class SystemRegistryController {

    @Autowired
    private SystemRegistryService systemRegistryService;

    @GetMapping("/list")
    public Result<List<SysSystemRegistry>> list() {
        try {
            return Result.success(systemRegistryService.listAll());
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    @PostMapping("/save")
    public Result<SysSystemRegistry> save(@RequestBody SysSystemRegistry registry) {
        try {
            return Result.success(systemRegistryService.saveRegistry(registry));
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    @PostMapping("/delete")
    public Result<Void> delete(@RequestBody Map<String, Object> params) {
        try {
            Object idValue = params == null ? null : params.get("id");
            if (idValue == null) {
                return Result.error("系统ID不能为空");
            }
            systemRegistryService.deleteRegistry(Long.valueOf(String.valueOf(idValue)));
            return Result.success();
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    @GetMapping("/classify")
    public Result<ClassifyResult> classify(@RequestParam(required = false) String url) {
        try {
            return Result.success(systemRegistryService.classify(url));
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }
}
