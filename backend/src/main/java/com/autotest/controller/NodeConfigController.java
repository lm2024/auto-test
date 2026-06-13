package com.autotest.controller;

import com.autotest.model.dto.NodeCreateDTO;
import com.autotest.model.dto.NodeEditDTO;
import com.autotest.model.dto.PluginInterfaceDTO;
import com.autotest.model.vo.NodeVO;
import com.autotest.model.vo.Result;
import com.autotest.service.NodeConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/node")
public class NodeConfigController {

    @Autowired
    private NodeConfigService nodeConfigService;

    @PostMapping("/create")
    public Result<?> createNode(@Valid @RequestBody NodeCreateDTO dto) {
        NodeVO vo = nodeConfigService.createNode(dto);
        return Result.success(vo);
    }

    @PostMapping("/edit")
    public Result<?> editNode(@RequestBody NodeEditDTO dto) {
        NodeVO vo = nodeConfigService.editNode(dto);
        return Result.success(vo);
    }

    @PostMapping("/delete")
    public Result<?> deleteNode(@RequestParam Long id) {
        nodeConfigService.deleteNode(id);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<?> listNodes(@RequestParam String chainCode) {
        List<NodeVO> list = nodeConfigService.listNodes(chainCode);
        return Result.success(list);
    }

    @GetMapping("/detail")
    public Result<?> getNodeDetail(@RequestParam Long id) {
        NodeVO vo = nodeConfigService.getNodeDetail(id);
        return Result.success(vo);
    }

    @PostMapping("/import")
    public Result<?> importNodes(@RequestBody Map<String, Object> params) {
        String chainCode = (String) params.get("chainCode");
        List<Map<String, Object>> rawList = (List<Map<String, Object>>) params.get("interfaces");
        List<PluginInterfaceDTO> interfaces = new ArrayList<>();
        if (rawList != null) {
            for (Map<String, Object> item : rawList) {
                PluginInterfaceDTO dto = new PluginInterfaceDTO();
                dto.setNodeName((String) item.get("nodeName"));
                dto.setMethod((String) item.get("method"));
                dto.setUrl((String) item.get("url"));
                dto.setHeaders((String) item.get("headers"));
                dto.setBodyData((String) item.get("bodyData"));
                dto.setSort(item.get("sort") != null ? ((Number) item.get("sort")).intValue() : null);
                dto.setParallelGroup((String) item.get("parallelGroup"));
                interfaces.add(dto);
            }
        }
        Map<String, Object> result = nodeConfigService.importNodes(chainCode, interfaces);
        return Result.success(result);
    }

    @GetMapping("/dependencies")
    public Result<?> getDependencies(@RequestParam String chainCode) {
        List<NodeConfigService.DependencyRelation> relations = nodeConfigService.identifyDependencies(chainCode);
        return Result.success(relations);
    }
}
