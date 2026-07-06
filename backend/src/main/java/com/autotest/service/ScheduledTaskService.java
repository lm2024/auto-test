package com.autotest.service;

import com.autotest.model.entity.SysScheduledTask;

import java.util.List;

public interface ScheduledTaskService {
    SysScheduledTask createTask(SysScheduledTask task);
    SysScheduledTask updateTask(SysScheduledTask task);
    void deleteTask(Long id);
    List<SysScheduledTask> listTasks(Long tenantId, int pageNo, int pageSize);
    int countTasks(Long tenantId);
    void toggleTask(Long id);
    void triggerTask(Long id);
    void startScheduler();
}
