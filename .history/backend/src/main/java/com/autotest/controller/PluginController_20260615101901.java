package com.autotest.controller;

import com.autotest.model.dto.PluginChainAppendDTO;
import com.autotest.model.dto.PluginChainCreateDTO;
import com.autotest.model.vo.ChainVO;
import com.autotest.model.vo.Result;
import com.autotest.service.ChainService;
import com.autotest.service.NodeConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.*;

@RestController
@RequestMapping("/api/plugin")
public class PluginController {

    @Autowired
    private ChainService chainService;

    @Autowired
    private NodeConfigService nodeConfigService;

    @PostMapping("/chain/create")
    public Result<?> createChainByPlugin(@Valid @RequestBody PluginChainCreateDTO dto) {
        ChainVO vo = chainService.pluginCreateChain(dto);
        List<NodeConfigService.DependencyRelation> relations = nodeConfigService.identifyDependencies(vo.getChainCode());

        Map<String, Object> data = new HashMap<>();
        data.put("chainId", vo.getChainId());
        data.put("chainCode", vo.getChainCode());
        data.put("nodeList", vo.getNodeList());
        data.put("dependencyRelations", relations);
        return Result.success(data);
    }

    @PostMapping("/chain/append")
    public Result<?> appendChainByPlugin(@Valid @RequestBody PluginChainAppendDTO dto) {
        ChainVO vo = chainService.pluginAppendChain(dto);

        Map<String, Object> data = new HashMap<>();
        data.put("chainCode", vo.getChainCode());
        data.put("totalNodes", vo.getNodeCount());
        data.put("newNodes", vo.getNodeList());
        return Result.success(data);
    }

    @GetMapping("/chain/list")
    public Result<?> getChainList(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String method,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "20") int pageSize) {
        // keyword搜索链路名称
        List<ChainVO> allChains = chainService.listChains(keyword, null);

        // 分页
        int total = allChains.size();
        int start = (pageNum - 1) * pageSize;
        int end = Math.min(start + pageSize, total);
        List<ChainVO> pageList = start < total ? allChains.subList(start, end) : new ArrayList<>();

        Map<String, Object> data = new HashMap<>();
        data.put("total", total);
        data.put("list", pageList);
        return Result.success(data);
    }

    @GetMapping("/chain/detail")
    public Result<?> getChainDetail(@RequestParam String chainCode) {
        ChainVO vo = chainService.getChainDetail(chainCode);
        return Result.success(vo);
    }

    @GetMapping("/config")
    public Result<?> getPluginConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("methods", Arrays.asList("GET", "POST", "PUT", "DELETE"));
        config.put("nodeTypes", Arrays.asList("HTTP"));
        config.put("defaultBodyType", "application/json");
        config.put("defaultParallelGroup", "");
        config.put("maxInterfacesPerPush", 200);
        return Result.success(config);
    }
}
