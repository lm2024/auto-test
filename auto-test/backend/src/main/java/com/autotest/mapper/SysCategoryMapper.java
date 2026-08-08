package com.autotest.mapper;

import com.autotest.model.entity.SysCategory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SysCategoryMapper {
    int insert(SysCategory category);
    int update(SysCategory category);
    int deleteById(@Param("id") Long id);
    List<Long> selectDescendantIds(@Param("id") Long id);
    int deleteByIds(@Param("ids") List<Long> ids);
    int deleteByParentId(@Param("parentId") Long parentId);
    SysCategory selectById(@Param("id") Long id);
    List<SysCategory> selectAll(@Param("tenantId") Long tenantId);
    List<SysCategory> selectByParentId(@Param("parentId") Long parentId, @Param("tenantId") Long tenantId);
    List<SysCategory> selectByKeyword(@Param("keyword") String keyword, @Param("tenantId") Long tenantId,
                                      @Param("limit") int limit);
    int countByParentId(@Param("parentId") Long parentId, @Param("tenantId") Long tenantId);
    int updateSort(@Param("id") Long id, @Param("sortOrder") Integer sortOrder);
}
