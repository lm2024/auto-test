package com.autotest.mapper;

import com.autotest.model.entity.TestNodeExecuteLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TestNodeExecuteLogMapper {
    int batchInsert(@Param("list") List<TestNodeExecuteLog> list);
    List<TestNodeExecuteLog> selectByExecutionId(@Param("executionId") String executionId);
    TestNodeExecuteLog selectByExecutionAndNode(@Param("executionId") String executionId, @Param("nodeCode") String nodeCode);
}
