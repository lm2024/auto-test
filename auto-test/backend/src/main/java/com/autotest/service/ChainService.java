package com.autotest.service;

import com.autotest.model.dto.*;
import com.autotest.model.entity.TestChain;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.vo.ChainVO;
import com.autotest.model.vo.NodeVO;

import java.util.List;

public interface ChainService {
    ChainVO createChain(ChainCreateDTO dto);
    ChainVO editChain(ChainEditDTO dto);
    void deleteChain(String chainCode);
    List<ChainVO> listChains(String chainName, Integer executeMode);

    List<ChainVO> listChainsByCategory(String chainName, Integer executeMode,
                                         List<String> systemCategories, List<String> funcCategories, Integer priority,
                                         List<Long> categoryIds, int offset, int pageSize);
    int countChainsByCategory(String chainName, Integer executeMode,
                               List<String> systemCategories, List<String> funcCategories, Integer priority,
                               List<Long> categoryIds);
    ChainVO getChainDetail(String chainCode);
    ChainVO copyChain(String chainCode);
    ChainVO pluginCreateChain(PluginChainCreateDTO dto);
    ChainVO pluginAppendChain(PluginChainAppendDTO dto);

    /**
     * 保存 X6 画布数据（编排与执行顺序的唯一真相来源）。
     * 保存前会做一次 DAG 校验，存在环形依赖直接拒绝落库。
     *
     * @return 拓扑分层预览，layers[i] 为第 i 层可并发执行的 nodeCode 列表
     */
    List<List<String>> saveGraph(String chainCode, String graphData);

    /**
     * 只读地取一次拓扑分层，供前端"执行顺序预览"使用
     */
    List<List<String>> previewLayers(String chainCode);
}
