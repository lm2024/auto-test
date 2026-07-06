package com.autotest.mapper;

import com.autotest.model.entity.SysTaskExecuteLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SysTaskExecuteLogMapper {
    int insert(SysTaskExecuteLog log);
    List<SysTaskExecuteLog> selectByTaskId(@Param("taskId") Long taskId,
                                            @Param("offset") int offset,
                                            @Param("pageSize") int pageSize);
    int countByTaskId(@Param("taskId") Long taskId);
}
