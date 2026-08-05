package com.autotest.mapper;

import com.autotest.model.entity.TestGlobalVariable;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 全局/链路变量 Mapper。
 */
@Mapper
public interface TestGlobalVariableMapper {

    int insert(TestGlobalVariable variable);

    int update(TestGlobalVariable variable);

    int deleteById(@Param("id") Long id);

    TestGlobalVariable selectById(@Param("id") Long id);

    /**
     * 按作用域/链路查询，scope 与 chainCode 均可为空
     */
    List<TestGlobalVariable> selectList(@Param("scope") String scope,
                                        @Param("chainCode") String chainCode);

    /**
     * 查询全局变量（var_scope = GLOBAL）
     */
    List<TestGlobalVariable> selectGlobalList();

    /**
     * 查询指定链路的链路级变量（var_scope = CHAIN）
     */
    List<TestGlobalVariable> selectChainList(@Param("chainCode") String chainCode);
}
