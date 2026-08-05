package com.autotest.service;

import com.autotest.model.dto.NodeDebugRequest;
import com.autotest.model.vo.NodeDebugResult;

/**
 * 单节点调试服务接口。
 */
public interface NodeDebugService {

    /**
     * 执行一次单节点 HTTP 调试，异常不抛出，写入结果的 error 字段
     */
    NodeDebugResult debug(NodeDebugRequest request);
}
