---
type: reference
project: auto-test
tags: [backend, exception, error-handling]
updated_at: "2026-06-13"
created_at: "2026-06-13"
---

# 异常处理 (Error Handling)

> 全局异常处理机制和自定义业务异常。

## 全局异常处理器 (GlobalExceptionHandler)

文件: `exception/GlobalExceptionHandler.java`

使用 `@RestControllerAdvice` 统一捕获所有 Controller 层的异常。

### 异常类型处理

| 异常类型 | 处理方法 | 返回码 | 说明 |
|----------|----------|--------|------|
| `BusinessException` | `handleBusinessException()` | 自定义 | 业务逻辑错误 |
| `MethodArgumentNotValidException` | `handleValidationException()` | 400 | 参数校验失败 |
| `Exception` | `handleException()` | 500 | 未预期异常 |

### 处理逻辑

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public Result<?> handleBusinessException(BusinessException e) {
        log.warn("Business exception: {}", e.getMessage());
        return Result.error(e.getCode(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<?> handleValidationException(MethodArgumentNotValidException e) {
        // 拼接所有字段错误: "field1: error1; field2: error2"
        return Result.error(400, message);
    }

    @ExceptionHandler(Exception.class)
    public Result<?> handleException(Exception e) {
        log.error("Unexpected exception", e);
        return Result.error(500, "服务器内部错误: " + e.getMessage());
    }
}
```

## 业务异常 (BusinessException)

文件: `exception/BusinessException.java`

```java
public class BusinessException extends RuntimeException {
    private int code;  // 默认 400
}
```

**使用场景**:
- 链路不存在
- 节点编码重复
- 参数不合法
- 执行状态不正确

**构造方式**:
```java
throw new BusinessException("链路不存在");           // code = 400
throw new BusinessException(404, "资源未找到");       // code = 404
```

## 统一响应 (Result)

文件: `model/vo/Result.java`

```java
public class Result<T> {
    private int code;    // 状态码: 200=成功, 400=客户端错误, 500=服务器错误
    private String message; // 消息
    private T data;       // 数据
}
```

**静态工厂方法**:
```java
Result.success(data)       // { code: 200, message: "success", data: ... }
Result.success()           // { code: 200, message: "success", data: null }
Result.error(message)      // { code: 500, message: ..., data: null }
Result.error(code, message) // { code: 自定义, message: ..., data: null }
```

## 相关

- [[chain-management]] — 控制器中业务异常的抛出点
- [[execution-engine]] — 执行过程中的异常处理
- [[frontend-pages#execute-detail]] — 前端执行详情中的错误展示
- [[data-models#result]] — Result 统一响应模型
