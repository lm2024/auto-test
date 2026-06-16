package com.autotest;

import com.autotest.filter.BizOperTraceFilter;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@MapperScan("com.autotest.mapper")
@EnableAsync
public class AutoTestApplication {
    public static void main(String[] args) {
        SpringApplication.run(AutoTestApplication.class, args);
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
