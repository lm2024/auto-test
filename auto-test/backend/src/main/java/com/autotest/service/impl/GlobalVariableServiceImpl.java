package com.autotest.service.impl;

import com.autotest.mapper.TestGlobalVariableMapper;
import com.autotest.model.entity.TestGlobalVariable;
import com.autotest.service.GlobalVariableService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 全局/链路变量服务实现，提供增删改查与变量 map 合并能力。
 */
@Service
public class GlobalVariableServiceImpl implements GlobalVariableService {

    private static final Logger log = LoggerFactory.getLogger(GlobalVariableServiceImpl.class);

    private static final String SCOPE_GLOBAL = "GLOBAL";
    private static final String SCOPE_CHAIN = "CHAIN";

    @Autowired
    private TestGlobalVariableMapper variableMapper;

    @Override
    public List<TestGlobalVariable> listVariables(String chainCode, String scope) {
        String queryScope = isBlank(scope) ? null : scope.trim().toUpperCase();
        String queryChainCode = isBlank(chainCode) ? null : chainCode.trim();
        // 仅当明确查询链路级变量时才按 chainCode 过滤
        if (!SCOPE_CHAIN.equals(queryScope)) {
            queryChainCode = null;
        }
        List<TestGlobalVariable> list = variableMapper.selectList(queryScope, queryChainCode);
        return list == null ? new ArrayList<TestGlobalVariable>() : list;
    }

    @Override
    public TestGlobalVariable saveVariable(TestGlobalVariable variable) {
        if (variable == null) {
            throw new IllegalArgumentException("变量对象不能为空");
        }
        if (isBlank(variable.getVarName())) {
            throw new IllegalArgumentException("变量名不能为空");
        }
        normalize(variable);

        if (variable.getId() == null) {
            variableMapper.insert(variable);
        } else {
            variableMapper.update(variable);
        }
        TestGlobalVariable saved = variableMapper.selectById(variable.getId());
        return saved != null ? saved : variable;
    }

    @Override
    public void deleteVariable(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("变量ID不能为空");
        }
        variableMapper.deleteById(id);
    }

    @Override
    public Map<String, String> loadVariableMap(String chainCode) {
        Map<String, String> result = new HashMap<String, String>();
        try {
            List<TestGlobalVariable> globals = variableMapper.selectGlobalList();
            if (globals != null) {
                for (TestGlobalVariable item : globals) {
                    result.put(item.getVarName(), item.getVarValue() == null ? "" : item.getVarValue());
                }
            }
            if (!isBlank(chainCode)) {
                List<TestGlobalVariable> chainVars = variableMapper.selectChainList(chainCode.trim());
                if (chainVars != null) {
                    // 链路级同名变量覆盖全局级
                    for (TestGlobalVariable item : chainVars) {
                        result.put(item.getVarName(), item.getVarValue() == null ? "" : item.getVarValue());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[Variable] 加载变量失败: chainCode={}, {}", chainCode, e.getMessage());
        }
        return result;
    }

    /**
     * 补齐默认值：作用域、链路编码、变量类型、加密标记
     */
    private void normalize(TestGlobalVariable variable) {
        String scope = isBlank(variable.getVarScope()) ? SCOPE_GLOBAL : variable.getVarScope().trim().toUpperCase();
        if (!SCOPE_GLOBAL.equals(scope) && !SCOPE_CHAIN.equals(scope)) {
            scope = SCOPE_GLOBAL;
        }
        variable.setVarScope(scope);

        if (SCOPE_CHAIN.equals(scope)) {
            if (isBlank(variable.getChainCode())) {
                throw new IllegalArgumentException("链路级变量必须指定 chainCode");
            }
            variable.setChainCode(variable.getChainCode().trim());
        } else {
            variable.setChainCode("");
        }

        variable.setVarName(variable.getVarName().trim());
        if (isBlank(variable.getVarType())) {
            variable.setVarType("STRING");
        }
        if (variable.getIsEncrypted() == null) {
            variable.setIsEncrypted(0);
        }
    }

    private boolean isBlank(String text) {
        return text == null || text.trim().isEmpty();
    }
}
