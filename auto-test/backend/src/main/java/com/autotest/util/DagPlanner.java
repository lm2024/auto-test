package com.autotest.util;

import com.autotest.exception.BusinessException;
import com.autotest.model.entity.TestNodeConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * DAG 执行规划器。
 *
 * <p>链路的执行顺序不再依赖 <code>sort_no</code> / <code>parallel_group</code>，
 * 而是由 <code>test_chain.graph_data</code>（X6 画布 JSON）中的连线拓扑决定。</p>
 *
 * <p>规划结果为「分层列表」：同一层内的节点互相之间没有依赖，可并发执行；
 * 层与层之间必须串行。串行执行模式下把各层依次展平即可。</p>
 *
 * <p>兜底策略：画布数据为空 / 解析失败 / 与节点表完全对不上时，
 * 退化为按节点表顺序的线性执行，保证老数据仍可运行。</p>
 */
public final class DagPlanner {

    private static final Logger log = LoggerFactory.getLogger(DagPlanner.class);

    private DagPlanner() {
    }

    /**
     * 按画布拓扑分层
     *
     * @param graphJson 画布图数据（test_chain.graph_data）
     * @param nodes     节点表中的全部节点（顺序即兜底顺序）
     * @return 分层执行计划，每层内部可并发
     * @throws BusinessException 画布存在环形依赖时抛出
     */
    public static List<List<TestNodeConfig>> planLayers(String graphJson, List<TestNodeConfig> nodes) {
        List<List<TestNodeConfig>> layers = new ArrayList<List<TestNodeConfig>>();
        if (nodes == null || nodes.isEmpty()) {
            return layers;
        }

        Map<String, TestNodeConfig> byCode = new LinkedHashMap<String, TestNodeConfig>();
        final Map<String, Integer> orderIndex = new HashMap<String, Integer>();
        for (int i = 0; i < nodes.size(); i++) {
            TestNodeConfig node = nodes.get(i);
            if (node == null || node.getNodeCode() == null) {
                continue;
            }
            byCode.put(node.getNodeCode(), node);
            orderIndex.put(node.getNodeCode(), Integer.valueOf(i));
        }
        if (byCode.isEmpty()) {
            return linearLayers(nodes);
        }

        // 只认既在画布上、又在节点表里的节点
        List<String> ids = new ArrayList<String>();
        for (String id : GraphDataBuilder.extractNodeIds(graphJson)) {
            if (byCode.containsKey(id)) {
                ids.add(id);
            }
        }
        if (ids.isEmpty()) {
            log.debug("[DagPlanner] 画布无有效节点，退化为线性执行");
            return linearLayers(nodes);
        }

        Set<String> idSet = new HashSet<String>(ids);
        Map<String, List<String>> successors = new HashMap<String, List<String>>();
        Map<String, Integer> indegree = new HashMap<String, Integer>();
        for (String id : ids) {
            successors.put(id, new ArrayList<String>());
            indegree.put(id, Integer.valueOf(0));
        }

        Set<String> dedup = new HashSet<String>();
        for (String[] edge : GraphDataBuilder.extractEdges(graphJson)) {
            String from = edge[0];
            String to = edge[1];
            if (!idSet.contains(from) || !idSet.contains(to)) {
                continue;
            }
            if (!dedup.add(from + "->" + to)) {
                continue;
            }
            successors.get(from).add(to);
            indegree.put(to, Integer.valueOf(indegree.get(to).intValue() + 1));
        }

        // Kahn 算法逐层剥离入度为 0 的节点
        List<String> current = new ArrayList<String>();
        for (String id : ids) {
            if (indegree.get(id).intValue() == 0) {
                current.add(id);
            }
        }
        sortByOrder(current, orderIndex);

        int processed = 0;
        while (!current.isEmpty()) {
            List<TestNodeConfig> layer = new ArrayList<TestNodeConfig>();
            List<String> nextLayer = new ArrayList<String>();
            for (String id : current) {
                layer.add(byCode.get(id));
                processed++;
                for (String to : successors.get(id)) {
                    int left = indegree.get(to).intValue() - 1;
                    indegree.put(to, Integer.valueOf(left));
                    if (left == 0) {
                        nextLayer.add(to);
                    }
                }
            }
            layers.add(layer);
            sortByOrder(nextLayer, orderIndex);
            current = nextLayer;
        }

        if (processed < ids.size()) {
            List<String> cycleNodes = new ArrayList<String>();
            for (String id : ids) {
                if (indegree.get(id).intValue() > 0) {
                    cycleNodes.add(nameOf(byCode.get(id)));
                }
            }
            throw new BusinessException(400, "链路画布存在环形依赖，无法确定执行顺序：" + join(cycleNodes));
        }

        // 节点表里有、但画布上没画的节点，按原顺序串行补到末尾，避免漏跑
        List<TestNodeConfig> orphans = new ArrayList<TestNodeConfig>();
        for (TestNodeConfig node : nodes) {
            if (node == null || node.getNodeCode() == null) {
                continue;
            }
            if (!idSet.contains(node.getNodeCode())) {
                orphans.add(node);
            }
        }
        if (!orphans.isEmpty()) {
            log.warn("[DagPlanner] {} 个节点未出现在画布上，已按顺序串行追加执行", Integer.valueOf(orphans.size()));
            for (TestNodeConfig orphan : orphans) {
                layers.add(Collections.singletonList(orphan));
            }
        }
        return layers;
    }

    /**
     * 按画布拓扑展平成串行执行顺序
     *
     * @param graphJson 画布图数据
     * @param nodes     节点表中的全部节点
     * @return 拓扑有序的节点列表
     */
    public static List<TestNodeConfig> planSerial(String graphJson, List<TestNodeConfig> nodes) {
        List<TestNodeConfig> flat = new ArrayList<TestNodeConfig>();
        for (List<TestNodeConfig> layer : planLayers(graphJson, nodes)) {
            flat.addAll(layer);
        }
        return flat;
    }

    /**
     * 判断规划结果中是否存在真正可并发的层（层内节点数 &gt; 1）
     */
    public static boolean hasParallelLayer(List<List<TestNodeConfig>> layers) {
        if (layers == null) {
            return false;
        }
        for (List<TestNodeConfig> layer : layers) {
            if (layer != null && layer.size() > 1) {
                return true;
            }
        }
        return false;
    }

    private static List<List<TestNodeConfig>> linearLayers(List<TestNodeConfig> nodes) {
        List<List<TestNodeConfig>> layers = new ArrayList<List<TestNodeConfig>>();
        for (TestNodeConfig node : nodes) {
            if (node != null) {
                layers.add(Collections.singletonList(node));
            }
        }
        return layers;
    }

    private static void sortByOrder(List<String> ids, final Map<String, Integer> orderIndex) {
        Collections.sort(ids, new Comparator<String>() {
            @Override
            public int compare(String a, String b) {
                Integer ia = orderIndex.get(a);
                Integer ib = orderIndex.get(b);
                int va = ia == null ? Integer.MAX_VALUE : ia.intValue();
                int vb = ib == null ? Integer.MAX_VALUE : ib.intValue();
                return va - vb;
            }
        });
    }

    private static String nameOf(TestNodeConfig node) {
        if (node == null) {
            return "?";
        }
        return node.getNodeName() != null ? node.getNodeName() : node.getNodeCode();
    }

    private static String join(List<String> items) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) {
                sb.append(", ");
            }
            sb.append(items.get(i));
        }
        return sb.toString();
    }
}
