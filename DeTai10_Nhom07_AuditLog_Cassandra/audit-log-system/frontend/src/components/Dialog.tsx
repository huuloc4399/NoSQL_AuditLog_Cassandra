import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export const Dialog = ({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="flow-dialog" onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}><div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Đóng hộp thoại"><X size={19}/></button></div>{children}</dialog>;
};
