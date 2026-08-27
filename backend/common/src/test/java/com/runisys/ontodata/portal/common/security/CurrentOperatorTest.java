package com.runisys.ontodata.portal.common.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class CurrentOperatorTest {

  @AfterEach
  void clearSecurity() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void unauthenticatedFallsBackToDevUser() {
    assertEquals("dev-user", CurrentOperator.name());
    assertEquals(List.of(), CurrentOperator.roles());
  }

  @Test
  void authenticatedNameComesFromPrincipal() {
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken("tester", "n/a", List.of()));
    assertEquals("tester", CurrentOperator.name());
    assertEquals(List.of(), CurrentOperator.roles());
  }

  @Test
  void requireMatchesRejectsOtherIdentity() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> CurrentOperator.requireMatches("alice"));
    assertTrue(error.getMessage().contains("不一致"));
  }

  @Test
  void requireMatchesIgnoresBlank() {
    CurrentOperator.requireMatches(null);
    CurrentOperator.requireMatches("  ");
  }
}
