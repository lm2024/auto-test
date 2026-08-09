package com.autotest.service.impl;

import com.autotest.exception.BusinessException;
import com.autotest.context.TenantContext;
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
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.time.Duration;
import java.time.ZonedDateTime;

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
        validateTask(task, false);
        if (task.getTenantId() == null) task.setTenantId(TenantContext.getTenantId());
        if (task.getEnabled() == null) task.setEnabled(1);
        applyDefaults(task);
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
        validateTask(task, true);
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
        pageNo = Math.max(pageNo, 1);
        pageSize = Math.max(Math.min(pageSize, 100), 1);
        int offset = (pageNo - 1) * pageSize;
        List<SysScheduledTask> all = taskMapper.selectAll(tenantId);
        if (offset >= all.size()) return new ArrayList<SysScheduledTask>();
        return all.subList(offset, Math.min(offset + pageSize, all.size()));
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
        SysScheduledTask task = taskMapper.selectById(id);
        if (task == null) throw new BusinessException(404, "任务不存在");
        if (task.getEnabled() == null || task.getEnabled() != 1) {
            throw new BusinessException(400, "请先启用任务再执行");
        }
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
        cancelTask(task.getId());
        if (task.getCronExpression() != null && !task.getCronExpression().trim().isEmpty()) {
            scheduleCronTask(task);
            return;
        }
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

    private void scheduleCronTask(SysScheduledTask task) {
        CronExpression cron = CronExpression.parse(task.getCronExpression().trim());
        ZonedDateTime now = ZonedDateTime.now();
        ZonedDateTime next = cron.next(now);
        if (next == null) throw new IllegalArgumentException("Cron 表达式没有下一次执行时间");
        long delayMs = Math.max(Duration.between(now, next).toMillis(), 1L);
        java.util.concurrent.ScheduledFuture<?> future = scheduler.schedule(() -> {
            executeTask(task.getId(), "SCHEDULED");
            SysScheduledTask latest = taskMapper.selectById(task.getId());
            if (latest != null && latest.getEnabled() == 1) scheduleCronTask(latest);
        }, delayMs, TimeUnit.MILLISECONDS);
        runningTasks.put(task.getId(), future);
        log.info("Scheduled task {} with cron {} next at {}", task.getTaskName(), task.getCronExpression(), next);
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

        // 通过接口调用，兼容 @Async 生成的代理对象。
        ExecuteService executeServiceExt = executeService;

        SysTaskExecuteLog executeLog = new SysTaskExecuteLog();
        executeLog.setTaskId(taskId);
        executeLog.setTriggerType(triggerType);
        executeLog.setStartTime(new Date());
        executeLog.setStatus("RUNNING");

        int roundCount = task.getRoundCount() != null && task.getRoundCount() > 0 ? task.getRoundCount() : 1;
        boolean useDataPool = task.getUseDataPool() != null && task.getUseDataPool() == 1;

        try {
            List<String> allExecutionIds = new ArrayList<>();

            for (int round = 0; round < roundCount; round++) {
                List<String> roundExecutionIds = new ArrayList<>();

                if ("SINGLE".equals(task.getTaskType()) && task.getChainCode() != null) {
                    String executionId;
                    if (useDataPool && task.getDataPoolCode() != null && !task.getDataPoolCode().isEmpty()) {
                        executionId = executeServiceExt.runChainWithParams(task.getChainCode(), round, String.valueOf(taskId));
                    } else {
                        executionId = executeServiceExt.runChainWithParams(task.getChainCode(), round, String.valueOf(taskId));
                    }
                    roundExecutionIds.add(executionId);
                } else if ("CATEGORY".equals(task.getTaskType()) && task.getCategoryId() != null) {
                    List<TestChain> chains = chainMapper.selectListByCategory(
                            null, null, null, null, null,
                            task.getCategoryId() != null ? Collections.singletonList(task.getCategoryId()) : null,
                            0, 1000);
                    for (TestChain chain : chains) {
                        try {
                            String executionId;
                            if (useDataPool && task.getDataPoolCode() != null && !task.getDataPoolCode().isEmpty()) {
                                executionId = executeServiceExt.runChainWithParams(chain.getChainCode(), round, String.valueOf(taskId));
                            } else {
                                executionId = executeServiceExt.runChainWithParams(chain.getChainCode(), round, String.valueOf(taskId));
                            }
                            roundExecutionIds.add(executionId);
                        } catch (Exception e) {
                            log.error("Failed to execute chain {}: {}", chain.getChainCode(), e.getMessage());
                        }
                    }
                }

                allExecutionIds.addAll(roundExecutionIds);

                // 轮次间隔
                if (round < roundCount - 1 && task.getRoundIntervalMs() != null && task.getRoundIntervalMs() > 0) {
                    try {
                        Thread.sleep(task.getRoundIntervalMs());
                    } catch (InterruptedException ignored) {}
                }

                log.info("[ScheduledTask] 任务 {} 第 {}/{} 轮执行完成", task.getTaskName(), round + 1, roundCount);
            }

            executeLog.setExecutionIds(String.join(",", allExecutionIds));
            executeLog.setTotalRounds(roundCount);
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

    private void applyDefaults(SysScheduledTask task) {
        if (task.getRoundCount() == null || task.getRoundCount() < 1) task.setRoundCount(1);
        if (task.getRoundIntervalMs() == null || task.getRoundIntervalMs() < 0) task.setRoundIntervalMs(0);
        if (task.getUseDataPool() == null) task.setUseDataPool(0);
        if (task.getEnabled() == null) task.setEnabled(1);
    }

    private void validateTask(SysScheduledTask task, boolean partialUpdate) {
        if (task == null) throw new BusinessException(400, "任务信息不能为空");
        if (!partialUpdate || task.getTaskName() != null) {
            if (isBlank(task.getTaskName())) throw new BusinessException(400, "任务名称不能为空");
        }
        if (task.getTaskType() != null && !"SINGLE".equals(task.getTaskType()) && !"CATEGORY".equals(task.getTaskType())) {
            throw new BusinessException(400, "任务类型必须是 SINGLE 或 CATEGORY");
        }
        String type = task.getTaskType();
        if (!partialUpdate || type != null) {
            if ("SINGLE".equals(type) && isBlank(task.getChainCode())) throw new BusinessException(400, "单链路任务必须选择链路");
            if ("CATEGORY".equals(type) && task.getCategoryId() == null) throw new BusinessException(400, "按分类任务必须选择分类");
        }
        if (task.getIntervalMinutes() != null && task.getIntervalMinutes() < 1) {
            throw new BusinessException(400, "间隔分钟数必须大于 0");
        }
        if (!isBlank(task.getCronExpression())) {
            try { CronExpression.parse(task.getCronExpression().trim()); }
            catch (Exception e) { throw new BusinessException(400, "Cron 表达式不合法"); }
        }
        if (!partialUpdate && isBlank(task.getCronExpression()) && task.getIntervalMinutes() == null) {
            throw new BusinessException(400, "Cron 表达式和间隔分钟数至少填写一个");
        }
        if (task.getRoundCount() != null && task.getRoundCount() < 1) throw new BusinessException(400, "执行轮数必须大于 0");
    }

    private boolean isBlank(String value) { return value == null || value.trim().isEmpty(); }
}
