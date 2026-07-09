package com.autotest.mapper;

import com.autotest.model.entity.DictCategory;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DictCategoryMapper {
    int insert(DictCategory category);
    int update(DictCategory category);
    int deleteById(@Param("id") Long id);
    DictCategory selectById(@Param("id") Long id);
    List<DictCategory> selectByType(@Param("categoryType") String categoryType,
                                     @Param("offset") int offset, @Param("pageSize") int pageSize);
    int countByType(@Param("categoryType") String categoryType);
    List<DictCategory> selectAll(@Param("offset") int offset, @Param("pageSize") int pageSize);
    int countAll();
}