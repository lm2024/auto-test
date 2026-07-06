package com.autotest;

import com.autotest.filter.BizOperTraceFilter;
import com.autotest.mapper.SysUserMapper;
import com.autotest.model.entity.SysUser;
import com.autotest.service.ScheduledTaskService;
import org.mybatis.spring.annotation.MapperScan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@SpringBootApplication
@MapperScan("com.autotest.mapper")
@EnableAsync
@EnableScheduling
public class AutoTestApplication implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AutoTestApplication.class);

    @Autowired
    private ScheduledTaskService scheduledTaskService;

    @Autowired
    private SysUserMapper userMapper;

    public static void main(String[] args) {
        SpringApplication.run(AutoTestApplication.class, args);
    }

    @Override
    public void run(String... args) {
        // Init admin password
        try {
            SysUser admin = userMapper.selectByUsername("admin");
            if (admin != null) {
                BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
                if (!encoder.matches("admin123", admin.getPassword())) {
                    SysUser update = new SysUser();
                    update.setId(admin.getId());
                    update.setPassword(encoder.encode("admin123"));
                    userMapper.update(update);
                    log.info("Admin user password initialized");
                }
            }
        } catch (Exception e) {
            log.warn("Could not init admin password: {}", e.getMessage());
        }
        // Start scheduler
        try {
            scheduledTaskService.startScheduler();
        } catch (Exception e) {
            log.warn("Could not start scheduler: {}", e.getMessage());
        }
    }

    @Bean
    public FilterRegistrationBean<BizOperTraceFilter> bizOperTraceFilter() {
        FilterRegistrationBean<BizOperTraceFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new BizOperTraceFilter());
        registrationBean.addUrlPatterns("/api/*");
        registrationBean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registrationBean;
    }
}
