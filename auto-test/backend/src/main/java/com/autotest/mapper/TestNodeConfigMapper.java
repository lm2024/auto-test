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
    int getMaxNodeId(@Param("chainCode") String chainCode);
    int countByChainCode(@Param("chainCode") String chainCode);

    /**
     * 按 bizOperTraceId 分组查询节点
     */
    List<TestNodeConfig> selectByTraceId(@Param("chainCode") String chainCode,
                                          @Param("bizOperTraceId") String bizOperTraceId);

    /**
     * 查询指定链路的全部 TraceId 列表
     */
    List<String> selectTraceIdsByChainCode(@Param("chainCode") String chainCode);
}
