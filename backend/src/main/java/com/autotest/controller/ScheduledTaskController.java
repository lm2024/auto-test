package com.autotest.controller;

import com.autotest.model.entity.SysScheduledTask;
import com.autotest.model.vo.Result;
import com.autotest.service.ScheduledTaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/task")
public class ScheduledTaskController {

    @Autowired
    private ScheduledTaskService taskService;

    @PostMapping("/create")
    public Result<?> createTask(@RequestBody SysScheduledTask task) {
        SysScheduledTask created = taskService.createTask(task);
        return Result.success(created);
    }

    @PutMapping("/update")
    public Result<?> updateTask(@RequestParam Long id, @RequestBody SysScheduledTask task) {
        task.setId(id);
        SysScheduledTask updated = taskService.updateTask(task);
        return Result.success(updated);
    }

    @DeleteMapping("/delete")
    public Result<?> deleteTask(@RequestParam Long id) {
        taskService.deleteTask(id);
        return Result.success();
    }

    @GetMapping("/list")
    public Result<?> listTasks(
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        List<SysScheduledTask> list = taskService.listTasks(null, pageNo, pageSize);
        int total = taskService.countTasks(null);
        Map<String, Object> data = new HashMap<>();
        data.put("list", list);
        data.put("total", total);
        data.put("pageNo", pageNo);
        data.put("pageSize", pageSize);
        return Result.success(data);
    }

    @PutMapping("/toggle")
    public Result<?> toggleTask(@RequestParam Long id) {
        taskService.toggleTask(id);
        return Result.success();
    }

    @PostMapping("/trigger")
    public Result<?> triggerTask(@RequestParam Long id) {
        taskService.triggerTask(id);
        return Result.success();
    }
}
