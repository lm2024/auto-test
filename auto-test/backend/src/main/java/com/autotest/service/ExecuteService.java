package com.autotest.service;

import com.autotest.engine.plan.ExecutionPlan;
import com.autotest.model.vo.ExecuteMainVO;
import com.autotest.model.vo.NodeExecuteLogVO;

import java.util.List;

public interface ExecuteService {
    String runChain(String chainCode);
    String runChainWithParams(String chainCode, int roundIndex, String taskExecutionId);
    String runChain(String chainCode, String traceId, boolean parallel);
    String runChain(String chainCode, String traceId, boolean parallel, Long userId, String operatorName);
    ExecutionPlan parseChain(String chainCode);
    ExecuteMainVO getExecuteStatus(String executionId);
    List<NodeExecuteLogVO> getNodeLogs(String executionId);
    List<ExecuteMainVO> listExecuteRecords(String chainCode, String status,
                                            String startTime, String endTime,
                                            List<Long> categoryIds, int pageNo, int pageSize);
    int countExecuteRecords(String chainCode, String status, String startTime, String endTime, List<Long> categoryIds);
}
