package com.runisys.ontodata.portal.personalcenter.api;

/** 未读通知计数。 */
public class UnreadCountResponse {

  private final long unread;

  public UnreadCountResponse(long unread) {
    this.unread = unread;
  }

  public long getUnread() {
    return unread;
  }
}
