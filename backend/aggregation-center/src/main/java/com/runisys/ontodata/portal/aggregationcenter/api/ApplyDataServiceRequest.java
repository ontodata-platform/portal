package com.runisys.ontodata.portal.aggregationcenter.api;

import jakarta.validation.constraints.Size;
import java.util.List;

/** 数据商城申请：字段子集可空（空=整服务申请）。 */
public class ApplyDataServiceRequest {

  @Size(max = 500, message = "授权字段过多")
  private List<String> grantedColumns;

  public List<String> getGrantedColumns() {
    return grantedColumns;
  }

  public void setGrantedColumns(List<String> grantedColumns) {
    this.grantedColumns = grantedColumns;
  }
}
