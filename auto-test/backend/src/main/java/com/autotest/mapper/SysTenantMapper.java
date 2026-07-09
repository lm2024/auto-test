package com.autotest.mapper;

import com.autotest.model.entity.SysTenant;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SysTenantMapper {
    int insert(SysTenant tenant);
    int update(SysTenant tenant);
    int deleteById(@Param("id") Long id);
    SysTenant selectById(@Param("id") Long id);
    SysTenant selectByCode(@Param("tenantCode") String tenantCode);
    List<SysTenant> selectAll(@Param("offset") int offset, @Param("pageSize") int pageSize);
    int countAll();
}
