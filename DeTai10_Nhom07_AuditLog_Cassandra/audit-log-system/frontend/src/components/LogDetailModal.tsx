import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { AuditLog } from '../types';
import { Dialog } from './Dialog';
export const LogDetailModal = ({ log, isOpen, onClose }: { log: AuditLog | null; isOpen: boolean; onClose: () => void }) => {
  const [copied, setCopied] = useState(false); const [copyError, setCopyError] = useState(false);
  useEffect(() => { setCopied(false); setCopyError(false); }, [log?.log_id]);
  if (!isOpen || !log) return null;
  let details = log.details || 'Không có dữ liệu bổ sung.';
  try { if (log.details) details = JSON.stringify(JSON.parse(log.details), null, 2); } catch { /* Preserve plain text details. */ }
  const copy = async () => { try { await navigator.clipboard.writeText(log.log_id); setCopied(true); } catch { setCopyError(true); } };
  return <Dialog title="Chi tiết nhật ký" onClose={onClose}><div className="log-detail"><div className="detail-action"><span className={`level-pill ${log.level.toLowerCase()}`}>{log.level}</span><strong>{log.action}</strong></div><p className="detail-message">{log.message}</p><div className="detail-id"><label>MÃ NHẬT KÝ</label><div><code>{log.log_id}</code><button onClick={copy} className="icon-button" aria-label="Sao chép mã nhật ký">{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div>{copyError && <p className="form-error" role="status">Không thể sao chép tự động. Bạn có thể chọn và sao chép mã bên trên.</p>}</div><dl><div><dt>Dịch vụ</dt><dd>{log.service_name}</dd></div><div><dt>Thời gian (UTC)</dt><dd>{new Date(log.log_time).toLocaleString('vi-VN', { timeZone: 'UTC', hour12: false })}</dd></div><div><dt>Người thực hiện</dt><dd>{log.user_id || 'Hệ thống'}</dd></div><div><dt>Địa chỉ IP</dt><dd>{log.ip_address || 'Không ghi nhận'}</dd></div><div><dt>Ngày phân vùng</dt><dd>{log.log_date}</dd></div>{log.remaining_ttl !== undefined && log.remaining_ttl > 0 && <div><dt>TTL tại lúc truy vấn</dt><dd>{log.remaining_ttl} giây</dd></div>}</dl><label className="detail-caption">DỮ LIỆU BỔ SUNG</label><pre>{details}</pre><p className="detail-footnote">Audit Log là lịch sử thao tác và không thể chỉnh sửa từ giao diện.</p></div></Dialog>;
};
