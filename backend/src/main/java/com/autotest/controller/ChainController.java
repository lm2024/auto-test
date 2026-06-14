package com.autotest.controller;

import com.autotest.model.dto.*;
import com.autotest.model.vo.*;
import com.autotest.service.ChainService;
import com.autotest.service.VersionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
            @RequestParam(required = false) Integer executeMode) {
        List<ChainVO> list = chainService.listChains(chainName, executeMode);
        return Result.success(list);
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

    @DeleteMapping("/version/delete")
    public Result<?> deleteVersion(@Valid @RequestBody VersionDeleteDTO dto) {
        versionService.deleteVersion(dto);
        return Result.success();
    }

    @PostMapping("/version/batchDelete")
    public Result<?> batchDeleteVersions(@Valid @RequestBody BatchVersionDeleteDTO dto) {
        versionService.batchDeleteVersions(dto.getChainCode(), dto.getBeforeVersion());
        return Result.success();
    }
}
