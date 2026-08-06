package com.autotest.mapper;

import com.autotest.model.entity.TestDataPool;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TestDataPoolMapper {
    int insert(TestDataPool pool);
    int update(TestDataPool pool);
    int deleteById(@Param("id") Long id);
    int deleteRowsByPoolId(@Param("poolId") Long poolId);
    TestDataPool selectById(@Param("id") Long id);
    TestDataPool selectByPoolCode(@Param("poolCode") String poolCode);
    List<TestDataPool> selectList(@Param("tenantId") Long tenantId,
                                  @Param("productCode") String productCode,
                                  @Param("poolName") String poolName,
                                  @Param("status") Integer status,
                                  @Param("offset") int offset,
                                  @Param("pageSize") int pageSize);
    int countList(@Param("tenantId") Long tenantId,
                  @Param("productCode") String productCode,
                  @Param("poolName") String poolName,
                  @Param("status") Integer status);
    int countRows(@Param("poolId") Long poolId);
}
