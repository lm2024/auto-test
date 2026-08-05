package com.autotest.service;

import com.autotest.model.vo.CallGraphVO;

/**
 * 系统调用关系图服务接口。
 */
public interface CallGraphService {

    /**
     * 构建调用关系图数据，chainCode 为空时统计全部链路
     */
    CallGraphVO buildCallGraph(String chainCode);
}
