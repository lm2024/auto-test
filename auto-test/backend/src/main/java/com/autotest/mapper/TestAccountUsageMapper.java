package com.autotest.mapper;

import com.autotest.model.entity.TestAccountUsage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TestAccountUsageMapper {
    int insert(TestAccountUsage usage);
    int finishByExecutionId(@Param("executionId") String executionId, @Param("status") String status,
                            @Param("releaseReason") String releaseReason);
    List<TestAccountUsage> selectByAccount(@Param("accountId") Long accountId, @Param("offset") int offset,
                                           @Param("pageSize") int pageSize);
    int countByAccount(@Param("accountId") Long accountId);
}
