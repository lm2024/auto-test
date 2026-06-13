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
        List<PluginInterfaceDTO> interfaces = (List<PluginInterfaceDTO>) params.get("interfaces");
        Map<String, Object> result = nodeConfigService.importNodes(chainCode, interfaces);
        return Result.success(result);
    }

    @GetMapping("/dependencies")
    public Result<?> getDependencies(@RequestParam String chainCode) {
        List<NodeConfigService.DependencyRelation> relations = nodeConfigService.identifyDependencies(chainCode);
        return Result.success(relations);
    }
}
