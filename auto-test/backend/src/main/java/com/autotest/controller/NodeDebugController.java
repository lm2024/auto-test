package com.autotest.controller;

import com.autotest.model.dto.NodeDebugRequest;
import com.autotest.model.vo.NodeDebugResult;
import com.autotest.model.vo.Result;
import com.autotest.service.NodeDebugService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 单节点调试接口：不落库，直接发一次请求并返回响应详情。
 */
@RestController
public class NodeDebugController {

    @Autowired
    private NodeDebugService nodeDebugService;

    @PostMapping("/api/node/debug")
    public Result<NodeDebugResult> debug(@RequestBody NodeDebugRequest request) {
        try {
            return Result.success(nodeDebugService.debug(request));
        } catch (Exception e) {
            return Result.error(e.getMessage());
        }
    }
}
