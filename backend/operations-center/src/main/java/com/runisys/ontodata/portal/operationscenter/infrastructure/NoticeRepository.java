package com.runisys.ontodata.portal.operationscenter.infrastructure;

import com.runisys.ontodata.portal.operationscenter.domain.Notice;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 公告仓库。 */
public interface NoticeRepository
    extends JpaRepository<Notice, String>, JpaSpecificationExecutor<Notice> {

  Optional<Notice> findByCode(String code);

  long countByStatus(String status);

  /** 数据保留（M5）：只统计超过保留期的已归档公告。 */
  @Query("select count(n) from Notice n where n.status in :statuses and n.createdAt < :cutoff")
  long countTerminalOlderThan(
      @Param("statuses") Collection<String> statuses, @Param("cutoff") Instant cutoff);

  /** 数据保留（M5）：删除超过保留期的已归档公告。 */
  @Modifying
  @Query("delete from Notice n where n.status in :statuses and n.createdAt < :cutoff")
  int deleteTerminalOlderThan(
      @Param("statuses") Collection<String> statuses, @Param("cutoff") Instant cutoff);
}
