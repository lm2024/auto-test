package com.autotest.service;

import com.autotest.model.entity.TestGlobalVariable;

import java.util.List;
import java.util.Map;

/**
 * 全局/链路变量服务接口。
 */
public interface GlobalVariableService {

    /**
     * 变量列表，scope 为空查全部；scope=CHAIN 时按 chainCode 过滤
     */
    List<TestGlobalVariable> listVariables(String chainCode, String scope);

    /**
     * 保存变量，id 为空则新增，否则更新，返回保存后的行
     */
    TestGlobalVariable saveVariable(TestGlobalVariable variable);

    /**
     * 按主键删除变量
     */
    void deleteVariable(Long id);

    /**
     * 加载「全局变量 + 指定链路变量」合并后的 map，链路级同名覆盖全局级
     */
    Map<String, String> loadVariableMap(String chainCode);
}
