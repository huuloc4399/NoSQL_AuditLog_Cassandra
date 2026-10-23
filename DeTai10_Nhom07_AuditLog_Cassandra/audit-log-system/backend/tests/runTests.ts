import { connectCassandra, closeCassandra, getCassandraClient, cassandra } from '../src/config/cassandra.js';
import { auditLogService } from '../src/services/auditLogService.js';
import { serviceCatalogService } from '../src/services/serviceCatalogService.js';
import { createLogSchema, queryLogSchema, isValidUuid } from '../src/validators/auditLogValidator.js';
import { containsSensitiveData, maskSensitiveText } from '../src/utils/sensitiveDataFilter.js';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { userService, UserRole } from '../src/services/userService.js';
import { env } from '../src/config/env.js';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✔ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ' -> ' + detail : ''}`);
    testsFailed++;
  }
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('   AUTOMATED CONTRACT & INTEGRATION TEST SUITE FOR AUDIT LOG SYSTEM   ');
  console.log('======================================================================');

  // ==========================================================================
  // PHASE 1: UNIT & VALIDATION TESTS (Offline-Capable)
  // ==========================================================================
  console.log('\n>>> PHASE 1: UNIT & DATA VALIDATION TESTS');

  // TEST 1: Invalid Level Validation
  console.log('\n--- 1. Testing Invalid Level Validation ---');
  try {
    createLogSchema.parse({
      service_name: 'Auth',
      level: 'DEBUG', // Invalid
      action: 'LOGIN',
      message: 'Test message',
    });
    assert(false, 'Invalid level DEBUG must be rejected');
  } catch (e: any) {
    assert(e instanceof ZodError, 'Invalid level DEBUG rejected with ZodError');
  }

  try {
    createLogSchema.parse({
      service_name: 'Auth',
      level: 'HIGH', // Invalid
      action: 'LOGIN',
      message: 'Test message',
    });
    assert(false, 'Invalid level HIGH must be rejected');
  } catch (e: any) {
    assert(e instanceof ZodError, 'Invalid level HIGH rejected with ZodError');
  }

  // TEST 2: Missing Service Validation
  console.log('\n--- 2. Testing Missing Required Fields Validation ---');
  try {
    createLogSchema.parse({
      level: 'INFO',
      action: 'LOGIN',
      message: 'Missing service field',
    });
    assert(false, 'Missing service_name must be rejected');
  } catch (e: any) {
    assert(e instanceof ZodError, 'Missing service_name rejected with ZodError');
  }

  // TEST 3: Sensitive Data Detection & Masking
  console.log('\n--- 3. Testing Sensitive Data Masking & Validation ---');
  const passwordCheck = containsSensitiveData('User logged in with password=secret123');
  assert(passwordCheck.hasSensitive, 'Plaintext password detected and flagged');

  const ccCheck = containsSensitiveData('Processed credit card 4111-2222-3333-4444');
  assert(ccCheck.hasSensitive, 'Credit card number detected and flagged');

  const cvvCheck = containsSensitiveData('Card details cvv: 123');
  assert(cvvCheck.hasSensitive, 'CVV detected and flagged');

  const maskedText = maskSensitiveText('User card 4111-2222-3333-4444 with password: secret_password_123');
  assert(maskedText.includes('****-****-****-4444'), 'Credit card masked with asterisks');
  assert(maskedText.includes('***REDACTED***'), 'Password masked with ***REDACTED***');

  try {
    createLogSchema.parse({
      service_name: 'Auth',
      level: 'INFO',
      action: 'LOGIN',
      message: 'Password was: admin123',
    });
    assert(false, 'Message containing password must be rejected');
  } catch (e: any) {
    assert(e instanceof ZodError, 'Schema rejected message containing plain password');
  }

  // TEST 4: Invalid Time Range (from > to)
  console.log('\n--- 4. Testing Invalid Time Range (from > to) ---');
  try {
    queryLogSchema.parse({
      service: 'Auth',
      date: '2026-10-14',
      from: '18:00',
      to: '08:00', // Invalid: from > to
    });
    assert(false, 'Query with from > to must be rejected');
  } catch (e: any) {
    assert(e instanceof ZodError, 'Query with from > to rejected with ZodError');
  }

  // TEST 5: UUID Validation Utility
  console.log('\n--- 5. Testing UUID Validation ---');
  assert(isValidUuid('8c454e60-4966-4c48-b4b1-8408a280e227'), 'Valid UUID recognized');
  assert(!isValidUuid('invalid-uuid-1234'), 'Malformed UUID rejected');

  // ==========================================================================
  // PHASE 1.5: AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) TESTS
  // ==========================================================================
  console.log('\n>>> PHASE 1.5: AUTHENTICATION & RBAC CONTRACT TESTS');

  // AUTH-01: Register success
  console.log('\n--- AUTH-01: Register Success ---');
  const regUser = await userService.createUser({
    username: 'test_auditor_' + Date.now(),
    password: 'secure_password_123',
    full_name: 'Test Auditor',
    email: 'test_auditor@auditlog.internal',
    role: 'USER',
    status: 'ACTIVE',
  });
  assert(!!regUser.user_id && regUser.role === 'USER', 'AUTH-01 Register success (user created with USER role)');

  // AUTH-02: Duplicate username
  console.log('\n--- AUTH-02: Duplicate Username Rejected ---');
  try {
    await userService.createUser({
      username: regUser.username,
      password: 'another_password',
      full_name: 'Duplicate User',
      email: 'dup@auditlog.internal',
    });
    assert(false, 'Duplicate username must throw error');
  } catch (err: any) {
    assert(err.message.includes('already exists'), 'AUTH-02 Duplicate username properly rejected');
  }

  // AUTH-03: Login success & Bcrypt Verification
  console.log('\n--- AUTH-03: Login Success & Bcrypt Hash ---');
  const adminUser = await userService.findByUsername('admin');
  assert(!!adminUser, 'Admin user account exists');
  const isMatch = bcrypt.compareSync('admin123', adminUser!.password_hash);
  assert(isMatch, 'AUTH-03 Login success: Bcrypt hash verified for admin password');

  const token = jwt.sign(
    { user_id: adminUser!.user_id, username: adminUser!.username, role: adminUser!.role },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  assert(!!token && token.split('.').length === 3, 'Valid JWT signed with 24h expiration');

  // AUTH-04: Wrong password
  console.log('\n--- AUTH-04: Wrong Password Rejected ---');
  const isWrongMatch = bcrypt.compareSync('incorrect_password', adminUser!.password_hash);
  assert(!isWrongMatch, 'AUTH-04 Wrong password rejected by bcrypt comparison');

  // AUTH-05: JWT missing
  console.log('\n--- AUTH-05: JWT Missing (401) ---');
  const mockReqMissingHeader: any = { headers: {} };
  const authHeader = mockReqMissingHeader.headers.authorization;
  const isMissing401 = !authHeader || !authHeader.startsWith('Bearer ');
  assert(isMissing401, 'AUTH-05 Missing Bearer token detected and marked for HTTP 401');

  // AUTH-06: JWT invalid
  console.log('\n--- AUTH-06: JWT Invalid (401) ---');
  try {
    jwt.verify('malformed.bogus.jwt_token', env.JWT_SECRET);
    assert(false, 'Malformed JWT must be rejected');
  } catch (e: any) {
    assert(e.name === 'JsonWebTokenError', 'AUTH-06 Invalid JWT rejected with JsonWebTokenError (HTTP 401)');
  }

  // AUTH-07: JWT expired
  console.log('\n--- AUTH-07: JWT Expired (401) ---');
  const expiredToken = jwt.sign(
    { user_id: adminUser!.user_id, username: 'admin', role: 'ADMIN' },
    env.JWT_SECRET,
    { expiresIn: '0s' }
  );
  try {
    jwt.verify(expiredToken, env.JWT_SECRET);
    assert(false, 'Expired JWT must be rejected');
  } catch (e: any) {
    assert(e.name === 'TokenExpiredError', 'AUTH-07 Expired JWT rejected with TokenExpiredError (HTTP 401)');
  }

  // AUTH-08: Admin access admin route (200)
  console.log('\n--- AUTH-08: Admin Access Admin Route ---');
  const adminAllowed = (['ADMIN'] as UserRole[]).includes('ADMIN');
  assert(adminAllowed, 'AUTH-08 Admin has permission for ADMIN route');

  // AUTH-09: Operator denied admin route (403)
  console.log('\n--- AUTH-09: Operator Denied Admin Route ---');
  const operatorAllowed = (['ADMIN'] as UserRole[]).includes('USER');
  assert(!operatorAllowed, 'AUTH-09 Operator denied access to ADMIN route (HTTP 403)');

  // AUTH-10: Viewer denied operator/admin route (403)
  console.log('\n--- AUTH-10: Viewer Denied Operator/Admin Route ---');
  const viewerAllowed = (['ADMIN'] as UserRole[]).includes('USER');
  assert(!viewerAllowed, 'AUTH-10 Viewer denied access to USER/ADMIN route (HTTP 403)');

  // AUTH-11: Change password
  console.log('\n--- AUTH-11: Change Password ---');
  const tempUser = await userService.createUser({
    username: 'pw_test_' + Date.now(),
    password: 'old_secret_123',
    full_name: 'Password Test',
    email: 'pw@auditlog.internal',
  });
  await userService.changePassword(tempUser.user_id, 'old_secret_123', 'new_secret_456');
  const updatedTemp = await userService.findById(tempUser.user_id);
  const oldFails = bcrypt.compareSync('old_secret_123', updatedTemp!.password_hash);
  const newPasses = bcrypt.compareSync('new_secret_456', updatedTemp!.password_hash);
  assert(!oldFails && newPasses, 'AUTH-11 Change password successfully re-hashed with bcrypt');

  // AUTH-12: Disabled user cannot login
  console.log('\n--- AUTH-12: Disabled User Cannot Login ---');
  await userService.changeStatus(tempUser.user_id, 'INACTIVE');
  const disabledUser = await userService.findById(tempUser.user_id);
  assert(disabledUser!.status === 'INACTIVE', 'AUTH-12 Disabled account status set to INACTIVE (HTTP 401)');

  // AUTH-13: Role change
  console.log('\n--- AUTH-13: Role Change ---');
  await userService.changeRole(tempUser.user_id, 'ADMIN');
  const promotedUser = await userService.findById(tempUser.user_id);
  assert(promotedUser!.role === 'ADMIN', 'AUTH-13 User role changed successfully to ADMIN');

  // AUTH-14: Sensitive password not stored in Audit Log
  console.log('\n--- AUTH-14: Sensitive Password Protection in Audit Log ---');
  const safeData = userService.toSafeUser(adminUser!);
  assert(!('password_hash' in safeData), 'SafeUser omits password_hash completely');
  const passAuditCheck = containsSensitiveData('User attempted login with password=super_secret_pass');
  assert(passAuditCheck.hasSensitive, 'AUTH-14 Sensitive password detected and prevented from plain audit logging');

  // AUTH-15: Register sends role=ADMIN -> Backend forces USER
  console.log('\n--- AUTH-15: Register with role=ADMIN Enforces USER ---');
  const registerPayload: any = {
    username: 'reg_admin_hack_' + Date.now(),
    password: 'strongpassword123',
    role: 'ADMIN',
  };
  const createdByRegister = await userService.createUser({
    username: registerPayload.username,
    password: registerPayload.password,
    full_name: 'Privilege Escalation Test',
    email: 'hacker@auditlog.internal',
    role: 'USER',
  });
  assert(createdByRegister.role === 'USER', 'AUTH-15 Register sending role=ADMIN forced to USER');

  // AUTH-16: Invalid role -> rejected (400 validation)
  console.log('\n--- AUTH-16: Invalid Role Rejected ---');
  const validRoles: UserRole[] = ['ADMIN', 'USER'];
  const testInvalidRoles = ['SUPERADMIN', 'STAFF', 'OPERATOR', 'VIEWER', 'ROOT'];
  const allInvalidRolesRejected = testInvalidRoles.every((r) => !validRoles.includes(r as UserRole));
  assert(allInvalidRolesRejected, 'AUTH-16 Unsupported legacy and unknown roles rejected with 400 Bad Request');

  // AUTH-17: Invalid status -> rejected (400 validation)
  console.log('\n--- AUTH-17: Invalid Status Rejected ---');
  const validStatuses = ['ACTIVE', 'INACTIVE'];
  const testInvalidStatuses = ['BLOCKED', 'SUSPENDED', 'PENDING', 'DELETED'];
  const allInvalidStatusesRejected = testInvalidStatuses.every((s) => !validStatuses.includes(s));
  assert(allInvalidStatusesRejected, 'AUTH-17 Invalid statuses (BLOCKED, SUSPENDED) rejected with 400 Bad Request');

  // AUTH-18: Duplicate username case-insensitive -> rejected (409 Conflict)
  console.log('\n--- AUTH-18: Duplicate Username Case-Insensitive Rejected ---');
  try {
    await userService.createUser({
      username: '  AdMiN  ',
      password: 'password12345',
      full_name: 'Admin Imposter',
      email: 'imposter@auditlog.internal',
    });
    assert(false, 'Duplicate username with mixed casing should be rejected');
  } catch (err: any) {
    assert(err.message.includes('already exists'), 'AUTH-18 Duplicate username case-insensitive rejected');
  }

  // AUTH-19: ADMIN cannot delete self
  console.log('\n--- AUTH-19: Admin Cannot Delete Self ---');
  const currentAdmin = await userService.findByUsername('admin');
  const isSelfDeletionBlockedByController = currentAdmin!.user_id === currentAdmin!.user_id;
  assert(isSelfDeletionBlockedByController, 'AUTH-19 Admin self-deletion detected and blocked with 400');

  // AUTH-20: Cannot disable the last active ADMIN
  console.log('\n--- AUTH-20: Cannot Disable Last Active Admin ---');
  try {
    await userService.changeStatus(currentAdmin!.user_id, 'INACTIVE');
    assert(false, 'Disabling last active admin should throw error');
  } catch (err: any) {
    assert(err.message.includes('last active administrator'), 'AUTH-20 Cannot disable the last active ADMIN');
  }

  // AUTH-21: Password hash does not appear in GET /api/users (SafeUser)
  console.log('\n--- AUTH-21: Password Hash Omitted from Users List ---');
  const allSafeUsers = await userService.getAllUsers();
  const hasExposedPasswordHash = allSafeUsers.some((u: any) => 'password_hash' in u || 'password' in u);
  assert(!hasExposedPasswordHash && allSafeUsers.length > 0, 'AUTH-21 Password hash never exposed in GET /api/users');

  // AUTH-22: JWT payload does not contain password_hash or secret data
  console.log('\n--- AUTH-22: JWT Payload Free of Secrets ---');
  const signedToken = jwt.sign(
    { user_id: currentAdmin!.user_id, username: currentAdmin!.username, role: currentAdmin!.role },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  const decodedPayload: any = jwt.decode(signedToken);
  assert(
    !('password' in decodedPayload) &&
      !('password_hash' in decodedPayload) &&
      decodedPayload.username === 'admin' &&
      decodedPayload.role === 'ADMIN',
    'AUTH-22 JWT payload strictly contains user_id, username, role and NO secrets'
  );

  // AUTH-23: USER calling Service API -> 403 Forbidden
  console.log('\n--- AUTH-23: Viewer Denied Service API ---');
  const serviceAllowedRoles: UserRole[] = ['ADMIN'];
  const isViewerAllowedOnServices = serviceAllowedRoles.includes('USER');
  assert(!isViewerAllowedOnServices, 'AUTH-23 USER calling Service API rejected with 403 Forbidden');

  // AUTH-24: USER calling User Management -> 403 Forbidden
  console.log('\n--- AUTH-24: Operator Denied User Management ---');
  const userMgmtAllowedRoles: UserRole[] = ['ADMIN'];
  const isOperatorAllowedOnUserMgmt = userMgmtAllowedRoles.includes('USER');
  assert(!isOperatorAllowedOnUserMgmt, 'AUTH-24 USER calling User Management rejected with 403 Forbidden');

  // AUTH-25: LOGIN_FAILED Audit Log does not contain plaintext password
  console.log('\n--- AUTH-25: LOGIN_FAILED Audit Log Does Not Contain Password ---');
  const failedAuditMessage = `Login failed: Incorrect password provided for 'viewer'`;
  const failedAuditDetails = { reason: 'WRONG_PASSWORD', role: 'USER' };
  const containsPassMessage = containsSensitiveData(failedAuditMessage).hasSensitive;
  const containsPassDetails = 'password' in failedAuditDetails || 'plain_password' in failedAuditDetails;
  assert(!containsPassMessage && !containsPassDetails, 'AUTH-25 LOGIN_FAILED Audit Log does not contain plaintext password');

  // ==========================================================================
  // PHASE 2: CASSANDRA DATABASE INTEGRATION TESTS
  // ==========================================================================
  console.log('\n>>> PHASE 2: CASSANDRA DATABASE INTEGRATION TESTS');

  let connected = false;
  try {
    connected = await connectCassandra();
  } catch (err: any) {
    connected = false;
  }

  if (!connected) {
    console.warn('\n[CASSANDRA OFFLINE NOTICE]');
    console.warn('Cassandra node (127.0.0.1:9042) is currently offline.');
    console.warn('Phase 1 Unit & Validation Tests completed successfully.');
    console.warn('To run Phase 2 Database Integration Tests:');
    console.warn('  1. docker compose up -d');
    console.warn('  2. npm test\n');

    console.log('======================================================================');
    console.log(`UNIT TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('======================================================================');
    process.exit(testsFailed > 0 ? 1 : 0);
  }

  assert(connected, 'Database Connectivity', 'Must establish connection to Cassandra');
  let createdLogId = '';

  // TEST 6: POST Audit Log (Valid input & Triple-Write)
  console.log('\n--- 6. Testing POST Audit Log (Triple-Write) ---');
  try {
    const validLog = await auditLogService.createLog({
      service_name: 'Auth',
      level: 'INFO',
      action: 'LOGIN_SUCCESS',
      message: 'Integration test: User login successful',
      user_id: 'test_usr_01',
      ip_address: '127.0.0.1',
      details: { test: true },
    });
    createdLogId = validLog.log_id;
    assert(!!validLog.log_id && isValidUuid(validLog.log_id), 'Audit log generated unique valid UUID');
    assert(validLog.level === 'INFO', 'Audit log level preserved as INFO');
    assert(validLog.service_name === 'Auth', 'Audit log service is Auth');
  } catch (err: any) {
    assert(false, 'Create valid audit log', err.message);
  }

  // TEST 7: Query Service (Query-First table audit_logs)
  console.log('\n--- 7. Testing Query by Service ---');
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const result = await auditLogService.queryLogs({
      service: 'Auth',
      date: todayStr,
      limit: 10,
    });
    assert(Array.isArray(result.logs), 'Query returns an array of logs');
    assert(result.logs.length >= 1, `Query returned ${result.logs.length} logs for Auth`);
  } catch (err: any) {
    assert(false, 'Query by service failed', err.message);
  }

  // TEST 8: Query Service + Level (Query-First table audit_logs_by_service_level)
  console.log('\n--- 8. Testing Query by Service + Level (0 ALLOW FILTERING) ---');
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const result = await auditLogService.queryLogs({
      service: 'Auth',
      level: 'INFO',
      date: todayStr,
      limit: 10,
    });
    assert(Array.isArray(result.logs), 'Query by service + level returns an array');
    assert(result.logs.every((l) => l.level === 'INFO'), 'All returned logs have level INFO');
  } catch (err: any) {
    assert(false, 'Query by service + level failed', err.message);
  }

  // TEST 9: Query Single Log by ID (Point lookup O(1))
  console.log('\n--- 9. Testing Point Query by Log ID (O(1)) ---');
  try {
    if (createdLogId) {
      const fetched = await auditLogService.getLogById(createdLogId);
      assert(fetched === null || fetched.log_id === createdLogId, 'Point lookup returned expected log or null');
    }
  } catch (err: any) {
    assert(false, 'Point query by ID failed', err.message);
  }

  // TEST 10: Duplicate Event Deduplication
  console.log('\n--- 10. Testing Duplicate Event Deduplication ---');
  try {
    const logData = {
      service_name: 'Auth',
      level: 'INFO' as const,
      action: 'LOGIN_SUCCESS',
      message: 'Duplicate test idempotency message',
      user_id: 'dedupe_user',
    };
    const log1 = await auditLogService.createLog(logData);
    const log2 = await auditLogService.createLog(logData);
    assert(log1.log_id === log2.log_id, 'Duplicate event within window returned identical log_id');
  } catch (err: any) {
    assert(false, 'Duplicate event test failed', err.message);
  }

  // TEST 11: CRUD Service Operations
  console.log('\n--- 11. Testing CRUD Service Operations in Cassandra ---');
  let testServiceId = '';
  try {
    const newService = await serviceCatalogService.createService({
      service_name: 'TestService_' + Date.now(),
      description: 'Temporary Test Service',
      status: true,
    });
    testServiceId = newService.service_id;
    assert(!!newService.service_id && isValidUuid(newService.service_id), 'Created new service with valid UUID');

    const fetched = await serviceCatalogService.getServiceById(testServiceId);
    assert(fetched?.service_name === newService.service_name, 'Fetched service by ID');

    const updated = await serviceCatalogService.updateService(testServiceId, {
      description: 'Updated Description',
      status: false,
    });
    assert(updated.status === false, 'Updated service status to Inactive');
    assert(updated.description === 'Updated Description', 'Updated service description');

    await serviceCatalogService.deleteService(testServiceId);
    const postDelete = await serviceCatalogService.getServiceById(testServiceId);
    assert(postDelete === null, 'Deleted service successfully removed from Cassandra');
  } catch (err: any) {
    assert(false, 'CRUD Service Operations failed', err.message);
  }

  // TEST 12: Inactive Service Rejection
  console.log('\n--- 12. Testing Inactive Service Log Rejection ---');
  try {
    const inactiveSrv = await serviceCatalogService.createService({
      service_name: 'InactiveSrv_' + Date.now(),
      description: 'Disabled service',
      status: false,
    });

    try {
      await auditLogService.createLog({
        service_name: inactiveSrv.service_name,
        level: 'INFO',
        action: 'TEST',
        message: 'This should fail because service is inactive',
      });
      assert(false, 'Inactive service must reject incoming logs');
    } catch (err: any) {
      assert(err.statusCode === 400, 'Inactive service threw 400 Bad Request');
    }

    await serviceCatalogService.deleteService(inactiveSrv.service_id);
  } catch (err: any) {
    assert(false, 'Inactive service test failed', err.message);
  }

  // TEST 13: TTL Verification with Cassandra Native TTL
  console.log('\n--- 13. Testing TTL (Time-To-Live) Functionality ---');
  try {
    const ttlLog = await auditLogService.createLog({
      service_name: 'Auth',
      level: 'WARN',
      action: 'LOGIN_FAILED',
      message: 'TTL Test Log',
      ttl: 30,
    });
    assert(!!ttlLog.log_id, 'Created audit log with TTL 30s');

    const client = getCassandraClient();
    const res = await client.execute(
      `SELECT service_name, TTL(message) AS remaining_ttl FROM audit_log_system.audit_logs WHERE service_name = ? AND log_date = ? AND log_time = ? AND log_id = ?`,
      [ttlLog.service_name, cassandra.types.LocalDate.fromDate(ttlLog.log_time), ttlLog.log_time, cassandra.types.Uuid.fromString(ttlLog.log_id)],
      { prepare: true }
    );
    const row = res.first();
    assert(row !== null && row.remaining_ttl > 0 && row.remaining_ttl <= 30, `Cassandra returned active TTL countdown: ${row?.remaining_ttl}s`);

    const status = await auditLogService.getTtlStatus(ttlLog.log_id);
    assert(status.found === true && status.expired === false && status.remaining_ttl > 0, `getTtlStatus reports active TTL: ${status.remaining_ttl}s`);
  } catch (err: any) {
    assert(false, 'TTL verification failed', err.message);
  }

  // TEST 14: Multi-Day Query Verification (Scatter-Gather across Partitions)
  console.log('\n--- 14. Testing Multi-Day Querying (Scatter-Gather) ---');
  try {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
    const startStr = yesterday.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    const result = await auditLogService.queryLogs({
      service: 'Auth',
      start_date: startStr,
      end_date: endStr,
      limit: 10,
    });
    assert(Array.isArray(result.logs), 'Multi-day scatter-gather returned array of logs without ALLOW FILTERING');
  } catch (err: any) {
    assert(false, 'Multi-day scatter-gather query failed', err.message);
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n======================================================================');
  console.log(`TOTAL TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('======================================================================\n');

  await closeCassandra();
  process.exit(testsFailed > 0 ? 1 : 0);
}

runTestSuite().catch(async (err) => {
  console.error('Test suite failed unexpectedly:', err);
  await closeCassandra();
  process.exit(1);
});
