package com.autotest.service.impl;

import com.autotest.context.TenantContext;
import com.autotest.exception.BusinessException;
import com.autotest.mapper.SysProductMapper;
import com.autotest.model.entity.SysProduct;
import com.autotest.service.ProductService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProductServiceImpl implements ProductService {

    private static final Logger log = LoggerFactory.getLogger(ProductServiceImpl.class);

    @Autowired
    private SysProductMapper productMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysProduct createProduct(SysProduct product) {
        if (product.getProductCode() == null || product.getProductCode().trim().isEmpty()) {
            throw new BusinessException(400, "产品编码不能为空");
        }
        if (product.getProductName() == null || product.getProductName().trim().isEmpty()) {
            throw new BusinessException(400, "产品名称不能为空");
        }
        if (product.getTenantId() == null) {
            // 从当前用户上下文获取 tenantId
            Long tenantId = TenantContext.getTenantId();
            product.setTenantId(tenantId);
        }
        if (productMapper.selectByProductCode(product.getProductCode().trim()) != null) {
            throw new BusinessException(409, "产品编码已存在: " + product.getProductCode());
        }
        product.setProductCode(product.getProductCode().trim());
        product.setProductName(product.getProductName().trim());
        if (product.getStatus() == null) {
            product.setStatus(1);
        }
        productMapper.insert(product);
        return productMapper.selectById(product.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SysProduct updateProduct(SysProduct product) {
        if (product.getId() == null) {
            throw new BusinessException(400, "产品ID不能为空");
        }
        SysProduct existing = productMapper.selectById(product.getId());
        if (existing == null) {
            throw new BusinessException(404, "产品不存在");
        }
        if (product.getProductCode() != null && !product.getProductCode().equals(existing.getProductCode())) {
            if (productMapper.selectByProductCode(product.getProductCode()) != null) {
                throw new BusinessException(409, "产品编码已存在: " + product.getProductCode());
            }
        }
        productMapper.update(product);
        return productMapper.selectById(product.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteProduct(Long id) {
        if (id == null) {
            throw new BusinessException(400, "产品ID不能为空");
        }
        SysProduct existing = productMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "产品不存在");
        }
        productMapper.deleteById(id);
    }

    @Override
    public SysProduct getProductById(Long id) {
        return productMapper.selectById(id);
    }

    @Override
    public SysProduct getProductByCode(String productCode) {
        return productMapper.selectByProductCode(productCode);
    }

    @Override
    public Map<String, Object> listProducts(Long tenantId, String productName, Integer status, int page, int pageSize) {
        int offset = (page - 1) * pageSize;
        List<SysProduct> list = productMapper.selectList(tenantId, productName, status, offset, pageSize);
        int total = productMapper.countList(tenantId, productName, status);
        Map<String, Object> result = new HashMap<>();
        result.put("list", list);
        result.put("total", total);
        result.put("page", page);
        result.put("pageSize", pageSize);
        return result;
    }
}
