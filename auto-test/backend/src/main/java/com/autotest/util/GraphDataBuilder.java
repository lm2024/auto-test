package com.autotest.util;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.autotest.model.entity.TestNodeConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * X6 画布图数据构建与解析工具。
 *
 * <p>插件录制/批量导入产生的节点没有画布坐标与连线，这里按录制顺序自动生成一条线性 DAG，
 * 保证后端执行引擎（拓扑执行）与前端 X6 画布都能直接使用。</p>
 *
 * <p>图数据格式与 X6 <code>graph.toJSON()</code> 保持一致：{"cells":[...]}。</p>
 */
public final class GraphDataBuilder {

    private static final Logger log = LoggerFactory.getLogger(GraphDataBuilder.class);

    /** 前端注册的 Vue 节点 shape 名 */
    public static final String NODE_SHAPE = "http-node";
    public static final String EDGE_SHAPE = "dag-edge";

    private static final int NODE_WIDTH = 240;
    private static final int NODE_HEIGHT = 88;
    private static final int START_X = 120;
    private static final int START_Y = 80;
    private static final int GAP_Y = 140;

    private GraphDataBuilder() {
    }

    /**
     * 按节点顺序生成一条线性链路的图数据
     *
     * @param nodes 已排好序的节点列表
     * @return X6 图数据 JSON 字符串；nodes 为空时返回空画布
     */
    public static String buildLinear(List<TestNodeConfig> nodes) {
        JSONArray cells = new JSONArray();
        if (nodes == null || nodes.isEmpty()) {
            JSONObject empty = new JSONObject();
            empty.put("cells", cells);
            return empty.toJSONString();
        }

        for (int i = 0; i < nodes.size(); i++) {
            TestNodeConfig node = nodes.get(i);
            if (node == null || node.getNodeCode() == null) {
                continue;
            }
            cells.add(buildNodeCell(node, START_X, START_Y + i * GAP_Y));
        }

        for (int i = 0; i < nodes.size() - 1; i++) {
            TestNodeConfig from = nodes.get(i);
            TestNodeConfig to = nodes.get(i + 1);
            if (from == null || to == null || from.getNodeCode() == null || to.getNodeCode() == null) {
                continue;
            }
            cells.add(buildEdgeCell(from.getNodeCode(), to.getNodeCode()));
        }

        JSONObject graph = new JSONObject();
        graph.put("cells", cells);
        return graph.toJSONString();
    }

    /**
     * 在已有图数据末尾追加节点，并从原最后一个节点连线过来。
     * 原图数据非法或为空时，退化为对 appended 重新生成线性图。
     *
     * @param existingGraphJson 原图数据
     * @param appended          追加的节点
     * @return 合并后的图数据 JSON 字符串
     */
    public static String appendLinear(String existingGraphJson, List<TestNodeConfig> appended) {
        if (appended == null || appended.isEmpty()) {
            return existingGraphJson;
        }
        JSONArray cells = safeParseCells(existingGraphJson);
        if (cells == null) {
            return buildLinear(appended);
        }

        String lastNodeCode = findLastNodeId(cells);
        int baseY = findMaxNodeY(cells) + GAP_Y;

        for (int i = 0; i < appended.size(); i++) {
            TestNodeConfig node = appended.get(i);
            if (node == null || node.getNodeCode() == null) {
                continue;
            }
            cells.add(buildNodeCell(node, START_X, baseY + i * GAP_Y));
            if (lastNodeCode != null) {
                cells.add(buildEdgeCell(lastNodeCode, node.getNodeCode()));
            }
            lastNodeCode = node.getNodeCode();
        }

        JSONObject graph = new JSONObject();
        graph.put("cells", cells);
        return graph.toJSONString();
    }

    /**
     * 从图数据中提取所有节点 id（即 nodeCode），保持画布中的声明顺序
     */
    public static List<String> extractNodeIds(String graphJson) {
        List<String> ids = new ArrayList<String>();
        JSONArray cells = safeParseCells(graphJson);
        if (cells == null) {
            return ids;
        }
        Set<String> seen = new LinkedHashSet<String>();
        for (int i = 0; i < cells.size(); i++) {
            JSONObject cell = cells.getJSONObject(i);
            if (cell == null || isEdge(cell)) {
                continue;
            }
            String id = cell.getString("id");
            if (id != null && !id.isEmpty()) {
                seen.add(id);
            }
        }
        ids.addAll(seen);
        return ids;
    }

    /**
     * 从图数据中提取所有有向边，返回 [sourceId, targetId] 数组列表
     */
    public static List<String[]> extractEdges(String graphJson) {
        List<String[]> edges = new ArrayList<String[]>();
        JSONArray cells = safeParseCells(graphJson);
        if (cells == null) {
            return edges;
        }
        for (int i = 0; i < cells.size(); i++) {
            JSONObject cell = cells.getJSONObject(i);
            if (cell == null || !isEdge(cell)) {
                continue;
            }
            String source = readTerminalId(cell, "source");
            String target = readTerminalId(cell, "target");
            if (source != null && target != null && !source.equals(target)) {
                edges.add(new String[]{source, target});
            }
        }
        return edges;
    }

    private static JSONObject buildNodeCell(TestNodeConfig node, int x, int y) {
        JSONObject data = new JSONObject();
        data.put("nodeCode", node.getNodeCode());
        data.put("nodeName", node.getNodeName());
        data.put("nodeType", node.getNodeType());
        data.put("requestMethod", node.getRequestMethod());
        data.put("requestUrl", node.getRequestUrl());
        data.put("interfaceScope", node.getInterfaceScope());
        data.put("targetSystem", node.getTargetSystem());

        JSONObject cell = new JSONObject();
        cell.put("id", node.getNodeCode());
        cell.put("shape", NODE_SHAPE);
        cell.put("x", x);
        cell.put("y", y);
        cell.put("width", NODE_WIDTH);
        cell.put("height", NODE_HEIGHT);
        cell.put("data", data);
        return cell;
    }

    private static JSONObject buildEdgeCell(String sourceId, String targetId) {
        JSONObject source = new JSONObject();
        source.put("cell", sourceId);
        JSONObject target = new JSONObject();
        target.put("cell", targetId);

        JSONObject cell = new JSONObject();
        cell.put("id", "edge-" + sourceId + "-" + targetId);
        cell.put("shape", EDGE_SHAPE);
        cell.put("source", source);
        cell.put("target", target);
        return cell;
    }

    private static JSONArray safeParseCells(String graphJson) {
        if (graphJson == null || graphJson.trim().isEmpty()) {
            return null;
        }
        try {
            JSONObject root = JSON.parseObject(graphJson);
            if (root == null) {
                return null;
            }
            JSONArray cells = root.getJSONArray("cells");
            return cells == null ? new JSONArray() : cells;
        } catch (Exception e) {
            log.warn("[GraphData] 图数据解析失败，将按新图处理: {}", e.getMessage());
            return null;
        }
    }

    private static boolean isEdge(JSONObject cell) {
        String shape = cell.getString("shape");
        if (shape != null && shape.toLowerCase().contains("edge")) {
            return true;
        }
        return cell.containsKey("source") && cell.containsKey("target");
    }

    private static String readTerminalId(JSONObject cell, String key) {
        Object terminal = cell.get(key);
        if (terminal == null) {
            return null;
        }
        if (terminal instanceof String) {
            String value = (String) terminal;
            return value.isEmpty() ? null : value;
        }
        if (terminal instanceof JSONObject) {
            String value = ((JSONObject) terminal).getString("cell");
            return value == null || value.isEmpty() ? null : value;
        }
        return null;
    }

    private static String findLastNodeId(JSONArray cells) {
        String last = null;
        for (int i = 0; i < cells.size(); i++) {
            JSONObject cell = cells.getJSONObject(i);
            if (cell == null || isEdge(cell)) {
                continue;
            }
            String id = cell.getString("id");
            if (id != null && !id.isEmpty()) {
                last = id;
            }
        }
        return last;
    }

    private static int findMaxNodeY(JSONArray cells) {
        int maxY = START_Y;
        for (int i = 0; i < cells.size(); i++) {
            JSONObject cell = cells.getJSONObject(i);
            if (cell == null || isEdge(cell)) {
                continue;
            }
            Integer y = cell.getInteger("y");
            if (y != null && y.intValue() > maxY) {
                maxY = y.intValue();
            }
        }
        return maxY;
    }
}
