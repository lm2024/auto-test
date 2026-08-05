package com.autotest.controller;

import com.autotest.model.vo.CallGraphVO;
import com.autotest.model.vo.Result;
import com.autotest.service.CallGraphService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 系统调用关系图接口。
 */
@RestController
@RequestMapping("/api/call-graph")
public class CallGraphController {

    @Autowired
    private CallGraphService callGraphService;

    @GetMapping("/data")
    public Result<CallGraphVO> data(@RequestParam(required = false) String chainCode) {
        try {
            return Result.success(callGraphService.buildCallGraph(chainCode));
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }
}
