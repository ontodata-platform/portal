package com.runisys.ontodata.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.runisys.ontodata.portal.common.security.DataClassification;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/** OIDC claim → 上下文映射单元测试：租户必填校验、缺省值、失败安全兜底。 */
class OidcClaimMappingTest {

  private static Jwt jwt(Map<String, Object> claims) {
    Jwt.Builder builder = Jwt.withTokenValue("token").header("alg", "none");
    claims.forEach(builder::claim);
    return builder.build();
  }

  private static Authentication auth(Jwt token) {
    return new JwtAuthenticationToken(token, List.of(), "tester");
  }

  @Test
  void mapsTenantWithDefaultsWhenOptionalClaimsAbsent() {
    OidcClaimMapping.IdentityClaims claims =
        OidcClaimMapping.from(auth(jwt(Map.of("tenant_id", "tenant-a"))));

    assertEquals("tenant-a", claims.tenantId());
    assertNull(claims.orgId());
    assertNull(claims.projectId());
    assertEquals(DataClassification.INTERNAL, claims.clearance());
  }

  @Test
  void mapsFullAttributeSetFromClaims() {
    OidcClaimMapping.IdentityClaims claims =
        OidcClaimMapping.from(
            auth(
                jwt(
                    Map.of(
                        "tenant_id", "tenant-a",
                        "org_id", "org-1",
                        "project_id", "project-1",
                        "clearance", "SECRET"))));

    assertEquals("tenant-a", claims.tenantId());
    assertEquals("org-1", claims.orgId());
    assertEquals("project-1", claims.projectId());
    assertEquals(DataClassification.SECRET, claims.clearance());
  }

  @Test
  void rejectsMissingOrMalformedTenantClaimAsUntrusted() {
    assertNull(OidcClaimMapping.from(auth(jwt(Map.of("clearance", "SECRET")))));
    assertNull(OidcClaimMapping.from(auth(jwt(Map.of("tenant_id", "BAD TENANT!")))));
    assertNull(OidcClaimMapping.from(auth(jwt(Map.of("tenant_id", "")))));
  }

  @Test
  void rejectsNullAndUnauthenticated() {
    assertNull(OidcClaimMapping.from(null));
    assertNull(
        OidcClaimMapping.from(new UsernamePasswordAuthenticationToken("anonymous", null))); // 未认证
  }

  @Test
  void fallsBackSafelyOnInvalidClearanceAndOrgProject() {
    OidcClaimMapping.IdentityClaims claims =
        OidcClaimMapping.from(
            auth(
                jwt(
                    Map.of(
                        "tenant_id", "tenant-a",
                        "clearance", "TOP-SECRET",
                        "org_id", "BAD ORG!"))));

    assertEquals("tenant-a", claims.tenantId());
    assertEquals(DataClassification.INTERNAL, claims.clearance(), "非法密级按缺省处理（失败安全）");
    assertNull(claims.orgId(), "非法组织按未提供处理");
  }
}
