package com.autotest.controller;

import com.autotest.model.entity.TestGlobalVariable;
import com.autotest.model.vo.Result;
import com.autotest.service.GlobalVariableService;
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
 * 全局/链路变量管理接口。
 */
@RestController
@RequestMapping("/api/variable")
public class GlobalVariableController {

    @Autowired
    private GlobalVariableService globalVariableService;

    @GetMapping("/list")
    public Result<List<TestGlobalVariable>> list(@RequestParam(required = false) String chainCode,
                                                 @RequestParam(required = false) String scope) {
        try {
            return Result.success(globalVariableService.listVariables(chainCode, scope));
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    @PostMapping("/save")
    public Result<TestGlobalVariable> save(@RequestBody TestGlobalVariable variable) {
        try {
            return Result.success(globalVariableService.saveVariable(variable));
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }

    @PostMapping("/delete")
    public Result<Void> delete(@RequestBody Map<String, Object> params) {
        try {
            Object idValue = params == null ? null : params.get("id");
            if (idValue == null) {
                return Result.error("变量ID不能为空");
            }
            globalVariableService.deleteVariable(Long.valueOf(String.valueOf(idValue)));
            return Result.success();
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }
}
