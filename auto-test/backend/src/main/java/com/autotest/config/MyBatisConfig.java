package com.autotest.config;

import org.springframework.context.annotation.Configuration;

/**
 * MyBatis 配置。
 * TenantInterceptor 作为 @Component 自动注册为 MyBatis Plugin，
 * mybatis-spring-boot-starter 会自动扫描 Interceptor 类型的 Bean 并注册。
 */
@Configuration
public class MyBatisConfig {
    // TenantInterceptor 已标注 @Component，
    // mybatis-spring-boot-starter 2.x 会自动将其注册为 MyBatis Plugin
}
