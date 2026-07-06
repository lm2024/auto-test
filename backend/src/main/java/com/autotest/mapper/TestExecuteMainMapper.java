package com.autotest.mapper;

import com.autotest.model.entity.TestExecuteMain;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Date;
import java.util.List;

@Mapper
public interface TestExecuteMainMapper {
    int insert(TestExecuteMain record);
    int update(TestExecuteMain record);
    TestExecuteMain selectByExecutionId(@Param("executionId") String executionId);
    List<TestExecuteMain> selectList(@Param("chainCode") String chainCode,
                                     @Param("status") String status,
                                     @Param("startTime") Date startTime,
                                     @Param("endTime") Date endTime,
                                     @Param("offset") int offset,
                                     @Param("pageSize") int pageSize);
    int countList(@Param("chainCode") String chainCode,
                  @Param("status") String status,
                  @Param("startTime") Date startTime,
                  @Param("endTime") Date endTime);
    List<TestExecuteMain> selectListByCategory(@Param("chainCode") String chainCode,
                                               @Param("status") String status,
                                               @Param("startTime") Date startTime,
                                               @Param("endTime") Date endTime,
                                               @Param("categoryId") Long categoryId,
                                               @Param("offset") int offset,
                                               @Param("pageSize") int pageSize);
    int countListByCategory(@Param("chainCode") String chainCode,
                            @Param("status") String status,
                            @Param("startTime") Date startTime,
                            @Param("endTime") Date endTime,
                            @Param("categoryId") Long categoryId);
}
