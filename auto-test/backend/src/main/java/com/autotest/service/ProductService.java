package com.autotest.service;

import com.autotest.model.entity.SysProduct;

import java.util.List;
import java.util.Map;

public interface ProductService {
    SysProduct createProduct(SysProduct product);
    SysProduct updateProduct(SysProduct product);
    void deleteProduct(Long id);
    SysProduct getProductById(Long id);
    SysProduct getProductByCode(String productCode);
    Map<String, Object> listProducts(Long tenantId, String productName, Integer status, int page, int pageSize);
}
