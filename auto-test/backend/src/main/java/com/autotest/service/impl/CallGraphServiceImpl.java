package com.autotest.service.impl;

import com.autotest.mapper.CallGraphMapper;
import com.autotest.model.entity.SysSystemRegistry;
import com.autotest.model.vo.CallGraphRow;
import com.autotest.model.vo.CallGraphVO;
import com.autotest.model.vo.ClassifyResult;
import com.autotest.service.CallGraphService;
import com.autotest.service.SystemRegistryService;
import com.autotest.util.InterfaceClassifier;
import com.autotest.util.GraphDataBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;

/**
 * 系统调用关系图服务实现：同时支持链路拓扑、系统流转和目标系统概览。
 * 节点未落库分类（interface_scope 为空）时现场调用 InterfaceClassifier 补齐。
 */
@Service
public class CallGraphServiceImpl implements CallGraphService {

    private static final String SUT_ID = "SUT";
    private static final String SUT_NAME = "被测系统";
    private static final String UNKNOWN_DOMAIN = "UNKNOWN";
    private static final String UNKNOWN_SYSTEM = "未知系统";

    @Autowired
    private CallGraphMapper callGraphMapper;

    @Autowired
    private InterfaceClassifier interfaceClassifier;

    @Autowired
    private SystemRegistryService systemRegistryService;

    @Override
    public CallGraphVO buildCallGraph(String chainCode) {
        return buildCallGraph(chainCode, null, null, null, null, 1, 20, 200, "TARGET_OVERVIEW");
    }

    @Override
    public CallGraphVO buildCallGraph(String chainCode, String keyword, String scope, String method,
                                      String category, Integer pageNo, Integer pageSize, Integer maxNodes,
                                      String viewMode) {
        int safePageNo = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int safePageSize = pageSize == null || pageSize < 1 ? 20 : Math.min(pageSize, 100);
        int safeMaxNodes = maxNodes == null || maxNodes < 20 ? 200 : Math.min(maxNodes, 500);
        String normalizedScope = isBlank(scope) ? null : scope.trim().toUpperCase();
        String normalizedMethod = isBlank(method) ? null : method.trim().toUpperCase();
        String normalizedKeyword = isBlank(keyword) ? null : keyword.trim();
        String normalizedCategory = isBlank(category) ? null : category.trim();
        String normalizedView = isBlank(viewMode) ? "TARGET_OVERVIEW" : viewMode.trim().toUpperCase();

        CallGraphVO vo = new CallGraphVO();
        vo.setViewMode(normalizedView);
        if ("TARGET_OVERVIEW".equals(normalizedView)) {
            CallGraphVO.NodeItem sut = new CallGraphVO.NodeItem(SUT_ID, SUT_NAME, "SUT", null);
            sut.setNodeType("SUT");
            sut.setRelationSource("OVERVIEW");
            vo.getNodes().add(sut);
        }

        int totalRows = callGraphMapper.countCallRows(chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory);
        List<CallGraphRow> detailRows = callGraphMapper.selectCallRows(
                chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory,
                (safePageNo - 1) * safePageSize, safePageSize);
        List<CallGraphRow> graphRows = callGraphMapper.selectGraphRows(
                chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory, safeMaxNodes);
        vo.setTotalRows(Integer.valueOf(totalRows));
        vo.setTotalSystems(Integer.valueOf(callGraphMapper.countDistinctSystems(chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory)));
        vo.setPageNo(Integer.valueOf(safePageNo));
        vo.setPageSize(Integer.valueOf(safePageSize));
        vo.setGraphTruncated(Boolean.valueOf(totalRows > safeMaxNodes));

        fillDatabaseStats(vo, chainCode, normalizedKeyword, normalizedScope, normalizedMethod, normalizedCategory);
        if (graphRows == null || graphRows.isEmpty()) {
            vo.setDetail(new ArrayList<CallGraphVO.DetailItem>());
            return vo;
        }

        Map<String, String> categoryMap = buildCategoryMap();
        Map<String, SystemAgg> systemMap = new LinkedHashMap<String, SystemAgg>();
        Map<String, DomainAgg> domainMap = new LinkedHashMap<String, DomainAgg>();
        Map<String, Integer> scopeMap = new LinkedHashMap<String, Integer>();
        Map<String, CallGraphVO.DetailItem> detailMap = new LinkedHashMap<String, CallGraphVO.DetailItem>();

        for (CallGraphRow row : graphRows) {
            String url = row.getRequestUrl();
            String host = interfaceClassifier.extractHost(url);
            ClassifyResult classified = interfaceClassifier.classify(url);

            String scopeName = isBlank(row.getInterfaceScope())
                    ? classified.getScope() : row.getInterfaceScope().trim().toUpperCase();
            if (isBlank(scopeName)) {
                scopeName = InterfaceClassifier.SCOPE_UNKNOWN;
            }

            String systemCode = classified.getSystemCode();
            String displayName = resolveSystemName(row, classified, host);
            String nodeId = "SYS_" + (isBlank(systemCode) ? sanitize(host != null ? host : displayName) : systemCode);
            String categoryValue = isBlank(row.getCategory()) ? (isBlank(systemCode) ? null : categoryMap.get(systemCode)) : row.getCategory();

            SystemAgg systemAgg = systemMap.get(nodeId);
            if (systemAgg == null) {
                systemAgg = new SystemAgg(nodeId, displayName, scopeName, categoryValue);
                systemMap.put(nodeId, systemAgg);
            }
            systemAgg.count++;

            String domainKey = host == null ? UNKNOWN_DOMAIN : host;
            DomainAgg domainAgg = domainMap.get(domainKey);
            if (domainAgg == null) {
                domainAgg = new DomainAgg(domainKey, scope, displayName);
                domainMap.put(domainKey, domainAgg);
            }
            domainAgg.count++;

            Integer scopeCount = scopeMap.get(scopeName);
            scopeMap.put(scopeName, Integer.valueOf(scopeCount == null ? 1 : scopeCount.intValue() + 1));

        }
        if (detailRows != null) {
            for (CallGraphRow row : detailRows) {
                String host = interfaceClassifier.extractHost(row.getRequestUrl());
                ClassifyResult classified = interfaceClassifier.classify(row.getRequestUrl());
                String detailScope = isBlank(row.getInterfaceScope()) ? classified.getScope() : row.getInterfaceScope().trim().toUpperCase();
                accumulateDetail(detailMap, row, resolveSystemName(row, classified, host), isBlank(detailScope) ? InterfaceClassifier.SCOPE_UNKNOWN : detailScope);
            }
        }

        if ("CHAIN_FLOW".equals(normalizedView) || "SYSTEM_FLOW".equals(normalizedView)) {
            fillFlowGraph(vo, graphRows, normalizedView, safeMaxNodes);
        } else {
            fillNodesAndEdges(vo, systemMap);
            vo.setRelationNotice("目标系统概览：展示聚合关系，不代表完整调用顺序。请选择“链路流转”查看编排拓扑。");
        }
        fillByDomain(vo, domainMap);
        fillDetail(vo, detailMap);
        return vo;
    }

    private void fillDatabaseStats(CallGraphVO vo, String chainCode, String keyword, String scope, String method, String category) {
        vo.setStatsByScope(toScopeStats(callGraphMapper.selectScopeStats(chainCode, keyword, scope, method, category)));
        vo.setStatsByMethod(toDimensionStats(callGraphMapper.selectMethodStats(chainCode, keyword, scope, method, category)));
        vo.setStatsByChain(toDimensionStats(callGraphMapper.selectChainStats(chainCode, keyword, scope, method, category)));
        vo.setStatsByModule(toModuleStats(callGraphMapper.selectSystemStats(chainCode, keyword, scope, method, category)));
    }

    private List<CallGraphVO.DimensionStat> toDimensionStats(List<Map<String, Object>> rows) {
        List<CallGraphVO.DimensionStat> result = new ArrayList<CallGraphVO.DimensionStat>();
        if (rows != null) for (Map<String, Object> row : rows) {
            result.add(new CallGraphVO.DimensionStat(String.valueOf(row.get("name")), ((Number) row.get("count")).intValue()));
        }
        return result;
    }

    private List<CallGraphVO.ModuleStat> toModuleStats(List<Map<String, Object>> rows) {
        List<CallGraphVO.ModuleStat> result = new ArrayList<CallGraphVO.ModuleStat>();
        if (rows != null) for (Map<String, Object> row : rows) {
            result.add(new CallGraphVO.ModuleStat(String.valueOf(row.get("name")), ((Number) row.get("count")).intValue()));
        }
        return result;
    }

    private List<CallGraphVO.ScopeStat> toScopeStats(List<Map<String, Object>> rows) {
        List<CallGraphVO.ScopeStat> result = new ArrayList<CallGraphVO.ScopeStat>();
        if (rows != null) for (Map<String, Object> row : rows) {
            result.add(new CallGraphVO.ScopeStat(String.valueOf(row.get("name")), ((Number) row.get("count")).intValue()));
        }
        return result;
    }

    /**
     * 明细按 链路+方法+URL+范围 聚合
     */
    private void accumulateDetail(Map<String, CallGraphVO.DetailItem> detailMap, CallGraphRow row,
                                  String displayName, String scope) {
        String method = isBlank(row.getRequestMethod()) ? "GET" : row.getRequestMethod().trim().toUpperCase();
        String key = row.getChainCode() + "|" + method + "|" + row.getRequestUrl() + "|" + scope + "|" + displayName;
        CallGraphVO.DetailItem detail = detailMap.get(key);
        if (detail == null) {
            detail = new CallGraphVO.DetailItem();
            detail.setChainCode(row.getChainCode());
            detail.setChainName(row.getChainName());
            detail.setTargetSystem(displayName);
            detail.setMethod(method);
            detail.setUrl(row.getRequestUrl());
            detail.setScope(scope);
            detail.setCount(Integer.valueOf(0));
            detailMap.put(key, detail);
        }
        detail.setCount(Integer.valueOf(detail.getCount().intValue() + 1));
    }

    private void fillNodesAndEdges(CallGraphVO vo, Map<String, SystemAgg> systemMap) {
        List<SystemAgg> systems = new ArrayList<SystemAgg>(systemMap.values());
        systems.sort(new Comparator<SystemAgg>() {
            @Override
            public int compare(SystemAgg a, SystemAgg b) {
                return b.count - a.count;
            }
        });
        for (SystemAgg agg : systems) {
            CallGraphVO.NodeItem node = new CallGraphVO.NodeItem(agg.nodeId, agg.name, agg.scope, agg.category);
            node.setNodeType("SYSTEM");
            node.setRelationSource("OVERVIEW");
            node.setCount(Integer.valueOf(agg.count));
            vo.getNodes().add(node);
            CallGraphVO.EdgeItem edge = new CallGraphVO.EdgeItem(SUT_ID, agg.nodeId, Integer.valueOf(agg.count));
            edge.setRelationType("OVERVIEW");
            edge.setRelationSource("OVERVIEW");
            vo.getEdges().add(edge);
        }
    }

    /**
     * 构建真正可读的有向链路：链路 -> 接口节点 -> 目标系统。
     * 画布边是 CONFIGURED；没有画布边时才按节点顺序生成 INFERRED，并在响应中明确告知用户。
     */
    private void fillFlowGraph(CallGraphVO vo, List<CallGraphRow> rows, String viewMode, int maxNodes) {
        Map<String, CallGraphRow> nodeRows = new LinkedHashMap<String, CallGraphRow>();
        Map<String, List<CallGraphRow>> chains = new LinkedHashMap<String, List<CallGraphRow>>();
        for (CallGraphRow row : rows) {
            if (isBlank(row.getNodeCode())) {
                continue;
            }
            String key = row.getChainCode() + "|" + row.getNodeCode();
            nodeRows.put(key, row);
            List<CallGraphRow> chainRows = chains.get(row.getChainCode());
            if (chainRows == null) {
                chainRows = new ArrayList<CallGraphRow>();
                chains.put(row.getChainCode(), chainRows);
            }
            chainRows.add(row);
        }
        int nodeLimit = Math.max(20, maxNodes);
        Set<String> edgeKeys = new HashSet<String>();
        for (Map.Entry<String, List<CallGraphRow>> entry : chains.entrySet()) {
            List<CallGraphRow> chainRows = entry.getValue();
            if (chainRows.isEmpty()) continue;
            CallGraphRow first = chainRows.get(0);
            String chainId = "CHAIN_" + sanitize(first.getChainCode());
            if (!"SYSTEM_FLOW".equals(viewMode)) {
                addNode(vo, chainId, first.getChainName(), "CHAIN", "UNKNOWN", null, "CONFIGURED", chainRows.size(), nodeLimit);
            }
            Map<String, String> systemIds = new LinkedHashMap<String, String>();
            for (CallGraphRow row : chainRows) {
                String requestId = "REQ_" + sanitize(row.getChainCode()) + "_" + sanitize(row.getNodeCode());
                if (vo.getNodes().size() >= nodeLimit) break;
                String host = interfaceClassifier.extractHost(row.getRequestUrl());
                ClassifyResult classified = interfaceClassifier.classify(row.getRequestUrl());
                String scopeName = isBlank(row.getInterfaceScope()) ? classified.getScope() : row.getInterfaceScope().trim().toUpperCase();
                String systemName = resolveSystemName(row, classified, host);
                String systemCode = classified == null ? null : classified.getSystemCode();
                String systemId = "SYS_" + (isBlank(systemCode) ? sanitize(host != null ? host : systemName) : systemCode);
                if (!"SYSTEM_FLOW".equals(viewMode)) {
                    addNode(vo, requestId, row.getNodeCode() + " · " + (isBlank(row.getRequestMethod()) ? "GET" : row.getRequestMethod().toUpperCase()), "INTERFACE", scopeName, row.getCategory(), "CONFIGURED", 1, nodeLimit);
                    addEdge(vo, chainId, requestId, 1, "CONFIGURED", row);
                }
                if (!"SYSTEM_FLOW".equals(viewMode)) {
                    addNode(vo, systemId, systemName, "SYSTEM", scopeName, row.getCategory(), "CONFIGURED", 1, nodeLimit);
                    addEdge(vo, requestId, systemId, 1, "CONFIGURED", row);
                } else {
                    addNode(vo, systemId, systemName, "SYSTEM", scopeName, row.getCategory(), "CONFIGURED", 1, nodeLimit);
                }
                systemIds.put(row.getNodeCode(), systemId);
            }
            List<String[]> configuredEdges = GraphDataBuilder.extractEdges(first.getGraphData());
            if (!configuredEdges.isEmpty()) {
                for (String[] edge : configuredEdges) {
                    CallGraphRow from = nodeRows.get(entry.getKey() + "|" + edge[0]);
                    CallGraphRow to = nodeRows.get(entry.getKey() + "|" + edge[1]);
                    if (from == null || to == null) continue;
                    String fromId = "SYSTEM_FLOW".equals(viewMode) ? systemIds.get(from.getNodeCode()) : "REQ_" + sanitize(from.getChainCode()) + "_" + sanitize(from.getNodeCode());
                    String toId = "SYSTEM_FLOW".equals(viewMode) ? systemIds.get(to.getNodeCode()) : "REQ_" + sanitize(to.getChainCode()) + "_" + sanitize(to.getNodeCode());
                    if (fromId != null && toId != null && !fromId.equals(toId) && edgeKeys.add(fromId + "->" + toId)) addEdge(vo, fromId, toId, 1, "CONFIGURED", to);
                }
            } else {
                vo.setRelationNotice("部分链路没有保存画布连线，已按节点顺序标记为推断关系；推断关系不能等同于真实 Trace。");
                for (int i = 1; i < chainRows.size(); i++) {
                    CallGraphRow from = chainRows.get(i - 1), to = chainRows.get(i);
                    String fromId = "SYSTEM_FLOW".equals(viewMode) ? systemIds.get(from.getNodeCode()) : "REQ_" + sanitize(from.getChainCode()) + "_" + sanitize(from.getNodeCode());
                    String toId = "SYSTEM_FLOW".equals(viewMode) ? systemIds.get(to.getNodeCode()) : "REQ_" + sanitize(to.getChainCode()) + "_" + sanitize(to.getNodeCode());
                    if (fromId != null && toId != null && edgeKeys.add(fromId + "->" + toId)) addEdge(vo, fromId, toId, 1, "INFERRED", to);
                }
            }
        }
        if (vo.getRelationNotice() == null) vo.setRelationNotice("链路关系来自测试链路画布配置，不代表运行时真实 Trace。");
    }

    private void addNode(CallGraphVO vo, String id, String name, String type, String scope, String category,
                         String source, int count, int limit) {
        for (CallGraphVO.NodeItem item : vo.getNodes()) if (id.equals(item.getId())) return;
        if (vo.getNodes().size() >= limit) return;
        CallGraphVO.NodeItem node = new CallGraphVO.NodeItem(id, name, scope, category);
        node.setNodeType(type);
        node.setRelationSource(source);
        node.setCount(Integer.valueOf(count));
        vo.getNodes().add(node);
    }

    private void addEdge(CallGraphVO vo, String source, String target, int count, String type, CallGraphRow row) {
        if (!hasNode(vo, source) || !hasNode(vo, target)) {
            return;
        }
        for (CallGraphVO.EdgeItem item : vo.getEdges()) if (source.equals(item.getSource()) && target.equals(item.getTarget())) return;
        CallGraphVO.EdgeItem edge = new CallGraphVO.EdgeItem(source, target, Integer.valueOf(count));
        edge.setRelationType(type);
        edge.setRelationSource(type);
        edge.setChainCode(row == null ? null : row.getChainCode());
        edge.setMethod(row == null ? null : row.getRequestMethod());
        vo.getEdges().add(edge);
    }

    private boolean hasNode(CallGraphVO vo, String id) {
        if (isBlank(id)) {
            return false;
        }
        for (CallGraphVO.NodeItem item : vo.getNodes()) {
            if (id.equals(item.getId())) {
                return true;
            }
        }
        return false;
    }

    private void fillStatsByModule(CallGraphVO vo, Map<String, SystemAgg> systemMap) {
        Map<String, Integer> moduleMap = new LinkedHashMap<String, Integer>();
        for (SystemAgg agg : systemMap.values()) {
            Integer current = moduleMap.get(agg.name);
            moduleMap.put(agg.name, Integer.valueOf(current == null ? agg.count : current.intValue() + agg.count));
        }
        List<CallGraphVO.ModuleStat> stats = new ArrayList<CallGraphVO.ModuleStat>();
        for (Map.Entry<String, Integer> entry : moduleMap.entrySet()) {
            stats.add(new CallGraphVO.ModuleStat(entry.getKey(), entry.getValue()));
        }
        stats.sort(new Comparator<CallGraphVO.ModuleStat>() {
            @Override
            public int compare(CallGraphVO.ModuleStat a, CallGraphVO.ModuleStat b) {
                return b.getCount().intValue() - a.getCount().intValue();
            }
        });
        vo.setStatsByModule(stats);
    }

    private void fillStatsByScope(CallGraphVO vo, Map<String, Integer> scopeMap) {
        List<CallGraphVO.ScopeStat> stats = new ArrayList<CallGraphVO.ScopeStat>();
        for (Map.Entry<String, Integer> entry : scopeMap.entrySet()) {
            stats.add(new CallGraphVO.ScopeStat(entry.getKey(), entry.getValue()));
        }
        stats.sort(new Comparator<CallGraphVO.ScopeStat>() {
            @Override
            public int compare(CallGraphVO.ScopeStat a, CallGraphVO.ScopeStat b) {
                return b.getCount().intValue() - a.getCount().intValue();
            }
        });
        vo.setStatsByScope(stats);
    }

    private void fillByDomain(CallGraphVO vo, Map<String, DomainAgg> domainMap) {
        List<CallGraphVO.DomainStat> stats = new ArrayList<CallGraphVO.DomainStat>();
        for (DomainAgg agg : domainMap.values()) {
            stats.add(new CallGraphVO.DomainStat(agg.domain, agg.scope, agg.systemName, Integer.valueOf(agg.count)));
        }
        stats.sort(new Comparator<CallGraphVO.DomainStat>() {
            @Override
            public int compare(CallGraphVO.DomainStat a, CallGraphVO.DomainStat b) {
                return b.getCount().intValue() - a.getCount().intValue();
            }
        });
        vo.setByDomain(stats);
    }

    private void fillDetail(CallGraphVO vo, Map<String, CallGraphVO.DetailItem> detailMap) {
        vo.setDetail(new ArrayList<CallGraphVO.DetailItem>(detailMap.values()));
    }

    /**
     * systemCode -> category，用于给图节点补分类标签
     */
    private Map<String, String> buildCategoryMap() {
        Map<String, String> map = new LinkedHashMap<String, String>();
        List<SysSystemRegistry> registries = systemRegistryService.listAll();
        for (SysSystemRegistry registry : registries) {
            if (!isBlank(registry.getSystemCode())) {
                map.put(registry.getSystemCode(), registry.getCategory());
            }
        }
        return map;
    }

    /**
     * 目标系统展示名：优先节点落库值，其次分类结果，再次域名
     */
    private String resolveSystemName(CallGraphRow row, ClassifyResult classified, String host) {
        if (!isBlank(row.getTargetSystem())) {
            return row.getTargetSystem().trim();
        }
        if (classified != null && !isBlank(classified.getSystemName())) {
            return classified.getSystemName();
        }
        if (host != null && !host.isEmpty()) {
            return host;
        }
        return UNKNOWN_SYSTEM;
    }

    /**
     * 节点 id 片段规范化：非字母数字替换为下划线
     */
    private String sanitize(String text) {
        if (isBlank(text)) {
            return UNKNOWN_DOMAIN;
        }
        return text.trim().replaceAll("[^a-zA-Z0-9]", "_");
    }

    private boolean isBlank(String text) {
        return text == null || text.trim().isEmpty();
    }

    /**
     * 目标系统聚合中间结构
     */
    private static class SystemAgg {
        private final String nodeId;
        private final String name;
        private final String scope;
        private final String category;
        private int count;

        SystemAgg(String nodeId, String name, String scope, String category) {
            this.nodeId = nodeId;
            this.name = name;
            this.scope = scope;
            this.category = category;
        }
    }

    /**
     * 域名聚合中间结构
     */
    private static class DomainAgg {
        private final String domain;
        private final String scope;
        private final String systemName;
        private int count;

        DomainAgg(String domain, String scope, String systemName) {
            this.domain = domain;
            this.scope = scope;
            this.systemName = systemName;
        }
    }
}
