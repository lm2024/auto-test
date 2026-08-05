package com.autotest.mapper;

import com.autotest.model.vo.CallGraphRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 调用关系图查询 Mapper，只做只读聚合查询，不改动既有节点/链路 Mapper。
 */
@Mapper
public interface CallGraphMapper {

    /**
     * 查询节点调用记录，chainCode 为空时查全部链路
     */
    List<CallGraphRow> selectCallRows(@Param("chainCode") String chainCode);
}
