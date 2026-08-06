package com.autotest.mapper;

import com.autotest.model.entity.TestDataPoolRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TestDataPoolRowMapper {
    int insert(TestDataPoolRow row);
    int batchInsert(@Param("list") List<TestDataPoolRow> rows);
    int update(TestDataPoolRow row);
    int deleteById(@Param("id") Long id);
    int deleteByPoolId(@Param("poolId") Long poolId);
    TestDataPoolRow selectById(@Param("id") Long id);
    List<TestDataPoolRow> selectByPoolId(@Param("poolId") Long poolId,
                                         @Param("offset") int offset,
                                         @Param("pageSize") int pageSize);
    TestDataPoolRow selectByPoolIdAndRowIndex(@Param("poolId") Long poolId,
                                              @Param("rowIndex") int rowIndex);
    int countByPoolId(@Param("poolId") Long poolId);
}
