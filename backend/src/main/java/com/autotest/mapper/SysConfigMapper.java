package com.autotest.mapper;

import com.autotest.model.entity.SysConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SysConfigMapper {
    SysConfig selectByKey(@Param("configKey") String configKey);
    java.util.List<SysConfig> selectAll();
    int insertOrUpdate(SysConfig config);
}
