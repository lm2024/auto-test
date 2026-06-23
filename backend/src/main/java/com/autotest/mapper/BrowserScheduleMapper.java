package com.autotest.mapper;

import com.autotest.model.entity.BrowserSchedule;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface BrowserScheduleMapper {
    int insert(BrowserSchedule record);
    int update(BrowserSchedule record);
    int deleteByChainCode(@Param("chainCode") String chainCode);
    BrowserSchedule selectByChainCode(@Param("chainCode") String chainCode);
    List<BrowserSchedule> selectEnabled();
}
