import React from 'react';
import { X } from 'lucide-react';
export const PageHead = ({eyebrow,title,desc,action}) => <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{desc}</p></div>{action}</div>;
export function Modal({title,onClose,children}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X/></button></div>{children}</div></div>; }
export function Field({label,children}) { return <label className="field">{label}{children}</label>; }
export function Empty({text}) { return <div className="empty">{text}</div>; }
