package com.autotest.mapper;

import com.autotest.model.vo.CallGraphRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

/**
 * 调用关系图查询 Mapper，只做只读聚合查询，不改动既有节点/链路 Mapper。
 */
@Mapper
public interface CallGraphMapper {

    /**
     * 查询节点调用记录，chainCode 为空时查全部链路
     */
    List<CallGraphRow> selectCallRows(@Param("chainCode") String chainCode,
                                      @Param("keyword") String keyword,
                                      @Param("scope") String scope,
                                      @Param("method") String method,
                                      @Param("category") String category,
                                      @Param("offset") int offset,
                                      @Param("limit") int limit);

    List<CallGraphRow> selectGraphRows(@Param("chainCode") String chainCode,
                                       @Param("keyword") String keyword,
                                       @Param("scope") String scope,
                                       @Param("method") String method,
                                       @Param("category") String category,
                                       @Param("limit") int limit);

    int countCallRows(@Param("chainCode") String chainCode,
                      @Param("keyword") String keyword,
                      @Param("scope") String scope,
                      @Param("method") String method,
                      @Param("category") String category);

    int countDistinctSystems(@Param("chainCode") String chainCode,
                             @Param("keyword") String keyword,
                             @Param("scope") String scope,
                             @Param("method") String method,
                             @Param("category") String category);

    List<Map<String, Object>> selectScopeStats(@Param("chainCode") String chainCode, @Param("keyword") String keyword, @Param("scope") String scope, @Param("method") String method, @Param("category") String category);
    List<Map<String, Object>> selectMethodStats(@Param("chainCode") String chainCode, @Param("keyword") String keyword, @Param("scope") String scope, @Param("method") String method, @Param("category") String category);
    List<Map<String, Object>> selectChainStats(@Param("chainCode") String chainCode, @Param("keyword") String keyword, @Param("scope") String scope, @Param("method") String method, @Param("category") String category);
    List<Map<String, Object>> selectSystemStats(@Param("chainCode") String chainCode, @Param("keyword") String keyword, @Param("scope") String scope, @Param("method") String method, @Param("category") String category);
}
