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
}
