package com.autotest.controller;

import com.autotest.model.dto.*;
import com.autotest.model.vo.DiffVO;
import com.autotest.model.vo.Result;
import com.autotest.model.vo.VersionVO;
import com.autotest.service.NodeConfigService;
import com.autotest.service.VersionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/plugin")
public class PluginReplayController {

    @Autowired
    private VersionService versionService;

    @PostMapping("/chain/replay/push")
    public Result<?> pushReplayResult(@Valid @RequestBody ReplayPushDTO dto) {
        Map<String, Object> data = versionService.pushReplayResult(dto);
        return Result.success(data);
    }
}
