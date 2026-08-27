package com.runisys.ontodata.portal.personalcenter.infrastructure;

import com.runisys.ontodata.portal.personalcenter.domain.PortalNotification;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 门户通知仓库。 */
public interface PortalNotificationRepository extends JpaRepository<PortalNotification, String> {

  Optional<PortalNotification> findByTenantIdAndTypeAndResourceRefAndRecipient(
      String tenantId, String type, String resourceRef, String recipient);

  Page<PortalNotification> findByTenantIdAndRecipientInOrderByCreatedAtDesc(
      String tenantId, Collection<String> recipients, Pageable pageable);

  long countByTenantIdAndRecipientInAndReadAtIsNull(String tenantId, Collection<String> recipients);

  Optional<PortalNotification> findByIdAndTenantId(String id, String tenantId);

  @Modifying
  @Query(
      "update PortalNotification n set n.readAt = :now where n.tenantId = :tenantId"
          + " and n.recipient in :recipients and n.readAt is null")
  int markAllRead(
      @Param("tenantId") String tenantId,
      @Param("recipients") Collection<String> recipients,
      @Param("now") java.time.Instant now);

  List<PortalNotification> findByTenantIdAndRecipientIn(String tenantId, Collection<String> recipients);
}
