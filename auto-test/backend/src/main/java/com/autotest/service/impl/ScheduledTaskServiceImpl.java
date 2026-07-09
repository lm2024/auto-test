package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.mapper.SysCategoryMapper;
import com.autotest.mapper.SysScheduledTaskMapper;
import com.autotest.mapper.SysTaskExecuteLogMapper;
import com.autotest.model.entity.SysCategory;
import com.autotest.model.entity.SysScheduledTask;
import com.autotest.model.entity.SysTaskExecuteLog;
import com.autotest.model.entity.TestChain;
import com.autotest.mapper.TestChainMapper;
import com.autotest.service.ExecuteService;
import com.autotest.service.ScheduledTaskService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class ScheduledTaskServiceImpl implements ScheduledTaskService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledTaskServiceImpl.class);

    @Autowired
    private SysScheduledTaskMapper taskMapper;

    @Autowired
    private SysTaskExecuteLogMapper logMapper;

    @Autowired
    private TestChainMapper chainMapper;

    @Autowired
    private SysCategoryMapper categoryMapper;

    @Autowired
    private ExecuteService executeService;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final Map<Long, java.util.concurrent.ScheduledFuture<?>> runningTasks = new HashMap<>();

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysScheduledTask createTask(SysScheduledTask task) {
        if (task.getEnabled() == null) task.setEnabled(1);
        taskMapper.insert(task);
        if (task.getEnabled() == 1) {
            scheduleTask(task);
        }
        return taskMapper.selectById(task.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysScheduledTask updateTask(SysScheduledTask task) {
        SysScheduledTask existing = taskMapper.selectById(task.getId());
        if (existing == null) {
            throw new BusinessException(404, "任务不存在");
        }
        taskMapper.update(task);
        // Reschedule
        cancelTask(task.getId());
        SysScheduledTask updated = taskMapper.selectById(task.getId());
        if (updated.getEnabled() == 1) {
            scheduleTask(updated);
        }
        return updated;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteTask(Long id) {
        cancelTask(id);
        taskMapper.deleteById(id);
    }

    @Override
    public List<SysScheduledTask> listTasks(Long tenantId, int pageNo, int pageSize) {
        int offset = (pageNo - 1) * pageSize;
        return taskMapper.selectAll(tenantId).subList(offset, Math.min(offset + pageSize, taskMapper.selectAll(tenantId).size()));
    }

    @Override
    public int countTasks(Long tenantId) {
        return taskMapper.countAll(tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void toggleTask(Long id) {
        SysScheduledTask task = taskMapper.selectById(id);
        if (task == null) throw new BusinessException(404, "任务不存在");
        int newEnabled = task.getEnabled() == 1 ? 0 : 1;
        SysScheduledTask update = new SysScheduledTask();
        update.setId(id);
        update.setEnabled(newEnabled);
        taskMapper.update(update);
        if (newEnabled == 1) {
            scheduleTask(taskMapper.selectById(id));
        } else {
            cancelTask(id);
        }
    }

    @Override
    public void triggerTask(Long id) {
        executeTask(id, "MANUAL");
    }

    @Override
    public void startScheduler() {
        List<SysScheduledTask> enabledTasks = taskMapper.selectEnabled(null);
        for (SysScheduledTask task : enabledTasks) {
            scheduleTask(task);
        }
        log.info("Scheduled task scheduler started with {} tasks", enabledTasks.size());
    }

    private void scheduleTask(SysScheduledTask task) {
        long intervalMs = 0;
        if (task.getIntervalMinutes() != null && task.getIntervalMinutes() > 0) {
            intervalMs = task.getIntervalMinutes() * 60 * 1000L;
        } else {
            intervalMs = 60 * 60 * 1000L; // Default 1 hour
        }

        java.util.concurrent.ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(
                () -> executeTask(task.getId(), "SCHEDULED"),
                intervalMs, intervalMs, TimeUnit.MILLISECONDS
        );
        runningTasks.put(task.getId(), future);
        log.info("Scheduled task {} with interval {}ms", task.getTaskName(), intervalMs);
    }

    private void cancelTask(Long taskId) {
        java.util.concurrent.ScheduledFuture<?> future = runningTasks.remove(taskId);
        if (future != null) {
            future.cancel(false);
        }
    }

    private void executeTask(Long taskId, String triggerType) {
        SysScheduledTask task = taskMapper.selectById(taskId);
        if (task == null || task.getEnabled() != 1) return;

        SysTaskExecuteLog executeLog = new SysTaskExecuteLog();
        executeLog.setTaskId(taskId);
        executeLog.setTriggerType(triggerType);
        executeLog.setStartTime(new Date());
        executeLog.setStatus("RUNNING");

        try {
            List<String> executionIds = new ArrayList<>();

            if ("SINGLE".equals(task.getTaskType()) && task.getChainCode() != null) {
                String executionId = executeService.runChain(task.getChainCode());
                executionIds.add(executionId);
            } else if ("CATEGORY".equals(task.getTaskType()) && task.getCategoryId() != null) {
                List<TestChain> chains = chainMapper.selectListByCategory(
                        null, null, null, null, null,
                        task.getCategoryId() != null ? Collections.singletonList(task.getCategoryId()) : null,
                        0, 1000);
                for (TestChain chain : chains) {
                    try {
                        String executionId = executeService.runChain(chain.getChainCode());
                        executionIds.add(executionId);
                    } catch (Exception e) {
                        log.error("Failed to execute chain {}: {}", chain.getChainCode(), e.getMessage());
                    }
                }
            }

            executeLog.setExecutionIds(String.join(",", executionIds));
            executeLog.setStatus("SUCCESS");
            executeLog.setEndTime(new Date());
            taskMapper.updateLastRunTime(taskId);
        } catch (Exception e) {
            log.error("Task execution failed: {}", e.getMessage());
            executeLog.setStatus("FAILED");
            executeLog.setErrorMessage(e.getMessage());
            executeLog.setEndTime(new Date());
        }

        logMapper.insert(executeLog);
    }
}
