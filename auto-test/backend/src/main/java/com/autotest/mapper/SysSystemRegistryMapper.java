package com.autotest.mapper;

import com.autotest.model.entity.SysSystemRegistry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 系统注册表 Mapper。
 */
@Mapper
public interface SysSystemRegistryMapper {

    int insert(SysSystemRegistry registry);

    int update(SysSystemRegistry registry);

    int deleteById(@Param("id") Long id);

    SysSystemRegistry selectById(@Param("id") Long id);

    SysSystemRegistry selectBySystemCode(@Param("systemCode") String systemCode);

    List<SysSystemRegistry> selectAll();
}
