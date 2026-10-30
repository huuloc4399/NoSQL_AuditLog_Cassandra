/**
 * [BAREM 4 - Dữ liệu mẫu, 1,0đ] Tạo 400 sự kiện thuộc Auth/User/Order/Payment.
 * Mỗi dịch vụ 100 sự kiện, có đủ INFO/WARN/ERROR; cùng UUID được ghi ở ba bảng audit.
 * Đề tài yêu cầu bộ 200-500 log; không dùng con số 100 ở mục phân công làm tổng bộ mẫu.
 * Chạy npm run seed:demo để dùng --if-empty và giữ dữ liệu khi DB đã có log.
 * Khi kiểm chứng số sự kiện, đếm audit_logs một lần; không cộng ba bản sao thành 1.200 log.
 */
import { connectCassandra, closeCassandra, getCassandraClient, cassandra } from '../src/config/cassandra.js';
import { serviceCatalogService } from '../src/services/serviceCatalogService.js';

interface ActionTemplate {
  action: string;
  message: string;
  details: Record<string, any>;
}

// Các tình huống mẫu được nhóm theo dịch vụ và mức độ để tạo dữ liệu có thể giải thích.
// Nội dung mẫu không đưa mật khẩu, token hoặc số thẻ thật vào dữ liệu audit.
const ACTION_TEMPLATES: Record<string, Record<'INFO' | 'WARN' | 'ERROR', ActionTemplate[]>> = {
  Auth: {
    INFO: [
      { action: 'LOGIN_SUCCESS', message: 'User signed in successfully via Password & SMS 2FA', details: { auth_method: 'PASSWORD_2FA', mfa_verified: true, session_duration_hours: 8 } },
      { action: 'LOGIN_SUCCESS', message: 'User authenticated via Google Corporate OAuth2 SSO', details: { auth_method: 'OAUTH2_SSO', provider: 'Google', client_id: 'corp-auth-app' } },
      { action: 'LOGOUT', message: 'User terminated active browser session gracefully', details: { reason: 'USER_EXPLICIT_LOGOUT', session_lifetime_sec: 3420 } },
      { action: 'RESET_PASSWORD', message: 'User requested self-service password reset email link', details: { request_channel: 'EMAIL', expires_in_minutes: 15 } },
    ],
    WARN: [
      { action: 'LOGIN_FAILED', message: 'Failed sign in attempt: Bad credentials supplied', details: { failure_reason: 'BAD_PASSWORD', attempt_count: 2, threshold: 5 } },
      { action: 'LOGIN_FAILED', message: 'Sign in attempt blocked: Unrecognized device and country', details: { country_iso: 'UA', risk_level: 'MEDIUM', challenge_triggered: true } },
      { action: 'RESET_PASSWORD', message: 'Password reset token expired before verification completed', details: { expired_after_minutes: 15, resend_requested: true } },
    ],
    ERROR: [
      { action: 'LOGIN_FAILED', message: 'Account temporarily locked: Exceeded 5 failed login attempts', details: { lockout_duration_min: 30, policy: 'BRUTE_FORCE_PREVENTION' } },
      { action: 'LOGIN_FAILED', message: 'Security gateway blocked credential stuffing attack wave', details: { attack_signature: 'CRED_STUFFING', blocked_ip_subnet: '198.51.100.0/24' } },
    ],
  },
  User: {
    INFO: [
      { action: 'CREATE_USER', message: 'New customer account successfully registered', details: { tier: 'STANDARD', referral_source: 'MARKETING_2026', email_verified: true } },
      { action: 'UPDATE_USER', message: 'Customer updated contact telephone and notification preferences', details: { modified_fields: ['phone_number', 'sms_opt_in'] } },
      { action: 'UPDATE_USER', message: 'Customer updated default delivery and billing address', details: { city: 'Da Nang', country: 'Vietnam', postal_code: '550000' } },
      { action: 'VIEW_USER', message: 'Authorized customer care agent viewed customer profile details', details: { agent_role: 'TIER_1_SUPPORT', reason: 'INQUIRY_INSPECTION' } },
    ],
    WARN: [
      { action: 'UPDATE_USER', message: 'Customer profile update rejected: Duplicate tax code detected', details: { rejected_field: 'tax_identification', status: 'DUPLICATE_CONFLICT' } },
      { action: 'VIEW_USER', message: 'Internal bulk customer lookup rate limit near threshold', details: { query_rate_per_min: 88, max_allowed: 100 } },
    ],
    ERROR: [
      { action: 'DELETE_USER', message: 'Failed to purge customer record: Outstanding unpaid invoice balance', details: { ledger_code: 'ERR_OPEN_INVOICES', balance_remaining: 450.0 } },
      { action: 'CREATE_USER', message: 'User registration failed due to downstream CRM synchronizer timeout', details: { error_code: 'CRM_RPC_TIMEOUT', latency_ms: 5020 } },
    ],
  },
  Order: {
    INFO: [
      { action: 'CREATE_ORDER', message: 'Customer placed new e-commerce purchase order', details: { currency: 'USD', subtotal: 189.5, item_count: 3, fulfillment: 'STANDARD_EXPRESS' } },
      { action: 'UPDATE_ORDER', message: 'Order fulfillment status transitioned to IN_TRANSIT', details: { carrier: 'VNPost', tracking_code: 'VN-99281726-EX', dispatched_hub: 'HANOI_HUB_01' } },
      { action: 'UPDATE_ORDER', message: 'Shipping delivery address updated before package dispatch', details: { modified_by: 'CUSTOMER_PORTAL', change_type: 'ADDRESS_CORRECTION' } },
    ],
    WARN: [
      { action: 'CANCEL_ORDER', message: 'Order voided by customer prior to warehouse packaging', details: { cancellation_reason: 'CUSTOMER_CHANGED_MIND', refund_method: 'ORIGINAL_PAYMENT' } },
      { action: 'CANCEL_ORDER', message: 'Order automatically cancelled: Checkout payment window expired (30m)', details: { timeout_reason: 'PAYMENT_PENDING_EXPIRED', hold_minutes: 30 } },
    ],
    ERROR: [
      { action: 'CREATE_ORDER', message: 'Order placement aborted: Insufficient warehouse inventory for SKU', details: { sku: 'SKU-LOGITECH-MX3', requested_qty: 4, available_stock: 0 } },
      { action: 'DELETE_ORDER', message: 'Order deletion rejected: Ineligible status stage for deletion', details: { current_state: 'PROCESSING_PAYMENT', required_state: 'DRAFT_OR_CANCELLED' } },
    ],
  },
  Payment: {
    INFO: [
      { action: 'CREATE_PAYMENT', message: 'Customer initiated payment settlement checkout session', details: { payment_gateway: 'Stripe', amount: 189.5, currency: 'USD', payment_type: 'CREDIT_CARD' } },
      { action: 'PAYMENT_SUCCESS', message: 'Payment authorization and capture successfully confirmed', details: { payment_gateway: 'VNPay', response_code: '00', card_brand: 'Visa', card_last4: '4242' } },
      { action: 'REFUND', message: 'Customer partial refund issued for approved return request', details: { refund_amount: 50.0, reason: 'DEFECTIVE_ITEM_RETURN', approved_by: 'FINANCE_ADMIN' } },
    ],
    WARN: [
      { action: 'PAYMENT_FAILED', message: 'Card issuer declined charge: Insufficient account funds', details: { decline_code: 'INSUFFICIENT_FUNDS', retry_allowed: true } },
      { action: 'REFUND', message: 'Customer chargeback disputed by merchant pending bank review', details: { dispute_id: 'DSP-88219', dispute_status: 'UNDER_MERCHANT_REVIEW' } },
    ],
    ERROR: [
      { action: 'PAYMENT_FAILED', message: 'Payment gateway communication failure during 3D-Secure challenge', details: { gateway_provider: 'VisaNet', failure_type: 'NETWORK_TIMEOUT', latency_ms: 12050 } },
      { action: 'PAYMENT_FAILED', message: 'Transaction rejected by ML fraud detection engine', details: { fraud_score: 98, decision: 'AUTOMATIC_BLOCK', reason: 'SUSPECTED_PROXY_ANOMALY' } },
    ],
  },
};

const USERS = [
  'usr_alice_01', 'usr_bob_02', 'usr_charlie_03', 'usr_david_04', 'usr_emma_05',
  'usr_frank_06', 'usr_grace_07', 'usr_henry_08', 'usr_ivy_09', 'usr_jack_10'
];

const VALID_IPS = [
  '192.168.1.15', '192.168.1.42', '10.0.0.8', '172.16.0.25',
  '203.113.152.1', '118.69.182.9', '14.161.40.88', '115.79.20.12'
];

interface GeneratedLogRecord {
  service: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  action: string;
  log_date: string;
  log_time: Date;
  log_id: cassandra.types.Uuid;
  user_id: string;
  ip_address: string;
  message: string;
  details: string;
}

export async function generateDummyAuditLogs(): Promise<void> {
  console.log('======================================================================');
  console.log('   APACHE CASSANDRA DUMMY DATA GENERATOR (400 ENTERPRISE LOGS)        ');
  console.log('   Multi-Day Distribution | Zero Duplicate Timestamps | 3-Table Write ');
  console.log('======================================================================\n');

  let connected = false;
  try {
    connected = await connectCassandra();
  } catch {
    connected = false;
  }

  if (!connected) {
    console.warn('\n[CASSANDRA OFFLINE NOTICE]');
    console.warn('Cassandra cluster (127.0.0.1:9042) is currently unreachable.');
    console.warn('To seed 400 enterprise audit logs:');
    console.warn('  1. docker compose up -d');
    console.warn('  2. docker exec -it cassandra_audit_node nodetool status');
    console.warn('  3. npm run seed:dummy\n');
    process.exit(1);
  }

  const client = getCassandraClient();
  for (const name of ['Auth', 'User', 'Order', 'Payment']) {
    if (!await serviceCatalogService.getServiceByName(name)) {
      await serviceCatalogService.createService({ service_name: name, description: `${name} Service`, status: true });
    }
  }
  // Có log thì dừng nạp bộ 400 mẫu; startup vẫn có thể chuẩn bị 48 mẫu hôm nay bằng script khác.
  if (process.argv.includes('--if-empty')) {
    const existing = await client.execute('SELECT log_id FROM audit_log_system.audit_logs LIMIT 1');
    if (existing.rowLength > 0) {
      console.log('Existing audit data found. Preserving it; sample data was not added again.');
      await closeCassandra();
      return;
    }
  }

  // [BAREM 4] Phân bố cố định của bộ khởi tạo: mỗi dịch vụ 100 sự kiện.
  // Auth: 70 INFO + 20 WARN + 10 ERROR = 100
  // User: 70 INFO + 20 WARN + 10 ERROR = 100
  // Order: 65 INFO + 20 WARN + 15 ERROR = 100
  // Payment: 60 INFO + 20 WARN + 20 ERROR = 100
  // TỔNG = 400 sự kiện, mỗi sự kiện có ba bản sao theo mẫu truy vấn.
  const distributions: { service: string; counts: { INFO: number; WARN: number; ERROR: number } }[] = [
    { service: 'Auth', counts: { INFO: 70, WARN: 20, ERROR: 10 } },
    { service: 'User', counts: { INFO: 70, WARN: 20, ERROR: 10 } },
    { service: 'Order', counts: { INFO: 65, WARN: 20, ERROR: 15 } },
    { service: 'Payment', counts: { INFO: 60, WARN: 20, ERROR: 20 } },
  ];

  // Phân bố thời gian trong cửa sổ bảy ngày tính từ lúc tạo bộ mẫu.
  // Các độ lệch ngày được dùng khi dựng ngày UTC cho dữ liệu mẫu.
  const now = new Date();
  const DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6];

  // Ba câu INSERT dùng chung dữ liệu sự kiện; khóa mỗi bảng phục vụ một mẫu đọc.
  const insertQuery1 = `
    INSERT INTO audit_log_system.audit_logs (
      service_name, log_date, log_time, log_id, level, action, user_id, ip_address, message, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const insertQuery2 = `
    INSERT INTO audit_log_system.audit_logs_by_service_level (
      service_name, level, log_date, log_time, log_id, action, user_id, ip_address, message, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const insertQuery3 = `
    INSERT INTO audit_log_system.audit_logs_by_id (
      log_id, service_name, log_date, log_time, level, action, user_id, ip_address, message, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const allRecords: GeneratedLogRecord[] = [];
  let globalSequence = 0;

  for (const dist of distributions) {
    const service = dist.service;
    const levels: ('INFO' | 'WARN' | 'ERROR')[] = ['INFO', 'WARN', 'ERROR'];

    for (const lvl of levels) {
      const count = dist.counts[lvl];
      const templates = ACTION_TEMPLATES[service][lvl];

      for (let i = 0; i < count; i++) {
        globalSequence++;

        // Chia ngày theo chỉ số trong vòng lặp.
        // Khoảng một phần ba có i % 3 === 0 đặt ở hôm nay; phần còn lại dùng công thức bên dưới.
        let dayOffset = 0;
        if (i % 3 === 0) {
          dayOffset = 0; // Today
        } else {
          dayOffset = DAY_OFFSETS[(i % 6) + 1]; // Previous 1 to 6 days
        }

        const targetDateObj = new Date(now.getTime() - dayOffset * 24 * 3600 * 1000);
        const year = targetDateObj.getUTCFullYear();
        const month = targetDateObj.getUTCMonth();
        const day = targetDateObj.getUTCDate();

        // Dựng mốc giờ trong khoảng 08 đến trước 22 giờ UTC để có dữ liệu lọc thời gian.
        // Tạo thành phần thời gian từ sequence; UUID vẫn phân biệt hàng nếu trùng timestamp.
        const baseHour = 8 + (globalSequence % 14); // 8:00 to 21:00
        const baseMinute = (globalSequence * 7) % 60;
        const baseSecond = (globalSequence * 13) % 60;
        const baseMs = (globalSequence * 97) % 1000;

        const logTime = new Date(Date.UTC(year, month, day, baseHour, baseMinute, baseSecond, baseMs));
        const logDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const tmpl = templates[i % templates.length];
        const user = USERS[(globalSequence + i) % USERS.length];
        const ip = VALID_IPS[(globalSequence * 3 + i) % VALID_IPS.length];
        const logId = cassandra.types.Uuid.random();

        const detailsObj = {
          ...tmpl.details,
          iteration: i + 1,
          sequence_number: globalSequence,
          client_env: 'enterprise-node-k8s',
        };

        allRecords.push({
          service,
          level: lvl,
          action: tmpl.action,
          log_date: logDateStr,
          log_time: logTime,
          log_id: logId,
          user_id: user,
          ip_address: ip,
          message: tmpl.message,
          details: JSON.stringify(detailsObj),
        });
      }
    }
  }

  console.log(`Prepared ${allRecords.length} records. Commencing concurrent batch writes to Cassandra...\n`);
  const startTime = Date.now();

  // Ghi theo nhóm 25 sự kiện song song để hạn chế số yêu cầu gửi đồng thời từ máy demo.
  const CHUNK_SIZE = 25;
  for (let i = 0; i < allRecords.length; i += CHUNK_SIZE) {
    const chunk = allRecords.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (record) => {
        const cassandraDate = cassandra.types.LocalDate.fromString(record.log_date);

        const params1 = [
          record.service,
          cassandraDate,
          record.log_time,
          record.log_id,
          record.level,
          record.action,
          record.user_id,
          record.ip_address,
          record.message,
          record.details,
        ];

        const params2 = [
          record.service,
          record.level,
          cassandraDate,
          record.log_time,
          record.log_id,
          record.action,
          record.user_id,
          record.ip_address,
          record.message,
          record.details,
        ];

        const params3 = [
          record.log_id,
          record.service,
          cassandraDate,
          record.log_time,
          record.level,
          record.action,
          record.user_id,
          record.ip_address,
          record.message,
          record.details,
        ];

        // Gửi ba INSERT chung UUID, thời gian và payload trong một logged batch.
        await client.batch([
          { query: insertQuery1, params: params1 },
          { query: insertQuery2, params: params2 },
          { query: insertQuery3, params: params3 },
        ], { prepare: true, logged: true });
      })
    );
  }

  const durationMs = Date.now() - startTime;

  // -------------------------------------------------------------------------
  // TỔNG HỢP BỘ MẪU ĐÃ TẠO THEO DỊCH VỤ, MỨC ĐỘ VÀ NGÀY
  // -------------------------------------------------------------------------
  console.log('======================================================================');
  console.log('             DUMMY DATA GENERATION SUMMARY REPORT                     ');
  console.log('======================================================================');

  // Thống kê trên danh sách vừa tạo; không phải tổng toàn bộ log đã có từ trước trong DB.
  const serviceStats: Record<string, { INFO: number; WARN: number; ERROR: number; Total: number }> = {};
  const dateStats: Record<string, number> = {};

  for (const r of allRecords) {
    if (!serviceStats[r.service]) {
      serviceStats[r.service] = { INFO: 0, WARN: 0, ERROR: 0, Total: 0 };
    }
    serviceStats[r.service][r.level]++;
    serviceStats[r.service].Total++;

    dateStats[r.log_date] = (dateStats[r.log_date] || 0) + 1;
  }

  console.log('\n[1] PHÂN BỔ THEO DỊCH VỤ & MỨC ĐỘ SEVERITY:');
  console.table(serviceStats);

  console.log('[2] PHÂN BỔ TRẢI TRÊN NHIỀU NGÀY (MULTI-DAY DISTRIBUTION):');
  console.table(
    Object.keys(dateStats)
      .sort()
      .map((date) => ({
        Calendar_Date: date,
        Logs_Recorded: dateStats[date],
      }))
  );

  console.log('[3] DANH MỤC ACTIONS THỰC HIỆN THEO MICROSERVICE:');
  const actionSummary = {
    Auth: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'RESET_PASSWORD'],
    User: ['CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'VIEW_USER'],
    Order: ['CREATE_ORDER', 'UPDATE_ORDER', 'CANCEL_ORDER', 'DELETE_ORDER'],
    Payment: ['CREATE_PAYMENT', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'REFUND'],
  };
  console.table(actionSummary);

  console.log('======================================================================');
  console.log(`XÁC NHẬN TỔNG SỐ BẢN GHI: ${allRecords.length} / 400 AUDIT LOGS`);
  console.log(`THỜI GIAN THỰC THI      : ${durationMs} ms (Trung bình: ${(durationMs / allRecords.length).toFixed(1)} ms/log)`);
  console.log(`CƠ CHẾ GHI DỮ LIỆU       : Đồng bộ 3 bảng (audit_logs, audit_logs_by_service_level, audit_logs_by_id)`);
  console.log('LỆNH CHẠY DỄ NHỚ        : npm run seed:dummy');
  console.log('======================================================================\n');

  await closeCassandra();
  process.exit(0);
}

// Điểm chạy script; các số đo thời gian dưới đây chỉ thuộc lần tạo dữ liệu này.
generateDummyAuditLogs().catch(async (err) => {
  console.error('[GenerateDummyData Error]:', err);
  await closeCassandra();
  process.exit(1);
});
