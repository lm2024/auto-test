package com.autotest.controller;

import com.autotest.model.dto.*;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.vo.*;
import com.autotest.mapper.TestNodeConfigMapper;
import com.autotest.service.ChainService;
import com.autotest.service.ExecuteService;
import com.autotest.service.VersionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chain")
public class ChainController {

    @Autowired
    private ChainService chainService;

    @Autowired
    private VersionService versionService;

    @PostMapping("/create")
    public Result<?> createChain(@Valid @RequestBody ChainCreateDTO dto) {
        ChainVO vo = chainService.createChain(dto);
        Map<String, Object> data = new HashMap<>();
        data.put("chainId", vo.getChainId());
        data.put("chainCode", vo.getChainCode());
        return Result.success(data);
    }

    @PostMapping("/edit")
    public Result<?> editChain(@RequestBody ChainEditDTO dto) {
        ChainVO vo = chainService.editChain(dto);
        return Result.success(vo);
    }

    @PostMapping("/delete")
    public Result<?> deleteChain(@RequestParam String chainCode) {
        chainService.deleteChain(chainCode);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<?> listChains(
            @RequestParam(required = false) String chainName,
            @RequestParam(required = false) Integer executeMode,
            @RequestParam(required = false) String systemCategory,
            @RequestParam(required = false) String funcCategory,
            @RequestParam(required = false) Integer priority,
            @RequestParam(required = false) String categoryId,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        int offset = (pageNo - 1) * pageSize;
        List<String> sysCats = splitCsv(systemCategory);
        List<String> funcCats = splitCsv(funcCategory);
        List<Long> catIds = splitCsvLong(categoryId);
        List<ChainVO> list = chainService.listChainsByCategory(chainName, executeMode, sysCats, funcCats, priority, catIds, offset, pageSize);
        int total = chainService.countChainsByCategory(chainName, executeMode, sysCats, funcCats, priority, catIds);
        Map<String, Object> data = new HashMap<>();
        data.put("list", list);
        data.put("total", total);
        data.put("pageNo", pageNo);
        data.put("pageSize", pageSize);
        return Result.success(data);
    }

    private List<String> splitCsv(String csv) {
        if (csv == null || csv.trim().isEmpty()) return null;
        List<String> result = new ArrayList<>();
        for (String s : csv.split(",")) {
            if (!s.trim().isEmpty()) result.add(s.trim());
        }
        return result.isEmpty() ? null : result;
    }

    private List<Long> splitCsvLong(String csv) {
        if (csv == null || csv.trim().isEmpty()) return null;
        List<Long> result = new ArrayList<>();
        for (String s : csv.split(",")) {
            if (!s.trim().isEmpty()) {
                try { result.add(Long.valueOf(s.trim())); } catch (NumberFormatException ignored) {}
            }
        }
        return result.isEmpty() ? null : result;
    }

    @GetMapping("/detail")
    public Result<?> getChainDetail(@RequestParam String chainCode) {
        ChainVO vo = chainService.getChainDetail(chainCode);
        return Result.success(vo);
    }

    @PostMapping("/copy")
    public Result<?> copyChain(@RequestBody Map<String, String> params) {
        String chainCode = params.get("chainCode");
        ChainVO vo = chainService.copyChain(chainCode);
        Map<String, Object> data = new HashMap<>();
        data.put("newChainId", vo.getChainId());
        data.put("newChainCode", vo.getChainCode());
        data.put("nodeCount", vo.getNodeCount());
        return Result.success(data);
    }

    @PostMapping("/batchDelete")
    public Result<?> batchDelete(@RequestBody Map<String, List<String>> params) {
        List<String> chainCodes = params.get("chainCodes");
        if (chainCodes == null || chainCodes.isEmpty()) {
            return Result.error("请选择要删除的链路");
        }
        int success = 0;
        for (String code : chainCodes) {
            try {
                chainService.deleteChain(code);
                success++;
            } catch (Exception e) {
                // skip failed
            }
        }
        Map<String, Object> data = new HashMap<>();
        data.put("successCount", success);
        data.put("failCount", chainCodes.size() - success);
        return Result.success(data);
    }

    @GetMapping("/versions")
    public Result<?> getVersions(
            @RequestParam String chainCode,
            @RequestParam(defaultValue = "false") boolean all) {
        List<VersionVO> versions = versionService.getVersions(chainCode, all);
        Map<String, Object> data = new HashMap<>();
        data.put("total", versions.size());
        data.put("list", versions);
        return Result.success(data);
    }

    @GetMapping("/version/diff")
    public Result<?> getVersionDiff(
            @RequestParam String chainCode,
            @RequestParam int version) {
        DiffVO diff = versionService.getVersionDiff(chainCode, version);
        return Result.success(diff);
    }

    @PostMapping("/version/delete")
    public Result<?> deleteVersion(@Valid @RequestBody VersionDeleteDTO dto) {
        versionService.deleteVersion(dto);
        return Result.success();
    }

    @PostMapping("/version/batchDelete")
    public Result<?> batchDeleteVersions(@Valid @RequestBody BatchVersionDeleteDTO dto) {
        versionService.batchDeleteVersions(dto.getChainCode(), dto.getBeforeVersion());
        return Result.success();
    }

    @Autowired
    private TestNodeConfigMapper nodeConfigMapper;

    @Autowired
    private ExecuteService executeService;

    /**
     * 按指定TraceId分组回放链路
     */
    @PostMapping("/runByTrace")
    public Result<?> runByTraceId(
            @RequestParam String chainCode,
            @RequestParam(required = false) String traceId,
            @RequestParam(defaultValue = "false") boolean parallel) {
        String executionId = ((com.autotest.service.impl.ExecuteServiceImpl) executeService)
                .runChain(chainCode, traceId, parallel);
        Map<String, Object> data = new HashMap<>();
        data.put("executionId", executionId);
        return Result.success(data);
    }

    /**
     * 按 bizOperTraceId 分组查询链路节点
     */
    @GetMapping("/trace-groups")
    public Result<?> getTraceGroups(@RequestParam String chainCode) {
        List<TestNodeConfig> nodes = nodeConfigMapper.selectByChainCode(chainCode);
        if (nodes == null || nodes.isEmpty()) {
            return Result.success(new ArrayList<>());
        }

        // Group by bizOperTraceId
        Map<String, List<TestNodeConfig>> grouped = nodes.stream()
                .filter(n -> n.getBizOperTraceId() != null && !n.getBizOperTraceId().isEmpty())
                .collect(Collectors.groupingBy(
                    TestNodeConfig::getBizOperTraceId,
                    LinkedHashMap::new,
                    Collectors.toList()
                ));

        List<TraceGroupVO> traceGroups = new ArrayList<>();
        for (Map.Entry<String, List<TestNodeConfig>> entry : grouped.entrySet()) {
            TraceGroupVO group = new TraceGroupVO();
            group.setTraceId(entry.getKey());
            group.setNodeCount(entry.getValue().size());

            // Get triggerEvent and pageUrl from first node
            TestNodeConfig firstNode = entry.getValue().get(0);
            group.setTriggerEvent(firstNode.getTriggerEvent());
            group.setPageUrl(firstNode.getPageUrl());

            // Convert to NodeVO
            List<NodeVO> nodeVOs = entry.getValue().stream().map(node -> {
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
            }).collect(Collectors.toList());

            group.setNodes(nodeVOs);
            traceGroups.add(group);
        }

        // Add ungrouped nodes (no bizOperTraceId)
        List<TestNodeConfig> ungrouped = nodes.stream()
                .filter(n -> n.getBizOperTraceId() == null || n.getBizOperTraceId().isEmpty())
                .collect(Collectors.toList());

        if (!ungrouped.isEmpty()) {
            TraceGroupVO ungroupedGroup = new TraceGroupVO();
            ungroupedGroup.setTraceId("__ungrouped__");
            ungroupedGroup.setNodeCount(ungrouped.size());
            ungroupedGroup.setNodes(ungrouped.stream().map(node -> {
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
                vo.setIsIgnored(node.getIsIgnored());
                return vo;
            }).collect(Collectors.toList()));
            traceGroups.add(ungroupedGroup);
        }

        return Result.success(traceGroups);
    }
}
