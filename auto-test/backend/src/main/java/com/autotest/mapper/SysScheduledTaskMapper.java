package com.autotest.mapper;

import com.autotest.model.entity.SysScheduledTask;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SysScheduledTaskMapper {
    int insert(SysScheduledTask task);
    int update(SysScheduledTask task);
    int deleteById(@Param("id") Long id);
    SysScheduledTask selectById(@Param("id") Long id);
    List<SysScheduledTask> selectAll(@Param("tenantId") Long tenantId);
    List<SysScheduledTask> selectEnabled(@Param("tenantId") Long tenantId);
    int countAll(@Param("tenantId") Long tenantId);
    int updateLastRunTime(@Param("id") Long id);
}
