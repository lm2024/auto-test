package com.autotest.controller;

import com.autotest.model.entity.SysProduct;
import com.autotest.model.vo.Result;
import com.autotest.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 产品管理 Controller
 * 路由前缀：/api/product
 */
@RestController
@RequestMapping("/api/product")
public class ProductController {

    @Autowired
    private ProductService productService;

    @PostMapping("/create")
    public Result<?> createProduct(@RequestBody SysProduct product) {
        SysProduct created = productService.createProduct(product);
        return Result.success(created);
    }

    @PutMapping("/update")
    public Result<?> updateProduct(@RequestBody SysProduct product) {
        SysProduct updated = productService.updateProduct(product);
        return Result.success(updated);
    }

    @DeleteMapping("/delete")
    public Result<?> deleteProduct(@RequestParam Long id) {
        productService.deleteProduct(id);
        return Result.success();
    }

    @GetMapping("/detail")
    public Result<?> getProduct(@RequestParam Long id) {
        SysProduct product = productService.getProductById(id);
        return Result.success(product);
    }

    @GetMapping("/list")
    public Result<?> listProducts(
            @RequestParam(required = false) Long tenantId,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) Integer status,
            @RequestParam(defaultValue = "1") int pageNo,
            @RequestParam(defaultValue = "10") int pageSize) {
        Map<String, Object> data = productService.listProducts(tenantId, productName, status, pageNo, pageSize);
        return Result.success(data);
    }
}
