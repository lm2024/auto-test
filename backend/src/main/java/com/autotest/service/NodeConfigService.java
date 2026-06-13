package com.autotest.service;

import com.autotest.model.dto.NodeCreateDTO;
import com.autotest.model.dto.NodeEditDTO;
import com.autotest.model.dto.PluginInterfaceDTO;
import com.autotest.model.entity.TestNodeConfig;
import com.autotest.model.vo.NodeVO;

import java.util.List;
import java.util.Map;

public interface NodeConfigService {
    NodeVO createNode(NodeCreateDTO dto);
    NodeVO editNode(NodeEditDTO dto);
    void deleteNode(Long id);
    List<NodeVO> listNodes(String chainCode);
    NodeVO getNodeDetail(Long id);
    Map<String, Object> importNodes(String chainCode, List<PluginInterfaceDTO> interfaces);
    List<DependencyRelation> identifyDependencies(String chainCode);

    class DependencyRelation {
        private String fromNode;
        private String toNode;
        private String extractPath;
        private String targetPath;
        private boolean matched;

        public String getFromNode() { return fromNode; }
        public void setFromNode(String fromNode) { this.fromNode = fromNode; }
        public String getToNode() { return toNode; }
        public void setToNode(String toNode) { this.toNode = toNode; }
        public String getExtractPath() { return extractPath; }
        public void setExtractPath(String extractPath) { this.extractPath = extractPath; }
        public String getTargetPath() { return targetPath; }
        public void setTargetPath(String targetPath) { this.targetPath = targetPath; }
        public boolean isMatched() { return matched; }
        public void setMatched(boolean matched) { this.matched = matched; }
    }
}
