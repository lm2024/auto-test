package com.autotest.engine.browser;

import com.autotest.mapper.BrowserScheduleMapper;
import com.autotest.model.entity.BrowserSchedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.util.Date;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Component
public class BrowserTaskScheduler {

    private static final Logger log = LoggerFactory.getLogger(BrowserTaskScheduler.class);

    @Autowired
    private BrowserScheduleMapper scheduleMapper;

    private final ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
    private final ConcurrentHashMap<String, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        taskScheduler.setPoolSize(10);
        taskScheduler.setThreadNamePrefix("browser-cron-");
        taskScheduler.initialize();
        reloadAllSchedules();
    }

    public void reloadAllSchedules() {
        try {
            java.util.List<BrowserSchedule> schedules = scheduleMapper.selectEnabled();
            for (BrowserSchedule schedule : schedules) {
                scheduleTask(schedule.getChainCode(), schedule.getCronExpression());
            }
            log.info("Loaded {} scheduled browser tasks", schedules.size());
        } catch (Exception e) {
            log.warn("Failed to reload schedules: {}", e.getMessage());
        }
    }

    public void scheduleTask(String chainCode, String cronExpression) {
        cancelTask(chainCode);
        try {
            CronTrigger trigger = new CronTrigger(cronExpression);
            ScheduledFuture<?> future = taskScheduler.schedule(() -> {
                try {
                    log.info("Cron triggered: chainCode={}", chainCode);
                    BrowserSchedule schedule = scheduleMapper.selectByChainCode(chainCode);
                    if (schedule != null) {
                        schedule.setLastRunTime(new Date());
                        scheduleMapper.update(schedule);
                    }
                } catch (Exception e) {
                    log.error("Cron execution failed: chainCode={}", chainCode, e);
                }
            }, trigger);
            scheduledTasks.put(chainCode, future);
            log.info("Scheduled chain: chainCode={}, cron={}", chainCode, cronExpression);
        } catch (Exception e) {
            log.error("Failed to schedule: chainCode={}", chainCode, e);
        }
    }

    public void cancelTask(String chainCode) {
        ScheduledFuture<?> future = scheduledTasks.remove(chainCode);
        if (future != null) {
            future.cancel(false);
            log.info("Cancelled scheduled chain: chainCode={}", chainCode);
        }
    }
}
