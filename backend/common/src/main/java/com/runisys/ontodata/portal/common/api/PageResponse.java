package com.runisys.ontodata.portal.common.api;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/** 平台公共分页响应。接口页码从 1 开始，避免前端 Ant Design Vue 分页器反复换算； Repository 内部仍使用 Spring Data 从 0 开始的页码。 */
public final class PageResponse<T> {

  private final List<T> items;
  private final int page;
  private final int size;
  private final long total;
  private final int totalPages;

  public PageResponse(List<T> items, int page, int size, long total, int totalPages) {
    this.items = Collections.unmodifiableList(new ArrayList<T>(items));
    this.page = page;
    this.size = size;
    this.total = total;
    this.totalPages = totalPages;
  }

  public static <S, T> PageResponse<T> from(Page<S> source, List<T> items) {
    return new PageResponse<T>(
        items,
        source.getNumber() + 1,
        source.getSize(),
        source.getTotalElements(),
        source.getTotalPages());
  }

  /** 在保留原始分页元数据的同时转换领域实体，避免各服务重复组装页码和总数。 */
  public static <S, T> PageResponse<T> map(Page<S> source, Function<S, T> mapper) {
    List<T> items = new ArrayList<T>();
    for (S item : source.getContent()) {
      items.add(mapper.apply(item));
    }
    return from(source, items);
  }

  public List<T> getItems() {
    return items;
  }

  public int getPage() {
    return page;
  }

  public int getSize() {
    return size;
  }

  public long getTotal() {
    return total;
  }

  public int getTotalPages() {
    return totalPages;
  }
}
