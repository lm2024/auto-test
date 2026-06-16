package com.autotest.mapper;

import com.autotest.model.entity.TestNodeConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TestNodeConfigMapper {
    int insert(TestNodeConfig node);
    int batchInsert(@Param("list") List<TestNodeConfig> list);
    int update(TestNodeConfig node);
    int deleteByChainCode(@Param("chainCode") String chainCode);
    int deleteById(@Param("id") Long id);
    TestNodeConfig selectById(@Param("id") Long id);
    TestNodeConfig selectByNodeCode(@Param("chainCode") String chainCode, @Param("nodeCode") String nodeCode);
    List<TestNodeConfig> selectByChainCode(@Param("chainCode") String chainCode);
    int getMaxSortNo(@Param("chainCode") String chainCode);
    int getMaxNodeId(@Param("chainCode") String chainCode);
    int countByChainCode(@Param("chainCode") String chainCode);
    int incrementSortNoFrom(@Param("chainCode") String chainCode, @Param("fromSortNo") int fromSortNo);
}
