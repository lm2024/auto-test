package com.autotest.service;

import com.autotest.engine.plan.ExecutionPlan;
import com.autotest.model.vo.ExecuteMainVO;
import com.autotest.model.vo.NodeExecuteLogVO;

import java.util.List;

public interface ExecuteService {
    String runChain(String chainCode);
    ExecutionPlan parseChain(String chainCode);
    ExecuteMainVO getExecuteStatus(String executionId);
    List<NodeExecuteLogVO> getNodeLogs(String executionId);
    List<ExecuteMainVO> listExecuteRecords(String chainCode, String status,
                                            String startTime, String endTime,
                                            int pageNo, int pageSize);
}
