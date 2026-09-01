package com.runisys.ontodata.portal.common.api;

import com.runisys.ontodata.sdk.web.InvalidPageRequestException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * 外围目录统一使用的查询参数。
 *
 * <p>客户端只能提交公开排序别名；实体字段由各领域服务通过白名单映射，禁止把用户输入直接传给 JPA 或 SQL。接口页码从 1 开始，内部转换为 Spring Data 从 0 开始的页码。
 */
public class PageRequestParameters {

  @Min(value = 1, message = "页码必须大于等于 1")
  private int page = 1;

  @Min(value = 1, message = "每页数量必须大于等于 1")
  @Max(value = 100, message = "每页数量不能超过 100")
  private int size = 20;

  @Size(max = 40, message = "排序字段不能超过 40 个字符")
  private String sortBy;

  @Pattern(regexp = "(?i)asc|desc", message = "排序方向只能是 asc 或 desc")
  private String sortDirection = "desc";

  @Size(max = 120, message = "搜索关键字不能超过 120 个字符")
  private String keyword;

  @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}", message = "状态筛选格式不正确")
  private String status;

  @Pattern(regexp = "[A-Z][A-Z0-9_]{0,39}", message = "类型筛选格式不正确")
  private String type;

  @Size(max = 100, message = "领域筛选不能超过 100 个字符")
  private String domain;

  public Pageable toPageable(Map<String, String> allowedSorts, String defaultSort) {
    String requested = trimToNull(sortBy);
    String publicField = requested == null ? defaultSort : requested;
    String entityField = allowedSorts.get(publicField);
    if (entityField == null) {
      throw new InvalidPageRequestException("不支持的排序字段：" + publicField);
    }
    Sort.Direction direction =
        "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
    return PageRequest.of(page - 1, size, Sort.by(direction, entityField));
  }

  private String trimToNull(String value) {
    return value == null || value.trim().isEmpty() ? null : value.trim();
  }

  public int getPage() {
    return page;
  }

  public void setPage(int page) {
    this.page = page;
  }

  public int getSize() {
    return size;
  }

  public void setSize(int size) {
    this.size = size;
  }

  public String getSortBy() {
    return sortBy;
  }

  public void setSortBy(String sortBy) {
    this.sortBy = sortBy;
  }

  public String getSortDirection() {
    return sortDirection;
  }

  public void setSortDirection(String sortDirection) {
    this.sortDirection = sortDirection;
  }

  public String getKeyword() {
    return trimToNull(keyword);
  }

  public void setKeyword(String keyword) {
    this.keyword = keyword;
  }

  public String getStatus() {
    return trimToNull(status);
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getType() {
    return trimToNull(type);
  }

  public void setType(String type) {
    this.type = type;
  }

  public String getDomain() {
    return trimToNull(domain);
  }

  public void setDomain(String domain) {
    this.domain = domain;
  }
}
