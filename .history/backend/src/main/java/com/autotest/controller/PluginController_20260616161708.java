package com.autotest.controller;

import com.autotest.mapper.TestNodeConfigMapper;
import com.autotest.model.dto.PluginChainAppendDTO;
import com.autotest.model.dto.PluginChainCreateDTO;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.vo.ChainVO;
import com.autotest.model.vo.NodeVO;
import com.autotest.model.vo.Result;
import com.autotest.service.ChainService;
import com.autotest.service.NodeConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/plugin")
public class PluginController {

    @Autowired
    private ChainService chainService;

    @Autowired
    private NodeConfigService nodeConfigService;

    @Autowired
    private TestNodeConfigMapper nodeConfigMapper;

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

    /**
     * 按 bizOperTraceId 分组查询已推送的链路节点
     */
    @GetMapping("/trace/list")
    public Result<?> getTraceList(
            @RequestParam String chainCode,
            @RequestParam(required = false) String bizOperTraceId) {
        List<TestNodeConfig> nodes;
        if (bizOperTraceId != null && !bizOperTraceId.isEmpty()) {
            nodes = nodeConfigMapper.selectByTraceId(chainCode, bizOperTraceId);
        } else {
            nodes = nodeConfigMapper.selectByChainCode(chainCode);
        }

        // 按 bizOperTraceId 分组
        Map<String, List<NodeVO>> grouped = nodes.stream()
                .filter(n -> n.getBizOperTraceId() != null)
                .collect(Collectors.groupingBy(
                    TestNodeConfig::getBizOperTraceId,
                    LinkedHashMap::new,
                    Collectors.mapping(this::toNodeVO, Collectors.toList())
                ));

        // 获取所有 TraceId 列表
        List<String> traceIds = nodeConfigMapper.selectTraceIdsByChainCode(chainCode);

        Map<String, Object> data = new HashMap<>();
        data.put("traceIds", traceIds);
        data.put("groupedNodes", grouped);
        return Result.success(data);
    }

    /**
     * 按 TraceId 分组推送（改造现有 create/append）
     */
    @PostMapping("/trace/push")
    public Result<?> pushByTraceId(@Valid @RequestBody PluginChainCreateDTO dto) {
        ChainVO vo = chainService.pluginCreateChain(dto);
        List<NodeConfigService.DependencyRelation> relations = nodeConfigService.identifyDependencies(vo.getChainCode());

        Map<String, Object> data = new HashMap<>();
        data.put("chainId", vo.getChainId());
        data.put("chainCode", vo.getChainCode());
        data.put("nodeList", vo.getNodeList());
        data.put("dependencyRelations", relations);

        // 按 TraceId 分组统计
        if (dto.getInterfaceList() != null) {
            Map<String, Long> traceCount = dto.getInterfaceList().stream()
                    .filter(iface -> iface.getBizOperTraceId() != null)
                    .collect(Collectors.groupingBy(
                        com.autotest.model.dto.PluginInterfaceDTO::getBizOperTraceId,
                        Collectors.counting()
                    ));
            data.put("traceCount", traceCount);
        }

        return Result.success(data);
    }

    @GetMapping("/config")
    public Result<?> getPluginConfig() {
        Map<String, Object> config = new HashMap<>();
        config.put("methods", Arrays.asList("GET", "POST", "PUT", "DELETE"));
        config.put("nodeTypes", Arrays.asList("HTTP"));
        config.put("defaultBodyType", "application/json");
        config.put("defaultParallelGroup", "");
        config.put("maxInterfacesPerPush", 200);
        config.put("traceEnabled", true);
        return Result.success(config);
    }

    private NodeVO toNodeVO(TestNodeConfig node) {
        NodeVO vo = new NodeVO();
        vo.setId(node.getId());
        vo.setNodeId(node.getNodeId());
        vo.setNodeCode(node.getNodeCode());
        vo.setNodeName(node.getNodeName());
        vo.setNodeType(node.getNodeType());
        vo.setSortNo(node.getSortNo());
        vo.setParallelGroup(node.getParallelGroup());
        vo.setRequestUrl(node.getRequestUrl());
        vo.setRequestMethod(node.getRequestMethod());
        vo.setRequestHeaders(node.getRequestHeaders());
        vo.setBodyType(node.getBodyType());
        vo.setBodyData(node.getBodyData());
        vo.setExtractRules(node.getExtractRules());
        vo.setAssertRules(node.getAssertRules());
        vo.setVariableMapping(node.getVariableMapping());
        vo.setBizOperTraceId(node.getBizOperTraceId());
        vo.setTriggerEvent(node.getTriggerEvent());
        vo.setTargetDom(node.getTargetDom());
        vo.setPageUrl(node.getPageUrl());
        vo.setWindowId(node.getWindowId());
        vo.setIsIgnored(node.getIsIgnored());
        return vo;
    }
}
